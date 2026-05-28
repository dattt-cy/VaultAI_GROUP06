"""
Admin Ollama Routes – /api/admin/ollama/*
Quản lý model Ollama: liệt kê, pull, xóa.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import json

from app.core.config import settings
from app.api.dependencies import require_min_level

router = APIRouter()

OLLAMA_URL = settings.OLLAMA_BASE_URL


class PullModelRequest(BaseModel):
    model_name: str


# ─────────────────────────────────────────────
# GET /ollama/models — list installed models
# ─────────────────────────────────────────────
@router.get("/ollama/models", summary="Liệt kê model Ollama", dependencies=[Depends(require_min_level(9))])
async def list_ollama_models():
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            models = data.get("models", [])
            result = []
            for m in models:
                size_gb = round(m.get("size", 0) / (1024 ** 3), 2)
                result.append({
                    "name": m.get("name"),
                    "size_gb": size_gb,
                    "modified_at": m.get("modified_at"),
                    "digest": m.get("digest", "")[:12],
                    "details": m.get("details", {}),
                })
            return {"models": result}
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Không thể kết nối Ollama. Kiểm tra service đang chạy.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# POST /ollama/models/pull — pull model (streaming progress)
# ─────────────────────────────────────────────
@router.post("/ollama/models/pull", summary="Pull model Ollama", dependencies=[Depends(require_min_level(9))])
async def pull_ollama_model(body: PullModelRequest):
    model_name = body.model_name.strip()
    if not model_name:
        raise HTTPException(status_code=400, detail="Tên model không được để trống.")

    async def stream_pull():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_URL}/api/pull",
                    json={"name": model_name},
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line:
                            yield f"data: {line}\n\n"
            yield "data: {\"status\": \"done\"}\n\n"
        except httpx.ConnectError:
            yield 'data: {"error": "Không thể kết nối Ollama"}\n\n'
        except Exception as e:
            yield f'data: {{"error": "{str(e)}"}}\n\n'

    return StreamingResponse(
        stream_pull(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────
# DELETE /ollama/models/{model_name} — xóa model
# ─────────────────────────────────────────────
@router.delete("/ollama/models/{model_name:path}", summary="Xóa model Ollama", dependencies=[Depends(require_min_level(9))])
async def delete_ollama_model(model_name: str):
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(
                "DELETE",
                f"{OLLAMA_URL}/api/delete",
                content=json.dumps({"name": model_name}),
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Model '{model_name}' không tồn tại.")
            resp.raise_for_status()
            return {"message": f"Đã xóa model '{model_name}' thành công."}
    except HTTPException:
        raise
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Không thể kết nối Ollama.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
