import React, { useState } from 'react';
import { FolderOpen, Upload, History, Lightbulb, Bot, Plus, ChevronDown } from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import { DropZone } from './DropZone';
import { ChatHistory } from './ChatHistory';
import { SampleQuestions } from './SampleQuestions';
import { RoleSelector } from './RoleSelector';
import type { ChatSession } from '../../hooks/useChatState';

type Section = 'files' | 'upload' | 'history' | 'questions' | 'role';

interface LeftPanelProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onSelectFile: (name: string) => void;
  onSelectQuestion: (q: string) => void;
  role: string;
  onRoleChange: (role: string) => void;
}

const SECTIONS: { key: Section; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'files',     label: 'Kho tài liệu',         Icon: FolderOpen },
  { key: 'upload',    label: 'Tải lên tài liệu',     Icon: Upload },
  { key: 'history',   label: 'Lịch sử trò chuyện',   Icon: History },
  { key: 'questions', label: 'Câu hỏi mẫu',           Icon: Lightbulb },
  { key: 'role',      label: 'Vai trò AI',             Icon: Bot },
];

export const LeftPanel: React.FC<LeftPanelProps> = ({
  sessions, activeSessionId, onSelectSession, onNewSession,
  onSelectFile, onSelectQuestion, role, onRoleChange,
}) => {
  const [open, setOpen] = useState<Section | null>('files');
  const toggle = (k: Section) => setOpen(p => p === k ? null : k);

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border flex-shrink-0">
        <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Nguồn</span>
        <button
          onClick={onNewSession}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent text-white text-[11px] font-semibold
                     hover:bg-accent-hover transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Thêm nguồn
        </button>
      </div>

      {/* Accordion sections */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        {SECTIONS.map(({ key, label, Icon }) => (
          <div key={key} className="flex flex-col">
            <button
              onClick={() => toggle(key)}
              className={`section-toggle ${open === key ? 'bg-elevated text-text-primary' : ''}`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 normal-case text-[11px] font-semibold tracking-normal">{label}</span>
              {key === 'history' && sessions.length > 0 && (
                <span className="badge bg-accent/15 text-accent mr-1">{sessions.length}</span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${open === key ? 'rotate-180' : ''}`} />
            </button>

            {open === key && (
              <div className={`overflow-auto ${key === 'files' ? 'max-h-64' : 'max-h-56'} border-b border-border`}>
                {key === 'files'     && <FileExplorer onSelectFile={onSelectFile} />}
                {key === 'upload'    && <DropZone />}
                {key === 'history'   && <ChatHistory sessions={sessions} activeId={activeSessionId} onSelect={onSelectSession} onNew={onNewSession} />}
                {key === 'questions' && <SampleQuestions onSelect={onSelectQuestion} />}
                {key === 'role'      && <RoleSelector value={role} onChange={onRoleChange} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
