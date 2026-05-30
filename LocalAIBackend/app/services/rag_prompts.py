"""RAG prompt templates, intent keywords, and intent detectors."""
from langchain_core.prompts import PromptTemplate

_SUMMARY_KEYWORDS = [
    "tóm tắt", "tổng hợp", "tổng quan", "tóm lược", "tóm gọn",
    "nội dung chính", "ý chính", "điểm chính", "khái quát",
    "summarize", "summary", "overview",
]

_TABLE_KEYWORDS = [
    "lập bảng", "tạo bảng", "liệt kê", "danh sách", "thống kê",
    "bảng tổng hợp", "bảng so sánh", "liệt kê tất cả", "danh sách tất cả",
    "bảng danh sách", "tổng hợp danh sách", "bảng thống kê",
    "list all", "tabulate", "make a table",
]

_ENUMERATION_KEYWORDS = [
    "những gì", "những gì?", "gồm những", "bao gồm những", "có những",
    "các quyền", "các nghĩa vụ", "các chính sách", "các quy định",
    "hỗ trợ gì", "được gì", "có gì", "gồm gì", "bao gồm gì",
    "nêu hết", "kể hết", "tất cả các", "toàn bộ các",
    "what are", "what does", "list of", "all the",
]

_LOCATING_KEYWORDS = [
    "ở đâu", "điều mấy", "khoản mấy", "mục mấy", "tại điều", "nằm ở",
    "quy định tại", "được quy định ở", "thuộc điều", "theo điều mấy",
    "thuộc khoản", "thuộc mục", "ở điều", "ở khoản",
]

_COMPARISON_KEYWORDS = [
    "khác nhau", "so sánh", "phân biệt", "giống nhau", "điểm khác",
    "khác gì", "giống gì", "điểm giống", "so với", "khác như thế nào",
    "giống như thế nào", "điểm tương đồng", "điểm khác biệt",
]

_PROCEDURE_KEYWORDS = [
    "làm thế nào", "làm như thế nào", "quy trình", "các bước", "thủ tục",
    "tiến hành như thế nào", "từng bước", "hướng dẫn", "cách thực hiện",
    "cách tiến hành", "cần làm gì", "phải làm gì", "thực hiện như thế nào",
    "cách làm", "làm sao",
]

_CONDITION_KEYWORDS = [
    "khi nào", "trường hợp nào", "điều kiện nào", "khi nào thì",
    "trong trường hợp nào", "điều kiện để", "khi nào được",
    "áp dụng khi nào", "áp dụng cho ai", "đối tượng nào",
]

_NUMERIC_KEYWORDS = [
    "bao nhiêu", "mấy ngày", "mấy tháng", "mấy năm", "mấy giờ", "mấy lần",
    "mức phạt", "thời hạn", "hạn mức", "tối đa", "tối thiểu",
    "giới hạn", "ngưỡng", "số tiền", "mức", "hạn chế",
]

_NEGATION_KEYWORDS = [
    "không được phép", "bị cấm", "không có quyền", "không được làm",
    "ngoại lệ", "trường hợp nào không", "miễn trừ", "không áp dụng",
    "loại trừ", "nghiêm cấm", "cấm làm", "không cho phép",
]


def is_enumeration_intent(query: str) -> bool:
    """Phát hiện câu hỏi liệt kê nhiều mục — cần lấy nhiều chunk hơn."""
    lower = query.lower()
    return any(k in lower for k in _ENUMERATION_KEYWORDS)


def is_summary_intent(query: str) -> bool:
    lower = query.lower()
    return any(k in lower for k in _SUMMARY_KEYWORDS)


def is_table_intent(query: str) -> bool:
    lower = query.lower()
    return any(k in lower for k in _TABLE_KEYWORDS)


def is_locating_intent(query: str) -> bool:
    """Câu hỏi chỉ cần tìm vị trí (điều mấy, ở đâu) — không cần nhiều chunk."""
    lower = query.lower()
    return any(k in lower for k in _LOCATING_KEYWORDS)


def is_comparison_intent(query: str) -> bool:
    """Câu hỏi so sánh hai đối tượng — cần prompt định dạng bảng/cột."""
    lower = query.lower()
    return any(k in lower for k in _COMPARISON_KEYWORDS)


