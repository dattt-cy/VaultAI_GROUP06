import hashlib
import os
import pdfplumber
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ---------------------------------------------------------------------------
# EasyOCR – Lazy-loaded singleton (chỉ load khi cần, chạy trên CPU)
# ---------------------------------------------------------------------------
_ocr_reader = None


def _get_ocr_reader():
    """Lazy-load EasyOCR Reader. Chỉ khởi tạo 1 lần duy nhất."""
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        print("[OCR] Đang khởi tạo EasyOCR (lang=vi, CPU)...")
        _ocr_reader = easyocr.Reader(
            ["vi"],       # Tiếng Việt
            gpu=False,    # CPU – không chiếm GPU của LLM
        )
        print("[OCR] EasyOCR đã sẵn sàng.")
    return _ocr_reader


def generate_file_hash(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()


def extract_text_from_pdf(file_path: str) -> str:
    """Legacy: trả về toàn bộ text gộp (dùng cho backward compat)."""
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


# ---------------------------------------------------------------------------
# Trích xuất text từng trang – pdfplumber + OCR fallback
# ---------------------------------------------------------------------------

def extract_pages_from_pdf(file_path: str) -> list[tuple[int, str]]:
    """
    Trích xuất text TỪNG TRANG PDF.
    Chiến lược: pdfplumber trước → nếu không có text → fallback sang EasyOCR.
    Trả về: [(page_number, page_text), ...]
    page_number bắt đầu từ 1.
    """
    pages = _extract_pages_pdfplumber(file_path)

    if not pages:
        # Scanned PDF → chuyển sang OCR
        print(f"[PDF] pdfplumber không trích được text → chuyển sang EasyOCR...")
        pages = extract_pages_from_pdf_ocr(file_path)

    return pages


def _extract_pages_pdfplumber(file_path: str) -> list[tuple[int, str]]:
    """Trích text bằng pdfplumber (nhanh, cho PDF có text layer)."""
    pages = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            page_text = page.extract_text()
            if page_text and page_text.strip():
                pages.append((i, page_text))
    return pages


def extract_pages_from_pdf_ocr(file_path: str) -> list[tuple[int, str]]:
    """
    OCR fallback: Chuyển từng trang PDF thành ảnh rồi dùng EasyOCR quét text.
    Sử dụng PyMuPDF (fitz) để render PDF → ảnh (không cần Poppler).
    Trả về: [(page_number, page_text), ...]
    """
    import fitz  # PyMuPDF
    import numpy as np
    from PIL import Image
    import io

    reader = _get_ocr_reader()
    pages = []

    doc = fitz.open(file_path)
    total_pages = len(doc)
    print(f"[OCR] Bắt đầu quét {total_pages} trang...")

    for i, fitz_page in enumerate(doc, start=1):
        # Render trang thành ảnh (300 DPI cho accuracy cao)
        pix = fitz_page.get_pixmap(dpi=300)
        img_bytes = pix.tobytes("png")

        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_np = np.array(img)

        # Chạy OCR – EasyOCR trả về list of (bbox, text, confidence)
        result = reader.readtext(img_np, detail=1, paragraph=False)

        # Ghép text từ kết quả OCR
        page_lines = [entry[1] for entry in result if entry[2] > 0.1]
        page_text = "\n".join(page_lines)

        if page_text and page_text.strip():
            pages.append((i, page_text))
            print(f"[OCR] Trang {i}/{total_pages}: {len(page_text)} ký tự")
        else:
            print(f"[OCR] Trang {i}/{total_pages}: (trống / chỉ có hình ảnh)")

    doc.close()
    print(f"[OCR] Hoàn tất: {len(pages)}/{total_pages} trang có nội dung.")
    return pages


def chunk_text_parent_child(text: str) -> list[dict]:
    """
    Parent-child chunking cho non-PDF.
    Mỗi parent (~800 chars) được chia thành các child (~300 chars).
    Child dùng để embed/retrieval; parent dùng làm LLM context.

    Trả về list dicts: [{text, chunk_type, parent_index, page_number}]
    """
    from app.core.config import settings

    parent_splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.PARENT_CHUNK_SIZE,
        chunk_overlap=settings.PARENT_CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""],
    )
    child_splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHILD_CHUNK_SIZE,
        chunk_overlap=settings.CHILD_CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""],
    )

    result = []
    parents = parent_splitter.split_text(text)
    for p_idx, parent_text in enumerate(parents):
        result.append({
            "text": parent_text,
            "chunk_type": "parent",
            "parent_index": p_idx,
            "page_number": 1,
        })
        for child_text in child_splitter.split_text(parent_text):
            result.append({
                "text": child_text,
                "chunk_type": "child",
                "parent_index": p_idx,
                "page_number": 1,
            })
    return result


def chunk_pages_parent_child(pages: list[tuple[int, str]]) -> list[dict]:
    """
    Parent-child chunking cho PDF (giữ page_number thật).
    parent_index là global xuyên suốt tài liệu (không reset theo trang).

    Trả về list dicts: [{text, chunk_type, parent_index, page_number}]
    """
    from app.core.config import settings

    parent_splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.PARENT_CHUNK_SIZE,
        chunk_overlap=settings.PARENT_CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""],
    )
    child_splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHILD_CHUNK_SIZE,
        chunk_overlap=settings.CHILD_CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""],
    )

    result = []
    global_parent_idx = 0
    for page_num, page_text in pages:
        for parent_text in parent_splitter.split_text(page_text):
            result.append({
                "text": parent_text,
                "chunk_type": "parent",
                "parent_index": global_parent_idx,
                "page_number": page_num,
            })
            for child_text in child_splitter.split_text(parent_text):
                result.append({
                    "text": child_text,
                    "chunk_type": "child",
                    "parent_index": global_parent_idx,
                    "page_number": page_num,
                })
            global_parent_idx += 1
    return result


def chunk_text(text: str) -> list[str]:
    """Legacy: chunk text thuần (không kèm page info)."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    chunks = text_splitter.split_text(text)
    return chunks


def chunk_text_with_pages(pages: list[tuple[int, str]]) -> list[dict]:
    """
    Chunk text nhưng GIỮ NGUYÊN mapping trang gốc.
    
    Input:  [(page_number, page_text), ...]
    Output: [{"text": "...", "page_number": int, "pages": [int, ...]}, ...]
    
    Chiến lược: Mỗi trang được chunk riêng. Nếu 1 trang quá dài, sẽ tách thành
    nhiều chunk nhỏ nhưng tất cả đều mang cùng page_number.
    Chunk overlap sẽ được xử lý trong phạm vi từng trang.
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    
    result = []
    for page_num, page_text in pages:
        sub_chunks = text_splitter.split_text(page_text)
        for sub in sub_chunks:
            result.append({
                "text": sub,
                "page_number": page_num,
            })
    
    return result
