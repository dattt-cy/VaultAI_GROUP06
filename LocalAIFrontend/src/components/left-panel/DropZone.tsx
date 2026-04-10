import React, { useState, useCallback } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { useDocumentUpload } from '../../hooks/useDocumentUpload';

interface DropZoneProps {
  onSuccess?: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);

  // Khởi tạo hook upload thật, gọi onSuccess để refetch cây tài liệu khi tải xong
  const { uploads, uploadFiles, clearDone } = useDocumentUpload({
    categoryId: 1, // hardcode tạm thời là danh mục "Chung"
    userId: 1,     // hardcode tạm thời user = 1
    scope: 'PERSONAL', // CHỈ cho phép tải lên kho cá nhân
    onSuccess,
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) uploadFiles(files);
  }, [uploadFiles]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg border-2 border-dashed transition-all duration-200
          ${isDragging ? 'border-accent bg-accent/10' : 'border-border bg-elevated hover:border-accent/50 hover:bg-hover'}`}
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
            
            {/* Nút tải File */}
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

            {/* Nút tải Thư mục */}
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
                
                {/* Status Indicator */}
                <span className="flex-shrink-0 ml-2 flex items-center">
                  {u.status === 'uploading' && <span className="text-accent">{u.progress}%</span>}
                  {u.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-warning animate-spin" />}
                  {u.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                  {u.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-danger" title={u.error} />}
                </span>
              </div>
              
              {/* Progress Bar */}
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

              {/* Error text */}
              {u.status === 'error' && (
                <p className="text-[9px] text-danger mt-1 opacity-90">{u.error}</p>
              )}
            </div>
          ))}

          {/* Clear Button */}
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
