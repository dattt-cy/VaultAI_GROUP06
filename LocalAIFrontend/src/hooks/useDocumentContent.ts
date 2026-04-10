import { useState, useEffect } from 'react';

export interface DocPageData {
  page: number;
  title?: string | null;
  lines: string[];
  chunk_index?: number;
  token_count?: number;
}

export interface DocumentContentResponse {
  filename: string;
  pages: DocPageData[];
  ingestion_status?: string | null;
  total_tokens?: number;
  total_chunks?: number;
}

export function useDocumentContent(filename?: string | null) {
  const [data, setData] = useState<DocumentContentResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filename) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setData(null);

    const fetchContent = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/api/documents/content?filename=${encodeURIComponent(filename)}`
        );

        // Đọc body JSON trước khi check status để lấy thông báo lỗi
        const json = await response.json();

        if (!response.ok) {
          // Backend trả detail khi lỗi
          const detail = json?.detail ?? 'Không thể lấy nội dung tài liệu';
          throw new Error(detail);
        }

        if (isMounted) {
          setData(json);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message ?? 'Có lỗi xảy ra khi lấy nội dung');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchContent();

    return () => {
      isMounted = false;
    };
  }, [filename]);

  return { data, loading, error };
}
