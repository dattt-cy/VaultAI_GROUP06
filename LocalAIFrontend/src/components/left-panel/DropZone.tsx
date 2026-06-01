import React, { useState, useCallback } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, X, ChevronDown } from 'lucide-react';
import { useDocumentUpload } from '../../hooks/useDocumentUpload';
import type { RealCategory } from '../../hooks/useDocumentTree';

interface DropZoneProps {
  categories: RealCategory[];
  onSuccess?: () => void;
  onUploadStart?: () => void;
  onFileQueued?: (filename: string, fileType: string) => void;
  onFileUploaded?: (filename: string) => void;
  scope?: 'PERSONAL' | 'COMPANY';
  sessionId?: number | null;
}

export const DropZone: React.FC<DropZoneProps> = ({ categories, onSuccess, onUploadStart, onFileQueued, onFileUploaded, scope = 'COMPANY', sessionId }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [categoryId, setCategoryId] = useState<number>(
    categories.find(c => c.name === 'Chung')?.id ?? categories[0]?.id ?? 1
  );

  const { uploads, uploadFiles, clearDone } = useDocumentUpload({
    categoryId,
    scope,
    sessionId,
    onUploadStart,
    onSuccess,
    onFileQueued,
    onFileUploaded,
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) uploadFiles(files);
  }, [uploadFiles]);

  return (
    <div className="flex flex-col gap-2">
      {/* ── Category selector (chỉ hiện khi scope COMPANY) ── */}
      {scope === 'COMPANY' && (
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <select
            value={categoryId}
            onChange={e => setCategoryId(Number(e.target.value))}
            className="w-full appearance-none pl-2 pr-6 py-1 text-[10px] bg-elevated border border-border rounded-md
                       text-text-secondary outline-none focus:border-accent/60 transition-colors cursor-pointer"
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-text-muted absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
      )}

      {/* ── Drop zone area ── */}
      <div
        className={`relative flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg border-2 border-dashed transition-all duration-200
          ${isDragging
            ? 'border-accent bg-accent/10'
            : scope === 'COMPANY'
              ? 'border-accent/40 bg-elevated hover:border-accent/60 hover:bg-hover'
              : 'border-warning/40 bg-elevated hover:border-warning/60 hover:bg-hover'
          }`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud className={`w-4 h-4 transition-transform duration-200 ${isDragging ? 'text-accent scale-110' : 'text-text-muted'}`} />

        <div className="text-center leading-tight">
          <span className={`block text-[11px] font-semibold tracking-wide ${isDragging ? 'text-accent' : 'text-text-primary'}`}>
            {isDragging ? 'Thả tệp vào đây' : 'Kéo thả tài liệu'}
          </span>
          <span className="block text-[9px] text-text-muted mt-0.5">
            Hỗ trợ: PDF, DOCX, XLSX, TXT
          </span>
        </div>

        {!isDragging && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] text-text-muted">chọn qua:</span>

            <label className="text-[9px] font-semibold text-accent hover:text-accent-hover hover:underline cursor-pointer bg-accent/10 px-1.5 py-0.5 rounded transition-colors">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                className="hidden"
                onChange={e => {
                  const f = Array.from(e.target.files ?? []);
                  if (f.length) uploadFiles(f);
                  e.target.value = '';
                }}
              />
              Files
            </label>

            <label className="text-[9px] font-semibold text-accent hover:text-accent-hover hover:underline cursor-pointer bg-accent/10 px-1.5 py-0.5 rounded transition-colors">
              <input
                type="file"
                // @ts-ignore
                webkitdirectory="true"
                directory="true"
                multiple
                className="hidden"
                onChange={e => {
                  const f = Array.from(e.target.files ?? []);
                  if (f.length) uploadFiles(f);
                  e.target.value = '';
                }}
              />
              Thư mục
            </label>
          </div>
        )}
      </div>

      {/* ── Upload Progress List ── */}
      {uploads.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          {uploads.slice().reverse().slice(0, 3).map(u => (
            <div key={u.id} className="text-[11px] bg-elevated/50 p-2 rounded-lg border border-border/50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-text-primary font-medium truncate flex-1 leading-none" title={u.filename}>
                  {u.filename}
                </span>
                <span className="flex-shrink-0 ml-2 flex items-center">
                  {u.status === 'uploading' && <span className="text-accent">{u.progress}%</span>}
                  {u.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-warning animate-spin" />}
                  {u.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                  {u.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-danger" aria-label={u.error} />}
                </span>
              </div>

              <div className="h-1 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    u.status === 'error' ? 'bg-danger' :
                    u.status === 'done' ? 'bg-success' :
                    u.status === 'processing' ? 'bg-warning animate-pulse' :
                    'bg-accent'
                  }`}
                  style={{ width: u.status === 'processing' ? '100%' : `${u.progress}%` }}
                />
              </div>

              {u.status === 'error' && (
                <p className="text-[9px] text-danger mt-1 opacity-90">{u.error}</p>
              )}
            </div>
          ))}

          {uploads.some(u => u.status === 'done' || u.status === 'error') && (
            <button
              onClick={clearDone}
              className="flex items-center justify-center gap-1 py-1 text-[10px] text-text-muted hover:text-text-primary transition-colors mt-1"
            >
              <X className="w-3 h-3" /> Xóa danh sách tải xong
            </button>
          )}
        </div>
      )}
    </div>
  );
};