def is_procedure_intent(query: str) -> bool:
    """Câu hỏi về quy trình/thủ tục — cần trình bày theo thứ tự bước."""
    lower = query.lower()
    return any(k in lower for k in _PROCEDURE_KEYWORDS)


def is_condition_intent(query: str) -> bool:
    """Câu hỏi về điều kiện/trường hợp áp dụng — cần liệt kê riêng từng điều kiện."""
    lower = query.lower()
    return any(k in lower for k in _CONDITION_KEYWORDS)


def is_numeric_intent(query: str) -> bool:
    """Câu hỏi về số liệu/ngưỡng/thời hạn — cần bôi đậm số liệu và suy luận ngưỡng."""
    lower = query.lower()
    return any(k in lower for k in _NUMERIC_KEYWORDS)


def is_negation_intent(query: str) -> bool:
    """Câu hỏi về điều cấm/ngoại lệ — cần nêu rõ cả phần cấm lẫn ngoại lệ."""
    lower = query.lower()
    return any(k in lower for k in _NEGATION_KEYWORDS)


def get_intent_instruction(query: str) -> str:
    """
    Trả về instruction bổ sung tương ứng với intent được phát hiện.
    Kết quả được inject vào QA_PROMPT để tăng độ chính xác theo từng loại câu hỏi.
    """
    instructions = []
    if is_procedure_intent(query):
        instructions.append(
            "- QUY TRÌNH/THỦ TỤC: Trình bày theo thứ tự **Bước 1 → Bước 2 → Bước 3...** "
            "đúng theo thứ tự trong tài liệu. Mỗi bước là một bullet riêng. "
            "Không gộp nhiều bước vào một bullet."
        )
    if is_condition_intent(query):
        instructions.append(
            "- ĐIỀU KIỆN/TRƯỜNG HỢP: Mỗi điều kiện hoặc trường hợp áp dụng phải là "
            "một bullet riêng biệt, không gộp chung. Liệt kê ĐẦY ĐỦ tất cả điều kiện "
            "có trong tài liệu, không bỏ sót."
        )
    if is_negation_intent(query):
        instructions.append(
            "- CẤM/NGOẠI LỆ: PHẢI nêu rõ (1) điều bị cấm/không được phép, "
            "VÀ (2) nếu tài liệu có quy định ngoại lệ/miễn trừ thì liệt kê luôn. "
            "Không bỏ qua phần ngoại lệ."
        )
    if is_numeric_intent(query):
        instructions.append(
            "- SỐ LIỆU: Tất cả số tiền, thời hạn, tỷ lệ, ngưỡng giá trị PHẢI được "
            "bôi đậm (**...**). Nếu câu hỏi nêu một con số cụ thể, xác định rõ con số "
            "đó thuộc khoảng/ngưỡng nào trong tài liệu trước khi nêu quy định áp dụng."
        )
    return "\n".join(instructions)


TABLE_EXTRACTION_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""Bạn là chuyên gia trích xuất dữ liệu có cấu trúc từ tài liệu nội bộ.

--- NỘI DUNG TÀI LIỆU ---
{context}
--------------------------

Yêu cầu của người dùng: {question}

Nhiệm vụ: Trích xuất tất cả thực thể/mục phù hợp từ tài liệu thành bảng JSON có cấu trúc.

QUY TẮC:
- Chỉ trích xuất thông tin CÓ TRONG tài liệu, không bịa thêm bất kỳ thông tin nào.
- Nếu một ô không có thông tin → điền "—"
- Tự xác định tên cột phù hợp với nội dung và yêu cầu của người dùng.
- Mỗi thực thể riêng biệt là một hàng.
- Tên cột viết ngắn gọn, rõ ràng bằng tiếng Việt.
- Tiêu đề bảng mô tả nội dung bảng trong 5-8 từ.

Trả về ĐÚNG FORMAT JSON sau đây, KHÔNG thêm bất kỳ text giải thích nào:

