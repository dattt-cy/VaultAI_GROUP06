"""
Quản lý ngữ cảnh hội thoại: load history, detect/rewrite ambiguous queries, expand queries.
"""
import re
from sqlalchemy.orm import Session
from app.models.chat_model import Message


# ---------------------------------------------------------------------------
# 1. Load conversation history
# ---------------------------------------------------------------------------

def load_conversation_history(db: Session, session_id: int, max_turns: int = 5) -> list[dict]:
    """
    Lấy tối đa max_turns lượt hội thoại gần nhất (1 lượt = 1 user + 1 assistant).
    Trả về list dict {"role": "user"|"assistant", "content": str} theo thứ tự cũ → mới.
    Token budget: mỗi message truncate 400 chars, tổng < 1200 tokens (~4800 chars).
    """
    if not session_id:
        return []

    rows = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
        .limit(max_turns * 2)
        .all()
    )
    rows = list(reversed(rows))

    history = []
    total_chars = 0
    MAX_CHARS = 4800  # ~1200 tokens

    for msg in rows:
        content = (msg.content or "").strip()[:400]
        chars = len(content)
        if total_chars + chars > MAX_CHARS:
            # Bỏ oldest turn nếu vượt budget
            if history:
                removed = history.pop(0)
                total_chars -= len(removed["content"])
            else:
                break
        history.append({"role": msg.sender_type, "content": content})
        total_chars += chars

    return history


def format_history_block(history: list[dict]) -> str:
    """Chuyển history list → text block để inject vào prompt.

    CHỈ đưa user questions vào — KHÔNG đưa assistant answers.
    Lý do: assistant answers chứa tên công ty/số liệu từ tài liệu khác,
    nếu đưa vào prompt sẽ khiến LLM dùng sai thông tin cho câu hỏi hiện tại.
    LLM vẫn hiểu ngữ cảnh (đại từ, chủ đề) qua các câu hỏi của user.
    """
    if not history:
        return ""
    user_lines = [
        f"Người dùng: {msg['content']}"
        for msg in history
        if msg["role"] == "user"
    ]
    if not user_lines:
        return ""
    return "[CÁC CÂU HỎI TRƯỚC ĐÓ TRONG HỘI THOẠI]\n" + "\n".join(user_lines) + "\n[HẾT]\n"


# ---------------------------------------------------------------------------
# 2. Detect ambiguous queries (cần rewrite)
# ---------------------------------------------------------------------------

_AMBIGUOUS_STARTS = (
    "còn", "vậy", "thế", "cụ thể", "ví dụ", "và ", "nhưng", "nếu vậy",
    "thế thì", "vậy thì", "ý bạn", "ý là",
    "nếu ", "nếu như ", "còn nếu ", "thế còn ",
)

_AMBIGUOUS_CONTAINS = (
    "nó", "họ", "điều đó", "điều này", "cái đó", "vấn đề trên",
    "như vậy", "thêm", "tiếp theo", "tại sao vậy",
    "văn bản này", "tài liệu này", "quy định này", "quy chế này",
    "chính sách này", "hướng dẫn này", "nội quy này",
)

# Các cụm này là follow-up rõ ràng, luôn cần rewrite nếu có history
_EXPLICIT_FOLLOWUP = (
    "chi tiết hơn", "cụ thể hơn", "giải thích thêm", "nói thêm",
    "kể thêm", "bổ sung thêm", "thêm thông tin", "biết thêm",
    "mở rộng thêm", "ví dụ thêm", "làm rõ hơn", "rõ hơn",
    "cho biết thêm", "nêu thêm", "phân tích thêm",
)


_YES_NO_PATTERNS = [
    r"có được (chấp nhận|phép|không)\??$",
    r"có (vi phạm|cho phép|hợp lệ|được phép) không\??$",
    r"(có|được) \w+ không\??$",
    r"\w+ có được không\??$",
    r"(có thể|được phép) \w+ không\??$",
]


def is_yes_no_query(query: str) -> bool:
    """Trả True nếu câu hỏi dạng Yes/No cần suy luận từ quy định."""
    q = query.strip().lower()
    return any(re.search(p, q) for p in _YES_NO_PATTERNS)


_YES_NO_SUFFIXES = re.compile(
    r'\s+(có được (chấp nhận|phép|không)|có (vi phạm|cho phép|hợp lệ|được phép) không'
    r'|(có thể|được phép) \w+ không|có được không)\??$',
    re.IGNORECASE,
)


def extract_yes_no_topic(query: str) -> str:
    """
    Trích topic từ câu hỏi Yes/No để dùng làm retrieval query.
    VD: "Chụp ảnh màn hình có được chấp nhận không" → "Chụp ảnh màn hình"
    """
    topic = _YES_NO_SUFFIXES.sub("", query.strip())
    return topic.strip() if topic.strip() else query


