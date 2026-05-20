"""
Legal Importer
==============
Kết nối trực tiếp với API backend của vbpl.vn
(https://vbpl-bientap-gateway.moj.gov.vn/api)
để tìm kiếm và tải toàn văn văn bản pháp luật Việt Nam.

API nội bộ:
  search_legal_docs(keyword, max_results=10) -> list[LegalDocResult]
  download_legal_doc(item_id, save_dir) -> (file_path, title)
"""

import os
import re
import time
from dataclasses import dataclass

import requests
from bs4 import BeautifulSoup

API_BASE = "https://vbpl-bientap-gateway.moj.gov.vn/api"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://vbpl.vn",
    "Referer": "https://vbpl.vn/",
}
TIMEOUT = 20


@dataclass
class LegalDocResult:
    item_id: str
    title: str
    doc_type: str
    issued_date: str
    agency: str
    url: str
    abstract: str


def search_legal_docs(keyword: str, max_results: int = 10) -> list[LegalDocResult]:
    """
    Tìm kiếm văn bản pháp luật trên vbpl.vn theo từ khóa.
    Trả về tối đa max_results kết quả.
    """
    payload = {
        "page": 1,
        "pageSize": max_results,
        "keywordQuickSearch": keyword,
        "scopeArea": "TRUNG_UONG",
    }
    try:
        resp = requests.post(
            f"{API_BASE}/qtdc/public/doc/all",
            headers=HEADERS,
            json=payload,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        raise ConnectionError(f"Không thể kết nối vbpl.vn: {e}") from e

    data = resp.json()
    if not data.get("success") and str(data.get("success", "")).lower() != "true":
        raise ConnectionError(f"API lỗi: {data.get('message', 'Unknown error')}")

    items = data.get("data", {}).get("items", [])
    results: list[LegalDocResult] = []

    for item in items[:max_results]:
        item_id = str(item.get("id", ""))
        title = item.get("title", "").strip()
        if not item_id or not title:
            continue

        doc_type = ""
        dt = item.get("docType")
        if isinstance(dt, dict):
            doc_type = dt.get("name", "")
        elif isinstance(dt, str):
            doc_type = dt

        issued_date = ""
        raw_date = item.get("issueDate") or item.get("publicDate") or ""
        if raw_date:
            issued_date = str(raw_date)[:10]  # YYYY-MM-DD

        agency = item.get("agencyName", "") or ""
        abstract = (item.get("docAbs") or "")[:200]
        url = f"https://vbpl.vn/van-ban/chi-tiet/{item_id}"

        results.append(LegalDocResult(
            item_id=item_id,
            title=title,
            doc_type=doc_type,
            issued_date=issued_date,
            agency=agency,
            url=url,
            abstract=abstract,
        ))

    return results


def _html_to_plain_text(html: str) -> str:
    """Chuyển HTML toàn văn thành plain text sạch."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup.select("script, style"):
        tag.decompose()
    text = soup.get_text(separator="\n")
    lines = [l.strip() for l in text.splitlines()]
    cleaned: list[str] = []
    prev_blank = False
    for line in lines:
        if not line:
            if not prev_blank:
                cleaned.append("")
            prev_blank = True
        else:
            cleaned.append(line)
            prev_blank = False
    return "\n".join(cleaned).strip()


def download_legal_doc(item_id: str, save_dir: str) -> tuple[str, str]:
    """
    Tải toàn văn một văn bản pháp luật từ API vbpl.vn theo item_id.
    Lưu thành file .txt trong save_dir.
    Trả về (file_path, title).
    """
    try:
        resp = requests.get(
            f"{API_BASE}/qtdc/public/doc/{item_id}",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        raise ConnectionError(f"Không tải được id={item_id}: {e}") from e

    data = resp.json().get("data", {})
    if not data:
        raise ValueError(f"Không có dữ liệu cho id={item_id}")

    title = data.get("title", f"VanBan_{item_id}").strip()
    agency = data.get("agencyName", "")
    issued_date = str(data.get("issueDate", "") or "")[:10]

    doc_type = ""
    dt = data.get("docType")
    if isinstance(dt, dict):
        doc_type = dt.get("name", "")

    # Lấy nội dung HTML
    content_obj = data.get("documentContent") or {}
    html_content = ""
    if isinstance(content_obj, dict):
        html_content = content_obj.get("content") or content_obj.get("html") or ""
    elif isinstance(content_obj, str):
        html_content = content_obj

    if html_content:
        body_text = _html_to_plain_text(html_content)
    else:
        body_text = data.get("docAbs") or "Không có nội dung toàn văn."

    # Xây dựng nội dung file
    header = "\n".join(filter(None, [
        title,
        "=" * 60,
        f"Loại văn bản: {doc_type}" if doc_type else "",
        f"Cơ quan ban hành: {agency}" if agency else "",
        f"Ngày ban hành: {issued_date}" if issued_date else "",
        f"Nguồn: https://vbpl.vn/van-ban/chi-tiet/{item_id}",
        "",
    ]))
    full_text = header + "\n" + body_text

    # Tên file an toàn
    safe_name = re.sub(r'[\\/:*?"<>|]', "_", title[:60])
    safe_name = re.sub(r"\s+", "_", safe_name).strip("_")
    file_path = os.path.join(save_dir, f"vbpl_{item_id}_{safe_name}.txt")

    os.makedirs(save_dir, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(full_text)

    time.sleep(0.3)
    return file_path, title
