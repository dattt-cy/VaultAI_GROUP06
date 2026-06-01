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
  addOptimisticDoc: (filename: string, fileType: string) => void;
  removeOptimisticDoc: (filename: string) => void;
}

export function useDocumentTree(sessionId?: number | null): DocumentTreeState {
  const [sharedDocs, setSharedDocs] = useState<RealDocument[]>([]);
  const [privateDocs, setPrivateDocs] = useState<RealDocument[]>([]);
  const [optimisticDocs, setOptimisticDocs] = useState<RealDocument[]>([]);
  const [categories, setCategories] = useState<RealCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const personalParams = sessionId != null ? `?scope=PERSONAL&session_id=${sessionId}` : `?scope=PERSONAL`;
      const [sharedRes, personalRes, catsRes] = await Promise.all([
        fetch(`${API_BASE}/api/documents/list?scope=COMPANY`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/documents/list${personalParams}`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/documents/categories`, { credentials: 'include' }),
      ]);

      if (!sharedRes.ok) throw new Error(`HTTP ${sharedRes.status}`);

      const sharedData = await sharedRes.json();
      const personalData = personalRes.ok ? await personalRes.json() : { documents: [] };
      const catsData = catsRes.ok ? await catsRes.json() : { categories: [] };

      const realPersonal: RealDocument[] = personalData.documents ?? [];
      const realTitles = new Set(realPersonal.map(d => d.title));
      setOptimisticDocs(prev => prev.filter(d => !realTitles.has(d.title)));

      setSharedDocs(sharedData.documents ?? []);
      setPrivateDocs(realPersonal);
      setCategories(catsData.categories ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Lỗi kết nối backend');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sessionId]);

  const addOptimisticDoc = useCallback((filename: string, fileType: string) => {
    const title = filename.replace(/ /g, '_');
    setOptimisticDocs(prev => {
      if (prev.some(d => d.title === title)) return prev;
      const fake: RealDocument = {
        id: -(Date.now()),
        title,
        file_type: fileType,
        scope: 'PERSONAL',
        category_id: null,
        category_name: null,
        ingestion_status: 'PROCESSING',
        total_tokens: 0,
        uploaded_by: 0,
      };
      return [fake, ...prev];
    });
  }, []);

  const removeOptimisticDoc = useCallback((filename: string) => {
    const title = filename.replace(/ /g, '_');
    setOptimisticDocs(prev => prev.filter(d => d.title !== title));
  }, []);

  const deleteDocument = useCallback(async (id: number) => {
    await fetch(`${API_BASE}/api/documents/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await fetchAll();
  }, [fetchAll]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-poll mỗi 2.5s khi có doc đang PROCESSING/PENDING — dừng khi tất cả xong
  useEffect(() => {
    const hasProcessing =
      optimisticDocs.length > 0 ||
      [...privateDocs, ...sharedDocs].some(
        d => d.ingestion_status === 'PROCESSING' || d.ingestion_status === 'PENDING'
      );
    if (!hasProcessing) return;
    const timer = setInterval(() => fetchAll(true), 2500);
    return () => clearInterval(timer);
  }, [optimisticDocs, privateDocs, sharedDocs, fetchAll]);

  const mergedPrivateDocs = [...optimisticDocs, ...privateDocs];

  return { sharedDocs, privateDocs: mergedPrivateDocs, categories, loading, error, refetch: () => fetchAll(true), deleteDocument, addOptimisticDoc, removeOptimisticDoc };
}