{{
  "title": "Tiêu đề bảng ngắn gọn",
  "columns": ["Tên cột 1", "Tên cột 2", "Tên cột 3"],
  "rows": [
    ["giá trị 1", "giá trị 2", "giá trị 3"],
    ["giá trị 1", "giá trị 2", "giá trị 3"]
  ]
}}"""
)


SUMMARY_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""Bạn là chuyên gia phân tích tài liệu. Dưới đây là nội dung các đoạn trích từ tài liệu.

--- NỘI DUNG TÀI LIỆU ---
{context}
--------------------------

Nhiệm vụ: {question}

Hãy trả lời câu hỏi và tổng hợp nội dung dựa trên các đoạn trích trên.
Trình bày một cách tự nhiên, rõ ràng, vào thẳng vấn đề. Sử dụng dấu gạch đầu dòng (-) nếu cần liệt kê nhiều ý để dễ đọc.

Chỉ dùng thông tin từ các đoạn trích. Không bịa thêm. Viết hoàn toàn bằng tiếng Việt.

Tóm tắt:"""
)


COMPARISON_PROMPT = PromptTemplate(
    input_variables=["context", "history_block", "question"],
    template="""Bạn là chuyên gia phân tích tài liệu nội bộ. Đọc KỸ LƯỠNG tất cả các đoạn tài liệu trong NGỮ CẢNH trước khi trả lời. Chỉ dùng thông tin từ NGỮ CẢNH bên dưới. Không bịa thêm bất kỳ thông tin nào.

--- NGỮ CẢNH ---
{context}
-----------------

{history_block}
Câu hỏi: {question}

QUY TẮC:
- TUYỆT ĐỐI không lặp lại câu hỏi ở đầu câu trả lời.
- SO SÁNH: Trình bày rõ ràng theo 2 phần: **Điểm giống nhau** và **Điểm khác nhau**. Mỗi điểm là một bullet riêng.
- Nếu tài liệu chỉ có thông tin về một trong hai đối tượng → trình bày thông tin có, và ghi rõ đối tượng còn lại không có trong tài liệu. KHÔNG bịa.
- Nhãn nguồn [A]/[B]/[C]: đặt ở cuối mỗi bullet, không xếp chồng.
- KHÔNG viết tên file tài liệu vào câu trả lời.
- KHÔNG viết dòng "[Nguồn: ...]" hay bất kỳ dòng tổng kết nguồn nào.

VÍ DỤ FORMAT:
**Điểm giống nhau:**
- Cả hai đều áp dụng cho nhân viên chính thức. [A]

**Điểm khác nhau:**
- Hợp đồng thử việc: thời hạn tối đa **60 ngày**. [A]
- Hợp đồng chính thức: không giới hạn thời hạn. [B]
"""
)


