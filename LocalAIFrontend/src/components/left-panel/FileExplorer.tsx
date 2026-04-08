import React, { useState } from 'react';
import { ChevronRight, FileText, FileSpreadsheet, FileImage, Folder, Circle } from 'lucide-react';

interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'pdf' | 'docx' | 'xlsx' | 'image';
  children?: FileNode[];
  active?: boolean;
}

const SHARED_FILES: FileNode[] = [
  {
    id: 'f1', name: 'Pháp chế', type: 'folder', children: [
      { id: 'f1-1', name: 'Quy chế nội bộ 2024.pdf', type: 'pdf', active: true },
      { id: 'f1-2', name: 'Nghị định 45-2026.pdf', type: 'pdf' },
      { id: 'f1-3', name: 'Hợp đồng lao động mẫu.docx', type: 'docx' },
    ],
  },
  {
    id: 'f2', name: 'Kế toán', type: 'folder', children: [
      { id: 'f2-1', name: 'Báo cáo tài chính Q1-2024.xlsx', type: 'xlsx' },
      { id: 'f2-2', name: 'Dự toán ngân sách 2025.xlsx', type: 'xlsx' },
    ],
  },
  {
    id: 'f3', name: 'Nhân sự', type: 'folder', children: [
      { id: 'f3-1', name: 'Danh sách nhân viên 2024.xlsx', type: 'xlsx' },
      { id: 'f3-2', name: 'Quy trình tuyển dụng.pdf', type: 'pdf' },
    ],
  },
];
const PRIVATE_FILES: FileNode[] = [
  { id: 'p1', name: 'Ghi chú cá nhân.docx', type: 'docx' },
  { id: 'p2', name: 'Tài liệu tham khảo.pdf', type: 'pdf' },
];

const FileIcon: React.FC<{ type: string; className?: string }> = ({ type, className = 'w-3.5 h-3.5' }) => {
  if (type === 'pdf')   return <FileText className={`${className} text-danger`} />;
  if (type === 'docx')  return <FileText className={`${className} text-accent`} />;
  if (type === 'xlsx')  return <FileSpreadsheet className={`${className} text-success`} />;
  if (type === 'image') return <FileImage className={`${className} text-warning`} />;
  return <Folder className={`${className} text-warning`} />;
};

interface FileRowProps { node: FileNode; depth?: number; onSelect: (n: FileNode) => void; selectedId: string; }

const FileRow: React.FC<FileRowProps> = ({ node, depth = 0, onSelect, selectedId }) => {
  const [open, setOpen] = useState(depth === 0);
  const isSelected = node.id === selectedId;
  const isFolder = node.type === 'folder';

  return (
    <div>
      <button
        onClick={() => { isFolder ? setOpen(o => !o) : onSelect(node); }}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        className={`sidebar-item w-full text-left ${isSelected ? 'active' : ''}`}
      >
        {isFolder && (
          <ChevronRight className={`w-3 h-3 text-text-muted transition-transform duration-150 flex-shrink-0 ${open ? 'rotate-90' : ''}`} />
        )}
        <FileIcon type={node.type} />
        <span className={`flex-1 text-[12px] truncate ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
          {node.name}
        </span>
        {node.active && <Circle className="w-1.5 h-1.5 fill-success text-success flex-shrink-0" />}
      </button>
      {isFolder && open && node.children?.map(c => (
        <FileRow key={c.id} node={c} depth={depth + 1} onSelect={onSelect} selectedId={selectedId} />
      ))}
    </div>
  );
};

interface FileExplorerProps { onSelectFile: (name: string) => void; }

export const FileExplorer: React.FC<FileExplorerProps> = ({ onSelectFile }) => {
  const [selectedId, setSelectedId] = useState('f1-1');
  const [sharedOpen, setSharedOpen] = useState(true);
  const [privateOpen, setPrivateOpen] = useState(false);

  const handle = (node: FileNode) => { setSelectedId(node.id); onSelectFile(node.name); };

  const SectionLabel: React.FC<{ label: string; color: string; open: boolean; toggle: () => void }> = ({ label, color, open, toggle }) => (
    <button onClick={toggle} className="flex items-center gap-2 w-full px-3 py-1.5 text-left">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex-1">{label}</span>
      <ChevronRight className={`w-3 h-3 text-text-muted transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
    </button>
  );

  return (
    <div className="overflow-auto flex-1">
      <div className="py-1">
        <SectionLabel label="Kho dùng chung" color="#388bfd" open={sharedOpen} toggle={() => setSharedOpen(o => !o)} />
        {sharedOpen && SHARED_FILES.map(n => <FileRow key={n.id} node={n} onSelect={handle} selectedId={selectedId} />)}
      </div>
      <div className="py-1 border-t border-border">
        <SectionLabel label="Kho cá nhân" color="#d29922" open={privateOpen} toggle={() => setPrivateOpen(o => !o)} />
        {privateOpen && PRIVATE_FILES.map(n => <FileRow key={n.id} node={n} onSelect={handle} selectedId={selectedId} />)}
      </div>
    </div>
  );
};
