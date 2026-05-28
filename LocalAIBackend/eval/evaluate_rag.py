"""
RAG Evaluation Script — LocalAI System
=======================================
Chạy đầy đủ (mất ~10 phút):
  cd LocalAIBackend && python -m eval.evaluate_rag

Chỉ hiển thị kết quả đã lưu (tức thì — dùng khi demo bảo vệ):
  python -m eval.evaluate_rag --show

Đo lường:
  - Hit Rate:        Tỷ lệ câu hỏi có trả về nội dung thực sự (không "không tìm thấy")
  - Citation Rate:   Tỷ lệ câu trả lời có kèm citation
  - Keyword Score:   Tỷ lệ từ khóa kỳ vọng xuất hiện trong câu trả lời
  - Latency:         Thời gian phản hồi trung bình (giây)
  - Rejection Rate:  Tỷ lệ câu hỏi ngoài phạm vi bị từ chối đúng
"""

import json
import time
import sys
import os
from pathlib import Path

# Thêm root vào path để import app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import SessionLocal
from app.services.rag_pipeline import query_rag

# ─────────────────────────────────────────
EVAL_FILE = Path(__file__).parent / "eval_questions.json"
NOT_FOUND_PHRASES = [
    "không tìm thấy",
    "không có thông tin",
    "không đề cập",
    "ngoài phạm vi",
]
# ─────────────────────────────────────────


def _is_not_found(answer: str) -> bool:
    lower = answer.lower()
    return any(p in lower for p in NOT_FOUND_PHRASES)


def _keyword_score(answer: str, keywords: list[str]) -> float:
    """Tỷ lệ keyword kỳ vọng xuất hiện trong câu trả lời (0.0 – 1.0)."""
    if not keywords:
        return 1.0
    lower = answer.lower()
    hits = sum(1 for kw in keywords if kw.lower() in lower)
    return round(hits / len(keywords), 2)


def run_evaluation(allowed_doc_ids: list | None = None):
    questions = json.loads(EVAL_FILE.read_text(encoding="utf-8"))
    db = SessionLocal()

    results = []
    print(f"\n{'='*65}")
    print(f"  LOCAL AI — RAG EVALUATION  ({len(questions)} câu hỏi)")
    print(f"{'='*65}\n")

    for q in questions:
        qid = q["id"]
        question = q["question"]
        expected_kws = q.get("expected_keywords", [])
        expect_citation = q.get("expected_citation", True)
        is_out_of_scope = q.get("category") == "out_of_scope"

        print(f"[{qid}] {question[:70]}...")
        t0 = time.time()

        try:
            result = query_rag(
                query=question,
                db=db,
                allowed_doc_ids=allowed_doc_ids,
                conversation_history=[],
            )
        except Exception as e:
            print(f"  ✗ LỖI: {e}\n")
            results.append({
                "id": qid, "error": str(e),
                "latency": round(time.time() - t0, 2),
            })
            continue

        latency = round(time.time() - t0, 2)
        answer = result.get("answer", "")
        citations = result.get("citations", [])
        has_citation = len(citations) > 0
        not_found = _is_not_found(answer)
        kw_score = _keyword_score(answer, expected_kws)

        # Câu hỏi ngoài phạm vi: pass nếu bị từ chối đúng
        if is_out_of_scope:
            passed = not_found
            status = "✅ PASS (từ chối đúng)" if passed else "❌ FAIL (trả lời bậy)"
        else:
            # Câu hỏi trong phạm vi: pass nếu có nội dung + đủ keyword
            passed = (not not_found) and (kw_score >= 0.5)
            if not passed:
                if not_found:
                    status = "❌ FAIL (không tìm thấy)"
                else:
                    status = f"⚠️  PARTIAL (keyword={kw_score:.0%})"
            else:
                status = f"✅ PASS (keyword={kw_score:.0%})"

        citation_ok = has_citation == expect_citation
        citation_status = "✅" if citation_ok else "⚠️ "

        print(f"  {status} | {latency}s | Citation {citation_status} ({len(citations)} nguồn)")
        print(f"  Preview: {answer[:100].strip()}...")
        print()

        results.append({
            "id": qid,
            "category": q.get("category"),
            "question": question,
            "passed": passed,
            "is_out_of_scope": is_out_of_scope,
            "latency": latency,
            "has_citation": has_citation,
            "citation_ok": citation_ok,
            "keyword_score": kw_score,
            "answer_preview": answer[:200],
            "num_citations": len(citations),
        })

    db.close()
    _print_summary(results)
    _save_report(results)


