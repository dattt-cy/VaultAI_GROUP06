export const mockUsers = [
  { id: 1, username: 'admin', full_name: 'Administrator', email: 'admin@company.vn', role: 'admin', department: 'IT', is_active: true, last_login: '2026-04-19T08:30:00', created_at: '2025-01-01T00:00:00' },
  { id: 2, username: 'nguyen.van.a', full_name: 'Nguyễn Văn An', email: 'nguyen.van.a@company.vn', role: 'user', department: 'Kế toán', is_active: true, last_login: '2026-04-18T14:22:00', created_at: '2025-03-10T00:00:00' },
  { id: 3, username: 'tran.thi.b', full_name: 'Trần Thị Bình', email: 'tran.thi.b@company.vn', role: 'user', department: 'Nhân sự', is_active: true, last_login: '2026-04-17T09:11:00', created_at: '2025-03-15T00:00:00' },
  { id: 4, username: 'le.van.c', full_name: 'Lê Văn Cường', email: 'le.van.c@company.vn', role: 'accountant', department: 'Kế toán', is_active: false, last_login: '2026-04-10T16:45:00', created_at: '2025-04-01T00:00:00' },
  { id: 5, username: 'pham.thi.d', full_name: 'Phạm Thị Dung', email: 'pham.thi.d@company.vn', role: 'user', department: 'Kỹ thuật', is_active: true, last_login: '2026-04-19T07:55:00', created_at: '2025-05-20T00:00:00' },
  { id: 6, username: 'hoang.van.e', full_name: 'Hoàng Văn Emi', email: 'hoang.van.e@company.vn', role: 'user', department: 'Marketing', is_active: true, last_login: '2026-04-16T11:30:00', created_at: '2025-06-01T00:00:00' },
];

export const mockRoles = [
  { id: 1, name: 'admin', access_level: 10, description: 'Toàn quyền hệ thống' },
  { id: 2, name: 'user', access_level: 1, description: 'Người dùng thông thường' },
  { id: 3, name: 'accountant', access_level: 5, description: 'Kế toán - xem tài liệu tài chính' },
];

export const mockCategories = [
  { id: 1, name: 'Tài chính', description: 'Báo cáo tài chính, ngân sách', document_count: 12, created_at: '2025-01-10' },
  { id: 2, name: 'Nhân sự', description: 'Hồ sơ nhân viên, quy định HR', document_count: 8, created_at: '2025-01-10' },
  { id: 3, name: 'Kỹ thuật', description: 'Tài liệu kỹ thuật, quy trình', document_count: 24, created_at: '2025-01-10' },
  { id: 4, name: 'Pháp lý', description: 'Hợp đồng, quy định pháp luật', document_count: 6, created_at: '2025-02-01' },
  { id: 5, name: 'Marketing', description: 'Tài liệu marketing, chiến lược', document_count: 9, created_at: '2025-02-15' },
];

export const mockPermissions: Record<number, Record<number, { can_view: boolean; can_upload: boolean; can_delete: boolean }>> = {
  1: { 1: { can_view: true, can_upload: true, can_delete: true }, 2: { can_view: true, can_upload: true, can_delete: true }, 3: { can_view: true, can_upload: true, can_delete: true }, 4: { can_view: true, can_upload: true, can_delete: true }, 5: { can_view: true, can_upload: true, can_delete: true } },
  2: { 1: { can_view: false, can_upload: false, can_delete: false }, 2: { can_view: true, can_upload: false, can_delete: false }, 3: { can_view: true, can_upload: true, can_delete: false }, 4: { can_view: false, can_upload: false, can_delete: false }, 5: { can_view: true, can_upload: false, can_delete: false } },
  3: { 1: { can_view: true, can_upload: true, can_delete: false }, 2: { can_view: false, can_upload: false, can_delete: false }, 3: { can_view: false, can_upload: false, can_delete: false }, 4: { can_view: true, can_upload: false, can_delete: false }, 5: { can_view: false, can_upload: false, can_delete: false } },
};

