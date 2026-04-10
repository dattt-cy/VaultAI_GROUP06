import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:8000';

export interface RealDocument {
  id: number;             // integer DB id → dùng cho selected_doc_ids
  title: string;
  file_type: string;      // 'pdf' | 'docx' | 'xlsx' | ...
  scope: string;          // 'COMPANY' | 'PERSONAL'
  category_id: number | null;
  category_name: string | null;
  ingestion_status: string; // 'PENDING' | 'PROCESSING' | 'DONE' | 'ERROR'
  total_tokens: number;
  uploaded_by: number;
}

export interface RealCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface DocumentTreeState {
  sharedDocs: RealDocument[];
  privateDocs: RealDocument[];
  categories: RealCategory[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook fetch danh sách tài liệu THỰC từ backend SQLite.
 * Thay thế mockdata SHARED_FILES / PRIVATE_FILES tĩnh trong FileExplorer.
 *
 * @param userId  ID người dùng hiện tại (mặc định 1 khi chưa có auth)
 */
export function useDocumentTree(userId: number = 1): DocumentTreeState {
  const [sharedDocs, setSharedDocs] = useState<RealDocument[]>([]);
  const [privateDocs, setPrivateDocs] = useState<RealDocument[]>([]);
  const [categories, setCategories] = useState<RealCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docsRes, catsRes] = await Promise.all([
        fetch(`${API_BASE}/api/documents/list?user_id=${userId}`),
        fetch(`${API_BASE}/api/documents/categories`),
      ]);

      if (!docsRes.ok) throw new Error(`HTTP ${docsRes.status}`);

      const docsData = await docsRes.json();
      const catsData = catsRes.ok ? await catsRes.json() : { categories: [] };

      const allDocs: RealDocument[] = docsData.documents ?? [];

      setSharedDocs(allDocs.filter(d => d.scope === 'COMPANY'));
      setPrivateDocs(allDocs.filter(d => d.scope === 'PERSONAL'));
      setCategories(catsData.categories ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Lỗi kết nối backend');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { sharedDocs, privateDocs, categories, loading, error, refetch: fetchAll };
}
