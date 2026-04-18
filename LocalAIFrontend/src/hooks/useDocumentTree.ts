import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../utils/apiClient';

export interface RealDocument {
  id: number;
  title: string;
  file_type: string;
  scope: string;
  category_id: number | null;
  category_name: string | null;
  ingestion_status: string;
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
  deleteDocument: (id: number) => Promise<void>;
}

export function useDocumentTree(): DocumentTreeState {
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
        fetch(`${API_BASE}/api/documents/list`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/documents/categories`, { credentials: 'include' }),
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
  }, []);

  const deleteDocument = useCallback(async (id: number) => {
    await fetch(`${API_BASE}/api/documents/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await fetchAll();
  }, [fetchAll]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { sharedDocs, privateDocs, categories, loading, error, refetch: fetchAll, deleteDocument };
}