export const mockDocuments = [
  { id: 1, filename: 'BaoCaoTaiChinh_Q1_2026.pdf', category: 'Tài chính', scope: 'COMPANY', uploader: 'admin', ingestion_status: 'COMPLETED', chunk_count: 45, file_size: '2.3 MB', created_at: '2026-04-01T09:00:00' },
  { id: 2, filename: 'QuyDinhNhanSu_2026.docx', category: 'Nhân sự', scope: 'COMPANY', uploader: 'tran.thi.b', ingestion_status: 'COMPLETED', chunk_count: 32, file_size: '1.1 MB', created_at: '2026-03-15T14:30:00' },
  { id: 3, filename: 'HuongDanKyThuat_v3.pdf', category: 'Kỹ thuật', scope: 'COMPANY', uploader: 'pham.thi.d', ingestion_status: 'PROCESSING', chunk_count: 0, file_size: '5.8 MB', created_at: '2026-04-19T08:00:00' },
  { id: 4, filename: 'HopDong_NCC_2026.pdf', category: 'Pháp lý', scope: 'COMPANY', uploader: 'admin', ingestion_status: 'COMPLETED', chunk_count: 18, file_size: '0.9 MB', created_at: '2026-02-20T10:00:00' },
  { id: 5, filename: 'KeHoachMarketing_Q2.pptx', category: 'Marketing', scope: 'COMPANY', uploader: 'hoang.van.e', ingestion_status: 'FAILED', chunk_count: 0, file_size: '8.2 MB', created_at: '2026-04-18T15:45:00' },
  { id: 6, filename: 'GhiChuCaNhan.txt', category: 'Kỹ thuật', scope: 'PERSONAL', uploader: 'pham.thi.d', ingestion_status: 'COMPLETED', chunk_count: 5, file_size: '0.1 MB', created_at: '2026-04-10T11:00:00' },
  { id: 7, filename: 'NganSach_2026_Draft.xlsx', category: 'Tài chính', scope: 'COMPANY', uploader: 'le.van.c', ingestion_status: 'PENDING', chunk_count: 0, file_size: '3.4 MB', created_at: '2026-04-19T09:30:00' },
  { id: 8, filename: 'GhiChu_CaNhan_Marketing.txt', category: 'Marketing', scope: 'PERSONAL', uploader: 'hoang.van.e', ingestion_status: 'FAILED', chunk_count: 0, file_size: '0.2 MB', created_at: '2026-04-17T16:00:00' },
  { id: 9, filename: 'QuyTrinh_Tuyen_Dung.docx', category: 'Nhân sự', scope: 'COMPANY', uploader: 'tran.thi.b', ingestion_status: 'PENDING', chunk_count: 0, file_size: '1.7 MB', created_at: '2026-04-18T10:00:00' },
  { id: 10, filename: 'BaoCao_KyThuat_Q1.pdf', category: 'Kỹ thuật', scope: 'COMPANY', uploader: 'pham.thi.d', ingestion_status: 'COMPLETED', chunk_count: 28, file_size: '4.1 MB', created_at: '2026-04-05T13:00:00' },
];

export const mockLlmConfig = {
  id: 1,
  model_name: 'qwen2.5:7b',
  temperature: 0.3,
  context_window: 4096,
  ollama_base_url: 'http://localhost:11434',
  embedding_model: 'paraphrase-multilingual-MiniLM-L12-v2',
  reranker_model: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
};

export const mockSystemPrompts = [
  { id: 1, name: 'Default v2', version: 2, is_active: true, created_at: '2026-03-01', content: 'Bạn là trợ lý AI nội bộ của công ty. Hãy trả lời dựa trên tài liệu được cung cấp. Không bịa đặt thông tin. Luôn trích dẫn nguồn khi trả lời.' },
  { id: 2, name: 'Default v1', version: 1, is_active: false, created_at: '2025-12-01', content: 'Bạn là trợ lý AI. Trả lời câu hỏi dựa trên tài liệu nội bộ.' },
  { id: 3, name: 'Strict Mode', version: 1, is_active: false, created_at: '2026-02-15', content: 'Bạn là trợ lý AI với chế độ nghiêm ngặt. Chỉ trả lời khi có đủ bằng chứng từ tài liệu. Từ chối trả lời nếu không tìm thấy thông tin liên quan.' },
];

export const mockChatSessions = [
  { id: 1, user: 'Nguyễn Văn An', notebook_name: 'Hỏi về báo cáo Q1', message_count: 12, created_at: '2026-04-18T14:00:00', is_archived: false, messages: [
    { role: 'user', content: 'Doanh thu Q1 2026 là bao nhiêu?', token_count: 12, latency_ms: null },
    { role: 'assistant', content: 'Dựa trên báo cáo tài chính Q1 2026, doanh thu đạt 45.2 tỷ đồng, tăng 12% so với cùng kỳ năm trước.', token_count: 48, latency_ms: 1240 },
    { role: 'user', content: 'Chi phí vận hành là bao nhiêu?', token_count: 10, latency_ms: null },
    { role: 'assistant', content: 'Chi phí vận hành Q1 2026 là 32.1 tỷ đồng, chiếm 71% doanh thu.', token_count: 35, latency_ms: 980 },
  ]},
  { id: 2, user: 'Trần Thị Bình', notebook_name: 'Quy trình onboarding', message_count: 6, created_at: '2026-04-17T09:00:00', is_archived: false, messages: [
    { role: 'user', content: 'Quy trình onboarding nhân viên mới gồm những bước nào?', token_count: 15, latency_ms: null },
    { role: 'assistant', content: 'Quy trình onboarding gồm 5 bước: 1) Ký hợp đồng, 2) Cấp tài khoản, 3) Đào tạo nội quy, 4) Giới thiệu phòng ban, 5) Bàn giao công việc.', token_count: 62, latency_ms: 1560 },
  ]},
  { id: 3, user: 'Phạm Thị Dung', notebook_name: 'Tài liệu kỹ thuật API', message_count: 24, created_at: '2026-04-15T10:30:00', is_archived: true, messages: [
    { role: 'user', content: 'API authentication hoạt động như thế nào?', token_count: 11, latency_ms: null },
    { role: 'assistant', content: 'Hệ thống sử dụng JWT token. Sau khi đăng nhập, server trả về access token có thời hạn 24 giờ.', token_count: 40, latency_ms: 870 },
  ]},
];

