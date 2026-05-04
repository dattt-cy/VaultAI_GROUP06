import { useState, useCallback } from 'react';
import { API_BASE } from '../utils/apiClient';

export type UploadStatus = 'uploading' | 'processing' | 'done' | 'error';

export interface UploadItem {
  id: string;
  filename: string;
  progress: number;
  status: UploadStatus;
  error?: string;
  docId?: number;
}

interface UseDocumentUploadOptions {
  categoryId?: number;
  scope?: 'COMPANY' | 'PERSONAL';
  sessionId?: number | null;
  onUploadStart?: () => void;
  onSuccess?: () => void;
  onFileQueued?: (filename: string, fileType: string) => void;
  onFileUploaded?: (filename: string) => void;
}

export function useDocumentUpload({
  categoryId = 1,
  scope = 'COMPANY',
  sessionId,
  onUploadStart,
  onSuccess,
  onFileQueued,
  onFileUploaded,
}: UseDocumentUploadOptions = {}) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const update = (id: string, patch: Partial<UploadItem>) =>
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));

  const uploadFile = useCallback(async (file: File) => {
    const id = `${Date.now()}-${file.name}`;
    setUploads(prev => [...prev, { id, filename: file.name, progress: 0, status: 'uploading' }]);
    const ext = file.name.includes('.') ? file.name.split('.').pop()! : '';
    onFileQueued?.(file.name, ext);

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category_id', String(categoryId));
        formData.append('scope', scope);
        if (scope === 'PERSONAL' && sessionId) {
          formData.append('session_id', String(sessionId));
        }

        xhr.withCredentials = true;  // send cookie for auth

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) update(id, { progress: Math.round((e.loaded / e.total) * 100) });
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.detail || `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Lỗi kết nối mạng'));
        xhr.open('POST', `${API_BASE}/api/documents/upload`);
        xhr.send(formData);
      });

      update(id, { progress: 100, status: 'processing' });

      // Xóa optimistic doc ngay khi upload xong (trước khi backend rename)
      onFileUploaded?.(file.name);

      // Delay 400ms để backend kịp tạo document record trước khi refetch
      setTimeout(() => onUploadStart?.(), 400);

      // Poll ingestion status every 2s, max 60s
      // Mỗi tick cũng gọi onUploadStart để tree luôn cập nhật trong quá trình chunking
      const deadline = Date.now() + 60_000;
      const poll = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/documents/list`, { credentials: 'include' });
          const data = await res.json();
          const match = (data.documents as any[]).find(
            d => d.title === file.name.replace(/ /g, '_') || d.title === file.name
          );
          if (match && (match.ingestion_status === 'COMPLETED' || match.ingestion_status === 'SUCCESS' || match.ingestion_status === 'DONE')) {
            clearInterval(poll);
            update(id, { status: 'done', docId: match.id });
            onSuccess?.();
            setTimeout(() => setUploads(prev => prev.filter(u => u.id !== id)), 2000);
          } else if (match && match.ingestion_status === 'FAILED') {
            clearInterval(poll);
            update(id, { status: 'error', error: 'Ingestion thất bại' });
            onUploadStart?.();
          } else if (Date.now() > deadline) {
            clearInterval(poll);
            update(id, { status: 'done' });
            onSuccess?.();
            setTimeout(() => setUploads(prev => prev.filter(u => u.id !== id)), 2000);
          } else {
            // Còn đang PROCESSING — sync tree để spinner hiện đúng
            onUploadStart?.();
          }
        } catch { /* ignore poll errors */ }
      }, 2000);
    } catch (err: any) {
      update(id, { status: 'error', error: err.message });
    }
  }, [categoryId, scope, sessionId, onUploadStart, onSuccess, onFileQueued, onFileUploaded]);

  const uploadFiles = useCallback((files: File[]) => {
    files.forEach(uploadFile);
  }, [uploadFile]);

  const clearDone = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status !== 'done'));
  }, []);

  const dismiss = useCallback((id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status === 'uploading' || u.status === 'processing'));
  }, []);

  return { uploads, uploadFiles, clearDone, dismiss, dismissAll };
}
