import React, { useState, useCallback } from 'react';
import { UploadCloud, CheckCircle2 } from 'lucide-react';

interface DropZoneProps { onFilesAdded?: (f: File[]) => void; }

export const DropZone: React.FC<DropZoneProps> = ({ onFilesAdded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<{ name: string; progress: number; done: boolean }[]>([]);

  const simulateUpload = (files: File[]) => {
    files.forEach(file => {
      setUploads(prev => [...prev, { name: file.name, progress: 0, done: false }]);
      let p = 0;
      const iv = setInterval(() => {
        p += Math.random() * 25;
        if (p >= 100) { p = 100; clearInterval(iv); }
        setUploads(prev => prev.map(u => u.name === file.name ? { ...u, progress: Math.min(p, 100), done: p >= 100 } : u));
      }, 200);
    });
    onFilesAdded?.(files);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) simulateUpload(files);
  }, []);

  return (
    <div className="p-2">
      <label
        className={`flex flex-col items-center gap-1.5 p-3.5 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200
          ${isDragging ? 'border-accent bg-accent/10' : 'border-border bg-elevated hover:border-border/70'}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" className="hidden"
          onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) simulateUpload(f); e.target.value = ''; }} />
        <UploadCloud className={`w-6 h-6 ${isDragging ? 'text-accent' : 'text-text-muted'}`} />
        <span className={`text-[11px] font-semibold ${isDragging ? 'text-accent' : 'text-text-secondary'}`}>
          {isDragging ? 'Thả tệp vào đây' : 'Kéo thả tài liệu'}
        </span>
        <span className="text-[10px] text-text-muted">PDF · DOCX · XLSX · Ảnh scan</span>
      </label>

      {uploads.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {uploads.slice(-3).map(u => (
            <div key={u.name} className="text-[11px]">
              <div className="flex justify-between mb-1">
                <span className="text-text-secondary truncate flex-1">{u.name}</span>
                {u.done
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0 ml-1" />
                  : <span className="text-accent ml-2 flex-shrink-0">{Math.round(u.progress)}%</span>
                }
              </div>
              <div className="h-0.5 bg-border rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-200 ${u.done ? 'bg-success' : 'bg-accent'}`}
                  style={{ width: `${u.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