export const mockFeedbacks = [
  { id: 1, user: 'Nguyễn Văn An', message_preview: 'Dựa trên báo cáo tài chính Q1 2026, doanh thu đạt 45.2 tỷ...', feedback_type: 'LIKE', correction: null, created_at: '2026-04-18T14:05:00' },
  { id: 2, user: 'Trần Thị Bình', message_preview: 'Quy trình onboarding gồm 5 bước: 1) Ký hợp đồng...', feedback_type: 'DISLIKE', correction: 'Thiếu bước đào tạo an toàn thông tin', created_at: '2026-04-17T09:10:00' },
  { id: 3, user: 'Lê Văn Cường', message_preview: 'Chi phí nhân sự năm 2025 là 120 tỷ đồng...', feedback_type: 'HALLUCINATED', correction: 'Con số này không có trong tài liệu', created_at: '2026-04-16T11:30:00' },
  { id: 4, user: 'Phạm Thị Dung', message_preview: 'API sử dụng Bearer token với thời hạn 24 giờ...', feedback_type: 'LIKE', correction: null, created_at: '2026-04-15T10:45:00' },
  { id: 5, user: 'Hoàng Văn Emi', message_preview: 'Chiến lược marketing Q2 tập trung vào digital...', feedback_type: 'HALLUCINATED', correction: 'Không tìm thấy thông tin này trong tài liệu marketing', created_at: '2026-04-14T16:20:00' },
];

export const mockAuditLogs = [
  { id: 1, timestamp: '2026-04-19T08:30:00', user: 'admin', action: 'LOGIN', entity_type: 'USER', entity_id: 1, ip_address: '192.168.1.10', details: { browser: 'Chrome 124' } },
  { id: 2, timestamp: '2026-04-19T08:35:00', user: 'admin', action: 'UPLOAD_DOC', entity_type: 'DOCUMENT', entity_id: 7, ip_address: '192.168.1.10', details: { filename: 'NganSach_2026_Draft.xlsx', size: '3.4MB' } },
  { id: 3, timestamp: '2026-04-19T08:00:00', user: 'pham.thi.d', action: 'UPLOAD_DOC', entity_type: 'DOCUMENT', entity_id: 3, ip_address: '192.168.1.25', details: { filename: 'HuongDanKyThuat_v3.pdf', size: '5.8MB' } },
  { id: 4, timestamp: '2026-04-18T15:45:00', user: 'hoang.van.e', action: 'UPLOAD_DOC', entity_type: 'DOCUMENT', entity_id: 5, ip_address: '192.168.1.30', details: { filename: 'KeHoachMarketing_Q2.pptx', size: '8.2MB' } },
  { id: 5, timestamp: '2026-04-18T14:00:00', user: 'nguyen.van.a', action: 'LOGIN', entity_type: 'USER', entity_id: 2, ip_address: '192.168.1.12', details: { browser: 'Firefox 125' } },
  { id: 6, timestamp: '2026-04-17T16:00:00', user: 'admin', action: 'DELETE_DOC', entity_type: 'DOCUMENT', entity_id: 8, ip_address: '192.168.1.10', details: { filename: 'TaiLieuCu.pdf' } },
  { id: 7, timestamp: '2026-04-17T09:00:00', user: 'tran.thi.b', action: 'LOGIN', entity_type: 'USER', entity_id: 3, ip_address: '192.168.1.18', details: { browser: 'Chrome 124' } },
  { id: 8, timestamp: '2026-04-16T11:00:00', user: 'admin', action: 'UPDATE_USER', entity_type: 'USER', entity_id: 4, ip_address: '192.168.1.10', details: { field: 'is_active', value: false } },
];

export const mockSystemMetrics = {
  current: { cpu_percent: 23.4, ram_used_mb: 4821, ram_total_mb: 16384, vram_used_mb: 5120, vram_total_mb: 8192, timestamp: '2026-04-19T08:30:00' },
  history: [
    { timestamp: '08:00', cpu: 12, ram: 4200, vram: 4800 },
    { timestamp: '08:10', cpu: 18, ram: 4350, vram: 5000 },
    { timestamp: '08:20', cpu: 35, ram: 4600, vram: 5100 },
    { timestamp: '08:30', cpu: 23, ram: 4821, vram: 5120 },
    { timestamp: '08:40', cpu: 28, ram: 4900, vram: 5200 },
    { timestamp: '08:50', cpu: 15, ram: 4750, vram: 5050 },
  ],
};

export const mockOverview = {
  total_users: 6,
  total_documents: 7,
  total_sessions: 3,
  total_messages: 42,
  chroma_status: 'connected',
  chroma_vectors: 12480,
  ingestion_stats: { COMPLETED: 4, PROCESSING: 1, FAILED: 1, PENDING: 1 },
};

export const mockDocPermissions: Record<number, number[]> = {
  2: [1, 2, 3],
  3: [2, 3],
  4: [],
  5: [3, 6],
  6: [5],
};
