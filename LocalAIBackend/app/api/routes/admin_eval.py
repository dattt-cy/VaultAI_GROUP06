"""
Admin Eval Router — /api/admin/eval/*
Cung cấp API để chạy và xem kết quả đánh giá RAG pipeline.
"""
import json
import threading
from pathlib import Path
from fastapi import APIRouter, Depends
from app.api.dependencies import require_min_level

router = APIRouter()

EVAL_REPORT_PATH = Path(__file__).parent.parent.parent.parent / "eval" / "eval_report.json"
EVAL_QUESTIONS_PATH = Path(__file__).parent.parent.parent.parent / "eval" / "eval_questions.json"

# Trạng thái chạy đánh giá (in-memory, không cần DB)
_eval_status = {"running": False, "progress": 0, "total": 0, "error": None}


@router.get("/eval/report")
async def get_eval_report(_=Depends(require_min_level(5))):
    """Trả về kết quả đánh giá đã lưu."""
    if not EVAL_REPORT_PATH.exists():
        return {"has_report": False, "results": [], "summary": None}

    results = json.loads(EVAL_REPORT_PATH.read_text(encoding="utf-8"))
    summary = _compute_summary(results)
    return {"has_report": True, "results": results, "summary": summary}


@router.get("/eval/status")
async def get_eval_status(_=Depends(require_min_level(5))):
    """Trả về trạng thái chạy đánh giá hiện tại."""
    return _eval_status


@router.post("/eval/run")
async def run_eval(_=Depends(require_min_level(9))):
    """Chạy đánh giá RAG trong background thread."""
    if _eval_status["running"]:
        return {"started": False, "message": "Đánh giá đang chạy, vui lòng chờ."}

    if not EVAL_QUESTIONS_PATH.exists():
        return {"started": False, "message": "Không tìm thấy file eval_questions.json."}

    thread = threading.Thread(target=_run_eval_background, daemon=True)
    thread.start()
    return {"started": True, "message": "Đã bắt đầu đánh giá. Quá trình này mất khoảng 10 phút."}


# ─────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────

_NOT_FOUND_PHRASES = [
    "không tìm thấy thông tin",
    "không có thông tin",
    "không đề cập trong tài liệu",
    "ngoài phạm vi tài liệu",
    "tài liệu không đề cập",
    "không tìm thấy đủ tin cậy",
]


def _is_not_found(answer: str) -> bool:
    lower = answer.lower()
    return any(p in lower for p in _NOT_FOUND_PHRASES)


def _keyword_score(answer: str, keywords: list) -> float:
    if not keywords:
        return 1.0
    lower = answer.lower()
    hits = sum(1 for kw in keywords if kw.lower() in lower)
    return round(hits / len(keywords), 2)


def _compute_summary(results: list) -> dict:
    valid = [r for r in results if "error" not in r]
    in_scope = [r for r in valid if not r.get("is_out_of_scope")]
    out_scope = [r for r in valid if r.get("is_out_of_scope")]

    if not valid:
        return {}

    passed = sum(1 for r in valid if r.get("passed"))
    citation_ok = sum(1 for r in valid if r.get("citation_ok"))
    avg_latency = round(sum(r["latency"] for r in valid) / len(valid), 2)
    avg_kw = round(sum(r.get("keyword_score", 0) for r in in_scope) / len(in_scope), 2) if in_scope else 0
    hit_rate = round(
        sum(1 for r in in_scope if not _is_not_found(r.get("answer_preview", ""))) / len(in_scope), 2
    ) if in_scope else 0
    rejection_rate = round(
        sum(1 for r in out_scope if r.get("passed")) / len(out_scope), 2
    ) if out_scope else None

    return {
        "total": len(results),
        "errors": len(results) - len(valid),
        "passed": passed,
        "pass_rate": round(passed / len(valid), 2) if valid else 0,
        "hit_rate": hit_rate,
        "rejection_rate": rejection_rate,
        "keyword_score_avg": avg_kw,
        "citation_accuracy": round(citation_ok / len(valid), 2) if valid else 0,
        "avg_latency": avg_latency,
    }


def _run_eval_background():
    import time, sys
    from pathlib import Path as P
    sys.path.insert(0, str(P(__file__).parent.parent.parent.parent.parent))

    from app.db.session import SessionLocal
    from app.services.rag_pipeline import query_rag

    global _eval_status
    questions = json.loads(EVAL_QUESTIONS_PATH.read_text(encoding="utf-8"))
    _eval_status = {"running": True, "progress": 0, "total": len(questions), "error": None}

    db = SessionLocal()
    results = []
    try:
        for i, q in enumerate(questions):
            _eval_status["progress"] = i
            qid = q["id"]
            question = q["question"]
            expected_kws = q.get("expected_keywords", [])
            expect_citation = q.get("expected_citation", True)
            is_out_of_scope = q.get("category") == "out_of_scope"

            t0 = time.time()
            try:
                result = query_rag(query=question, db=db, allowed_doc_ids=None, conversation_history=[])
            except Exception as e:
                results.append({"id": qid, "error": str(e), "latency": round(time.time() - t0, 2)})
                continue

            latency = round(time.time() - t0, 2)
            answer = result.get("answer", "")
            citations = result.get("citations", [])
            has_citation = len(citations) > 0
            not_found = _is_not_found(answer)
            kw_score = _keyword_score(answer, expected_kws)
            citation_ok = has_citation == expect_citation

            if is_out_of_scope:
                passed = not_found
            else:
                passed = (not not_found) and (kw_score >= 0.5)

            results.append({
                "id": qid,
                "category": q.get("category"),
                "question": question,
                "source_doc": q.get("source_doc", ""),
                "passed": passed,
                "is_out_of_scope": is_out_of_scope,
                "latency": latency,
                "has_citation": has_citation,
                "citation_ok": citation_ok,
                "keyword_score": kw_score,
                "answer_preview": answer[:300],
                "num_citations": len(citations),
            })

        EVAL_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        EVAL_REPORT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        _eval_status["error"] = str(e)
    finally:
        db.close()
        _eval_status["running"] = False
        _eval_status["progress"] = len(questions)