QA_PROMPT = PromptTemplate(
    input_variables=["context", "history_block", "question", "intent_instruction"],
    template="""Bạn là chuyên gia phân tích tài liệu nội bộ. Đọc KỸ LƯỠNG tất cả các đoạn tài liệu trong NGỮ CẢNH trước khi trả lời. Chỉ dùng thông tin từ NGỮ CẢNH bên dưới. Không bịa thêm bất kỳ thông tin nào.

--- NGỮ CẢNH ---
{context}
-----------------

{history_block}
Câu hỏi: {question}

QUY TẮC:
- TUYỆT ĐỐI không bắt đầu bằng "Q:", "A:", "Câu hỏi:", "Trả lời:", hoặc tiêu đề điều khoản như "Điều 1", "Điều 1.1", "Khoản 2", "Mục 3" — viết thẳng nội dung.
- TUYỆT ĐỐI không lặp lại câu hỏi của người dùng ở đầu câu trả lời. Bắt đầu ngay bằng nội dung trả lời. Số điều chỉ được nhắc đến BÊN TRONG câu khi cần thiết, không dùng làm tiêu đề độc lập.
- CHỈ TRẢ LỜI ĐÚNG NHỮNG GÌ ĐƯỢC HỎI. Nếu câu hỏi hỏi về X, chỉ trả lời về X — không tự thêm thông tin về Y, Z dù chúng xuất hiện trong tài liệu gần đó.
- Ý ĐỊNH CHI TIẾT (ƯU TIÊN CAO NHẤT): Nếu câu hỏi chứa từ "chi tiết", "cụ thể", "đầy đủ", "liệt kê", "nêu hết", "kể chi tiết", "toàn bộ nội dung" — PHẢI trích dẫn và trình bày ĐẦY ĐỦ nội dung từ NGỮ CẢNH. KHÔNG ĐƯỢC chỉ ghi số điều/khoản rồi dừng. Phải kể ra nội dung thực sự của điều đó.
- Ý ĐỊNH NGẮN GỌN: Nếu câu hỏi dùng từ như "chỉ cần", "ngắn gọn", "tóm tắt", "tại điều mấy", "ở đâu", "là gì" theo nghĩa định vị — chỉ trả lời đúng phần được hỏi (VD: tên điều khoản, số điều, tên tài liệu), KHÔNG liệt kê nội dung chi tiết bên trong. QUY TẮC NÀY KHÔNG ÁP DỤNG nếu câu hỏi đã kích hoạt Ý ĐỊNH CHI TIẾT.
- DANH SÁCH ĐẦY ĐỦ: Nếu NGỮ CẢNH chứa nhiều mục/điểm liên quan đến câu hỏi (dù có đánh số hay không, dù là bullet hay đoạn văn riêng biệt), PHẢI liệt kê TẤT CẢ — không được bỏ sót, không được gộp, không được viết "..." hay "và các mục khác". Ví dụ: câu hỏi về "nội dung hợp đồng" và tài liệu liệt kê 9 điểm → phải trả lời đủ 9 điểm. NGOẠI LỆ: nếu câu hỏi kích hoạt quy tắc Ý ĐỊNH NGẮN GỌN ở trên, bỏ qua quy tắc này.
- ƯU TIÊN SỬ DỤNG suy luận logic: Nếu NGỮ CẢNH đề cập đến chủ đề liên quan (dù dùng từ ngữ khác nhau), hãy suy luận và trả lời. Ví dụ: tài liệu nói "IT thực hiện backup" → có thể trả lời "IT chịu trách nhiệm khôi phục".
- SUY LUẬN NGƯỠNG/KHOẢNG GIÁ TRỊ: Khi câu hỏi đề cập một số cụ thể (ví dụ: "30 triệu", "150 ngày"), PHẢI xác định rõ số đó thuộc khoảng nào trong bảng/danh sách ngưỡng của tài liệu TRƯỚC, sau đó mới nêu quy định áp dụng. KHÔNG được nêu quy định của khoảng khác. Ví dụ: bảng có "5–20 triệu: A" và "20–100 triệu: B", câu hỏi hỏi về 30 triệu → 30 triệu ∈ [20–100 triệu] → áp dụng quy định B, KHÔNG phải A.
- SUY LUẬN DANH SÁCH ĐÓNG: Nếu NGỮ CẢNH liệt kê rõ những gì được phép/khuyến nghị (VD: "chỉ dùng A hoặc B"), và câu hỏi hỏi về X không có trong danh sách đó → kết luận dứt khoát "Không được phép" và giải thích chỉ A, B mới được phép. KHÔNG được nói "không đề cập trong tài liệu" khi đã có danh sách rõ ràng.
- Chỉ từ chối khi NGỮ CẢNH HOÀN TOÀN KHÔNG ĐỀ CẬP đến chủ đề câu hỏi. Nếu có thông tin liên quan dù gián tiếp, hãy trả lời và giải thích suy luận.
- Nếu ngữ cảnh THỰC SỰ KHÔNG CÓ thông tin liên quan → chỉ viết duy nhất: "Tôi không tìm thấy thông tin này trong tài liệu được cung cấp." KHÔNG được viết câu này kèm với nội dung trả lời khác.
- Chọn định dạng phù hợp với độ phức tạp của câu trả lời:
  - **1 ý đơn giản** → viết thành 1-2 câu tự nhiên, KHÔNG dùng bullet. Ví dụ: "Độ dài tối thiểu của mật khẩu là **12 ký tự**. [A]"
  - **Nhiều ý / quy trình / danh sách** → dùng bullet (-), bôi đậm (**...**) số tiền/ngưỡng/mốc thời gian, nội dung con thụt 2 dấu cách "  -"
- Nhãn nguồn [A]/[B]/[C]: đặt DUY NHẤT một nhãn ở cuối câu hoặc cuối dòng bullet, không xếp chồng [A][B][C]
- KHÔNG viết tên file tài liệu vào trong câu trả lời. Nguồn gốc sẽ được hiển thị tự động qua nhãn [A]/[B]/[C].
- KHÔNG viết dòng "[Nguồn: ...]" hay bất kỳ dòng tổng kết nguồn nào cuối câu trả lời.
- KHÔNG viết mục "Trích dẫn từ tài liệu:", "Trích dẫn:", "Nguồn trích dẫn:", "Điệp ngữ:", "Nguyên văn:", hay bất kỳ block lặp lại/trích dẫn nào sau câu trả lời. Nhãn [A]/[B] inline trong câu là đủ.
- LỊCH SỬ HỘI THOẠI chỉ dùng để hiểu đại từ/tham chiếu ("nó", "điều đó", "cái trên"...). TUYỆT ĐỐI không dùng nội dung trong lịch sử hội thoại làm nguồn sự kiện — mọi thông tin thực tế PHẢI lấy từ NGỮ CẢNH hiện tại. Nếu NGỮ CẢNH không có thông tin, không được bổ sung từ lịch sử.
- KHÔNG được thêm tên công ty, tên người, hoặc bất kỳ thông tin định danh nào từ lịch sử hội thoại vào câu trả lời nếu NGỮ CẢNH hiện tại không đề cập đến chúng. Nếu tài liệu không ghi tên công ty, chỉ viết "công ty" hoặc bỏ qua — không tự điền tên.
- TRÍCH DẪN CHÍNH XÁC CẤP CON: Khi NGỮ CẢNH có cả tiêu đề cấp cha (VD: "PHẦN 5", "Chương 3") lẫn mục con có số thập phân (VD: "5.1", "5.2", "3.2.1"), PHẢI trích dẫn số mục con cụ thể nhất chứa thông tin — KHÔNG được chỉ nêu cấp cha. Ví dụ: tài liệu có "PHẦN 5" và "5.1 Công tác trong nước" → trích dẫn là "mục 5.1" hoặc "Điều 5.1", KHÔNG phải "Phần 5". Tương tự: có "3.2.1" thì dùng "3.2.1", không dùng "3.2" hay "3".
- CÂU HỎI KÉP (nội dung + vị trí): Nếu câu hỏi hỏi cả "nội dung/có được không" LẪN "tại điều mấy/ở đâu", PHẢI trả lời ĐẦY ĐỦ CẢ HAI — vừa nêu nội dung, vừa chỉ rõ số điều và tên tài liệu. KHÔNG được bỏ qua phần nào.
{intent_instruction}
VÍ DỤ — câu trả lời nhiều ý:
Quy trình thanh toán gồm các bước sau:
- **Bước 1: Lập đề nghị thanh toán**
  - Điền phiếu đề nghị trên hệ thống ERP
  - Đính kèm hóa đơn VAT hợp lệ, hợp đồng liên quan [A]
- **Bước 2: Kiểm tra chứng từ**
  - Kế toán xác nhận tính hợp lệ theo Nghị định 123/2020 [A]
- **Chi tiêu khẩn cấp**: hạn mức tối đa **10.000.000 đồng/lần**, bổ sung chứng từ trong **3 ngày làm việc**. [B]

"""
)

SUGGESTIONS_PROMPT = PromptTemplate(
    input_variables=["context", "answer"],
    template="""Tạo đúng 3 câu hỏi tiếp theo dựa trên nội dung tài liệu.

Quy tắc:
- Đánh số thứ tự: 1. 2. 3.
- Mỗi câu một dòng, không viết thêm bất kỳ đoạn giới thiệu hay kết luận nào.

Nội dung tài liệu:
{context}

Câu trả lời trước đó:
{answer}

3 câu hỏi tiếp theo:"""
)

# Directive cấu trúc hóa chain-of-thought cho thinking model
THINKING_DIRECTIVE = """Trước khi trả lời, hãy suy nghĩ theo cấu trúc sau trong phần suy nghĩ nội tâm:
[PHÂN TÍCH CÂU HỎI]: Câu hỏi yêu cầu thông tin gì? Từ khóa chính là gì?
[XEM XÉT TÀI LIỆU]: Tài liệu nào ([A],[B],[C]...) có thông tin liên quan? Độ tin cậy?
[KẾT LUẬN]: Thông tin có đủ để trả lời không? Cần đặt điều kiện/giới hạn gì?

"""