def needs_rewrite(query: str, history: list[dict]) -> bool:
    """
    Trả True nếu query có khả năng mơ hồ và cần rewrite dựa trên history.
    Cần ít nhất 2 dấu hiệu để tránh false positive.
    Câu hỏi Yes/No dạng "X có được không?" luôn được rewrite thành dạng keyword search.
    Explicit follow-up ("chi tiết hơn", "giải thích thêm"...) luôn trigger rewrite.
    """
    if not history:
        return False

    q = query.strip().lower()

    # Explicit follow-up: luôn cần rewrite vì không có topic riêng
    if any(s in q for s in _EXPLICIT_FOLLOWUP):
        return True

    score = 0

    if len(q) < 25:
        score += 1

    if any(q.startswith(s) for s in _AMBIGUOUS_STARTS):
        score += 1

    if any(s in q for s in _AMBIGUOUS_CONTAINS):
        score += 1

    # Câu hỏi chỉ có dấu hỏi cuối, rất ngắn
    if re.match(r'^[\w\s]{1,15}\?$', query.strip()):
        score += 1

    # Câu hỏi Yes/No dạng "X có được không?" — rewrite để khớp keyword search tốt hơn
    if any(re.search(p, q) for p in _YES_NO_PATTERNS):
        score += 2

    return score >= 2


# ---------------------------------------------------------------------------
# 3. Rewrite ambiguous query thành câu hỏi độc lập
# ---------------------------------------------------------------------------

_REWRITE_TEMPLATE = """Dựa vào lịch sử hội thoại, hãy viết lại câu hỏi sau thành một câu hỏi hoàn chỉnh, độc lập, không cần ngữ cảnh để hiểu.

QUY TẮC QUAN TRỌNG:
- Nếu câu hỏi gốc có từ "chi tiết hơn", "cụ thể hơn", "giải thích thêm", "nói thêm", "đầy đủ hơn" → người dùng muốn biết NHIỀU HƠN những gì đã được trả lời. Hãy viết lại thành câu hỏi yêu cầu liệt kê ĐẦY ĐỦ / TOÀN BỘ thông tin về CHỦ ĐỀ CHUNG, không giới hạn vào mục cụ thể đã hỏi trước.
- Ví dụ: Lịch sử hỏi "nguyên tắc thứ hai là gì?", câu hỏi gốc "chi tiết hơn về nguyên tắc cơ bản" → viết lại: "Liệt kê và giải thích chi tiết TẤT CẢ các nguyên tắc cơ bản của nội quy"
- Ví dụ: Lịch sử hỏi "quyền lợi nhân viên là gì?", câu hỏi gốc "nói thêm về quyền lợi" → viết lại: "Liệt kê đầy đủ tất cả quyền lợi của nhân viên theo quy định"
- Chỉ trả về câu hỏi đã viết lại, không giải thích, không thêm nội dung nào khác.

Lịch sử hội thoại:
{history}

Câu hỏi gốc: {query}
Câu hỏi đã viết lại:"""


def rewrite_query(query: str, history: list[dict], llm_invoke_fn) -> str:
    """
    Dùng LLM viết lại query mơ hồ thành câu hỏi đầy đủ.
    Fallback về query gốc nếu LLM fail hoặc kết quả không hợp lệ.
    """
    try:
        history_text = "\n".join(
            f"{'Người dùng' if m['role'] == 'user' else 'Trợ lý'}: {m['content']}"
            for m in history[-6:]  # Chỉ lấy 3 lượt gần nhất để tiết kiệm token
        )
        prompt = _REWRITE_TEMPLATE.format(history=history_text, query=query)
        result = llm_invoke_fn(prompt)
        result = result.strip().splitlines()[0].strip() if result.strip() else ""

        # Validation: không chấp nhận nếu quá dài, rỗng, hoặc LLM bối rối
        if not result:
            return query
        if len(result) > len(query) * 6:
            return query
        if any(bad in result.lower() for bad in ["tôi không thể", "tôi không hiểu", "xin lỗi"]):
            return query

        return result
    except Exception as e:
        print(f"[QueryRewrite ERROR] {e}")
        return query


# ---------------------------------------------------------------------------
# 4. Expand query thành nhiều biến thể (cho adaptive retrieval)
# ---------------------------------------------------------------------------

_EXPAND_TEMPLATE = """Tạo 2 cách diễn đạt khác nhau của câu hỏi sau để tìm kiếm trong tài liệu nội bộ tiếng Việt.

Yêu cầu:
- Thay thế từ tiếng Anh / thuật ngữ kỹ thuật bằng từ tiếng Việt tương đương thường dùng trong tài liệu công ty (ví dụ: "flash drive" → "USB", "laptop" → "máy tính xách tay", "backup" → "sao lưu", "email" → "thư điện tử").
- Dùng từ ngữ khác nhau nhưng cùng ý nghĩa.
- Mỗi câu một dòng, không đánh số, không giải thích, không thêm nội dung khác.

Câu hỏi gốc: {query}
2 biến thể:"""


def expand_query(query: str, llm_invoke_fn) -> list[str]:
    """
    Trả về [original_query, variant_1, variant_2].
    Nếu LLM fail, chỉ trả về [original_query].
    """
    try:
        prompt = _EXPAND_TEMPLATE.format(query=query)
        result = llm_invoke_fn(prompt)
        variants = [
            line.strip()
            for line in result.strip().splitlines()
            if line.strip() and len(line.strip()) > 5
        ][:2]
        return [query] + variants if variants else [query]
    except Exception as e:
        print(f"[QueryExpand ERROR] {e}")
        return [query]