def _print_summary(results: list):
    total = len(results)
    errors = [r for r in results if "error" in r]
    valid = [r for r in results if "error" not in r]
    in_scope = [r for r in valid if not r["is_out_of_scope"]]
    out_scope = [r for r in valid if r["is_out_of_scope"]]

    passed = sum(1 for r in valid if r.get("passed"))
    citation_ok = sum(1 for r in valid if r.get("citation_ok"))
    avg_latency = round(sum(r["latency"] for r in valid) / len(valid), 2) if valid else 0
    avg_kw = round(sum(r.get("keyword_score", 0) for r in in_scope) / len(in_scope), 2) if in_scope else 0
    hit_rate = round(sum(1 for r in in_scope if not _is_not_found(r.get("answer_preview", ""))) / len(in_scope), 2) if in_scope else 0
    rejection_rate = round(sum(1 for r in out_scope if r.get("passed")) / len(out_scope), 2) if out_scope else "N/A"

    print(f"\n{'='*65}")
    print(f"  KẾT QUẢ TỔNG HỢP")
    print(f"{'='*65}")
    print(f"  Tổng câu hỏi:          {total}")
    print(f"  Lỗi hệ thống:          {len(errors)}")
    print(f"  Pass rate:             {passed}/{len(valid)} ({passed/len(valid)*100:.0f}%)" if valid else "  Pass rate: N/A")
    print(f"  Hit rate (in-scope):   {hit_rate*100:.0f}%")
    print(f"  Rejection rate:        {rejection_rate*100:.0f}%" if isinstance(rejection_rate, float) else f"  Rejection rate: {rejection_rate}")
    print(f"  Keyword score (avg):   {avg_kw*100:.0f}%")
    print(f"  Citation accuracy:     {citation_ok}/{len(valid)} ({citation_ok/len(valid)*100:.0f}%)" if valid else "  Citation accuracy: N/A")
    print(f"  Latency trung bình:    {avg_latency}s")
    print(f"{'='*65}\n")


def _is_not_found_from_preview(preview: str) -> bool:
    return _is_not_found(preview)


def _save_report(results: list):
    out_path = Path(__file__).parent / "eval_report.json"
    out_path.write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  Báo cáo chi tiết lưu tại: {out_path}\n")


def show_saved_report():
    """Hiển thị kết quả từ lần chạy trước — dùng khi demo để tránh chờ LLM."""
    report_path = Path(__file__).parent / "eval_report.json"
    if not report_path.exists():
        print("Chưa có báo cáo. Chạy trước: python -m eval.evaluate_rag")
        return

    results = json.loads(report_path.read_text(encoding="utf-8"))
    questions = json.loads(EVAL_FILE.read_text(encoding="utf-8"))
    q_map = {q["id"]: q for q in questions}

    print(f"\n{'='*65}")
    print(f"  LOCAL AI — RAG EVALUATION  (kết quả đã lưu)")
    print(f"{'='*65}\n")

    for r in results:
        if "error" in r:
            print(f"[{r['id']}] ✗ LỖI: {r['error']}")
            continue

        qid = r["id"]
        q = q_map.get(qid, {})
        question = r.get("question", q.get("question", ""))
        passed = r.get("passed")
        latency = r.get("latency", 0)
        kw_score = r.get("keyword_score", 0)
        num_citations = r.get("num_citations", 0)
        is_out = r.get("is_out_of_scope", False)
        citation_ok = r.get("citation_ok", False)

        if is_out:
            status = "✅ PASS (từ chối đúng)" if passed else "❌ FAIL (trả lời bậy)"
        elif passed:
            status = f"✅ PASS (keyword={kw_score:.0%})"
        else:
            status = f"❌ FAIL (keyword={kw_score:.0%})"

        citation_status = "✅" if citation_ok else "⚠️ "
        print(f"[{qid}] {question[:68]}...")
        print(f"  {status} | {latency}s | Citation {citation_status} ({num_citations} nguồn)")
        preview = r.get("answer_preview", "")
        print(f"  Preview: {preview[:100].strip()}...")
        print()

    _print_summary(results)


if __name__ == "__main__":
    if "--show" in sys.argv:
        show_saved_report()
    else:
        # Chạy không giới hạn doc (admin mode) để đánh giá toàn bộ
        run_evaluation(allowed_doc_ids=None)
