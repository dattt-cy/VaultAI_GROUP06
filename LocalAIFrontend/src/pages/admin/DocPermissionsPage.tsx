import React, { useState, useMemo } from 'react';
import { FileKey, User, FolderOpen, ChevronRight, Check, Minus, Search } from 'lucide-react';
import { mockUsers, mockDocuments, mockCategories, mockDocPermissions } from '../../mocks/adminMocks';
import { StatusBadge } from '../../components/admin/AdminTable';
import { cn } from '../../lib/utils';

type ViewMode = 'by-user' | 'by-doc';
type ByDocTab = 'doc' | 'folder';

const companyDocs = mockDocuments.filter(d => d.scope === 'COMPANY');
const nonAdminUsers = mockUsers.filter(u => u.role !== 'admin');

// ── Helpers ───────────────────────────────────────────────────────────────────

function docsInCategory(cat: string) {
  return companyDocs.filter(d => d.category === cat);
}

// ── DocPermissionsPage ────────────────────────────────────────────────────────

const DocPermissionsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('by-user');
  const [byDocTab, setByDocTab] = useState<ByDocTab>('doc');

  const [selectedUser, setSelectedUser] = useState(nonAdminUsers[0]?.id ?? 0);
  const [selectedDoc, setSelectedDoc] = useState(companyDocs[0]?.id ?? 0);
  const [selectedFolder, setSelectedFolder] = useState(mockCategories[0]?.name ?? '');

  const [permissions, setPermissions] = useState<Record<number, number[]>>({ ...mockDocPermissions });
  const [saved, setSaved] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return nonAdminUsers.filter(u =>
      !q || u.full_name.toLowerCase().includes(q) || u.department.toLowerCase().includes(q)
    );
  }, [userSearch]);

  // Expanded folders in by-user view
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(mockCategories.map(c => c.name))
  );

  // ── Permission helpers ─────────────────────────────────────────────────────

  const userHasDoc = (userId: number, docId: number) =>
    (permissions[userId] ?? []).includes(docId);

  const toggleDoc = (userId: number, docId: number) => {
    setPermissions(prev => {
      const cur = prev[userId] ?? [];
      const has = cur.includes(docId);
      return { ...prev, [userId]: has ? cur.filter(id => id !== docId) : [...cur, docId] };
    });
    setSaved(false);
  };

  // Folder-level helpers for a user
  const folderDocIds = (cat: string) => docsInCategory(cat).map(d => d.id);

  const folderState = (userId: number, cat: string): 'all' | 'some' | 'none' => {
    const ids = folderDocIds(cat);
    if (ids.length === 0) return 'none';
    const allowed = ids.filter(id => userHasDoc(userId, id));
    if (allowed.length === ids.length) return 'all';
    if (allowed.length > 0) return 'some';
    return 'none';
  };

  const toggleFolder = (userId: number, cat: string) => {
    const ids = folderDocIds(cat);
    const state = folderState(userId, cat);
    setPermissions(prev => {
      const cur = new Set(prev[userId] ?? []);
      if (state === 'all') {
        ids.forEach(id => cur.delete(id));
      } else {
        ids.forEach(id => cur.add(id));
      }
      return { ...prev, [userId]: Array.from(cur) };
    });
    setSaved(false);
  };

  // How many docs a user can view in a folder
  const folderAllowedCount = (userId: number, cat: string) =>
    folderDocIds(cat).filter(id => userHasDoc(userId, id)).length;

  // How many users have access to a doc
  const docAllowedUsers = (docId: number) =>
    nonAdminUsers.filter(u => userHasDoc(u.id, docId));

  // How many users have access to ALL docs in a folder
  const folderFullAccessUsers = (cat: string) => {
    const ids = folderDocIds(cat);
    if (ids.length === 0) return [];
    return nonAdminUsers.filter(u => ids.every(id => userHasDoc(u.id, id)));
  };

  const toggleFolderForUser = (userId: number, cat: string) => {
    toggleFolder(userId, cat);
  };

  // Grant/revoke user access to entire folder (by-folder tab)
  const userFolderState = (userId: number, cat: string) => folderState(userId, cat);

  const toggleExpandFolder = (cat: string) => {
    setExpandedFolders(prev => {
      const s = new Set(prev);
      s.has(cat) ? s.delete(cat) : s.add(cat);
      return s;
    });
  };

  const selectedUserObj = mockUsers.find(u => u.id === selectedUser);
  const selectedDocObj = companyDocs.find(d => d.id === selectedDoc);

  const userInitial = (fullName: string) => fullName.split(' ').slice(-1)[0][0];

  // ── Folder Checkbox UI ─────────────────────────────────────────────────────

  const FolderCheckbox = ({ state, onClick }: { state: 'all' | 'some' | 'none'; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
        state === 'all'  && 'bg-success border-success',
        state === 'some' && 'bg-warning/80 border-warning',
        state === 'none' && 'border-border bg-elevated hover:border-success/60'
      )}
    >
      {state === 'all'  && <Check className="w-3 h-3 text-white" />}
      {state === 'some' && <Minus className="w-3 h-3 text-white" />}
    </button>
  );

  const DocCheckbox = ({ allowed, onClick }: { allowed: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
        allowed ? 'bg-success border-success' : 'border-border bg-elevated hover:border-success/60'
      )}
    >
      {allowed && <Check className="w-3 h-3 text-white" />}
    </button>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[20px] font-bold text-text-primary">Phân quyền Tài liệu</h1>
        <p className="text-[13px] text-text-muted mt-0.5">Cấp quyền xem theo tài liệu cụ thể hoặc toàn bộ thư mục</p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setViewMode('by-user')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1.5',
            viewMode === 'by-user' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-hover'
          )}
        >
          <User className="w-3.5 h-3.5" /> Theo người dùng
        </button>
        <button
          onClick={() => setViewMode('by-doc')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1.5',
            viewMode === 'by-doc' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-hover'
          )}
        >
          <FileKey className="w-3.5 h-3.5" /> Theo tài liệu / thư mục
        </button>
      </div>

      {/* ── BY USER ──────────────────────────────────────────────────────────── */}
      {viewMode === 'by-user' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* User list */}
          <div className="bg-elevated border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="panel-header">
              Chọn người dùng
              <span className="text-[11px] text-text-muted font-normal">{nonAdminUsers.length} người</span>
            </div>
            <div className="px-3 py-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Tìm tên, phòng ban..."
                  className="input-base pl-7 py-1.5 text-[12px] w-full"
                />
              </div>
            </div>
            <div className="divide-y divide-border overflow-y-auto flex-1">
              {filteredUsers.length === 0 && (
                <p className="text-center py-6 text-[13px] text-text-muted">Không tìm thấy</p>
              )}
              {filteredUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    selectedUser === user.id ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-hover'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-accent flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                    {userInitial(user.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text-primary truncate">{user.full_name}</p>
                    <p className="text-[11px] text-text-muted">{user.department}</p>
                  </div>
                  <span className="ml-auto text-[11px] text-text-muted shrink-0">
                    {(permissions[user.id] ?? []).length} doc
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Folder + doc tree for selected user */}
          <div className="lg:col-span-2 bg-elevated border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="panel-header">
              <span>Quyền xem — {selectedUserObj?.full_name}</span>
              <span className="text-text-muted normal-case font-normal text-[12px]">
                {(permissions[selectedUser] ?? []).length} / {companyDocs.length} tài liệu
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {mockCategories.map(cat => {
                const catDocs = docsInCategory(cat.name);
                if (catDocs.length === 0) return null;
                const state = folderState(selectedUser, cat.name);
                const expanded = expandedFolders.has(cat.name);
                const allowedCount = folderAllowedCount(selectedUser, cat.name);

                return (
                  <div key={cat.id}>
                    {/* Folder row */}
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-surface/60 hover:bg-surface transition-colors">
                      <button
                        onClick={() => toggleExpandFolder(cat.name)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      >
                        <ChevronRight className={cn('w-3.5 h-3.5 text-text-muted transition-transform shrink-0', expanded && 'rotate-90')} />
                        <FolderOpen className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span className="text-[13px] font-semibold text-text-primary">{cat.name}</span>
                        <span className={cn(
                          'text-[11px] ml-1',
                          allowedCount === catDocs.length ? 'text-success' : allowedCount > 0 ? 'text-warning' : 'text-text-muted'
                        )}>
                          {allowedCount}/{catDocs.length} doc
                        </span>
                      </button>
                      <FolderCheckbox state={state} onClick={() => toggleFolder(selectedUser, cat.name)} />
                    </div>

                    {/* Docs in folder */}
                    {expanded && catDocs.map(doc => {
                      const allowed = userHasDoc(selectedUser, doc.id);
                      return (
                        <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 pl-10 hover:bg-hover/40 transition-colors border-t border-border/50">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-text-primary truncate">{doc.filename}</p>
                            <p className="text-[11px] text-text-muted">{doc.file_size}</p>
                          </div>
                          <StatusBadge status={doc.ingestion_status} />
                          <DocCheckbox allowed={allowed} onClick={() => toggleDoc(selectedUser, doc.id)} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-border flex justify-end">
              <button
                onClick={() => setSaved(true)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors',
                  saved ? 'bg-success/20 text-success border border-success/30' : 'bg-accent text-white hover:bg-accent-hover'
                )}
              >
                {saved ? '✓ Đã lưu' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BY DOC / FOLDER ──────────────────────────────────────────────────── */}
      {viewMode === 'by-doc' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left panel: doc or folder selector */}
          <div className="bg-elevated border border-border rounded-xl overflow-hidden flex flex-col">
            {/* Sub-tabs */}
            <div className="panel-header gap-0 p-1.5">
              <div className="flex gap-1 bg-surface border border-border rounded-lg p-0.5 w-full">
                <button
                  onClick={() => setByDocTab('doc')}
                  className={cn(
                    'flex-1 py-1 rounded-md text-[12px] font-medium transition-colors',
                    byDocTab === 'doc' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  Tài liệu
                </button>
                <button
                  onClick={() => setByDocTab('folder')}
                  className={cn(
                    'flex-1 py-1 rounded-md text-[12px] font-medium transition-colors flex items-center justify-center gap-1',
                    byDocTab === 'folder' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  <FolderOpen className="w-3 h-3" /> Thư mục
                </button>
              </div>
            </div>

            {/* Doc list */}
            {byDocTab === 'doc' && (
              <div className="divide-y divide-border overflow-y-auto flex-1">
                {companyDocs.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc.id)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                      selectedDoc === doc.id ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-hover'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-text-primary truncate">{doc.filename}</p>
                      <p className="text-[11px] text-text-muted">{doc.category} · {docAllowedUsers(doc.id).length} user</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Folder list */}
            {byDocTab === 'folder' && (
              <div className="divide-y divide-border overflow-y-auto flex-1">
                {mockCategories.map(cat => {
                  const catDocs = docsInCategory(cat.name);
                  if (catDocs.length === 0) return null;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedFolder(cat.name)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                        selectedFolder === cat.name ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-hover'
                      )}
                    >
                      <FolderOpen className={cn('w-4 h-4 shrink-0', selectedFolder === cat.name ? 'text-accent' : 'text-text-muted')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-text-primary">{cat.name}</p>
                        <p className="text-[11px] text-text-muted">{catDocs.length} tài liệu · {folderFullAccessUsers(cat.name).length} user toàn quyền</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: users */}
          <div className="lg:col-span-2 bg-elevated border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="panel-header">
              {byDocTab === 'doc'
                ? <span>Ai được xem — <span className="text-accent font-semibold">{selectedDocObj?.filename}</span></span>
                : <span>Quyền theo thư mục — <span className="text-accent font-semibold">{selectedFolder}</span> <span className="text-text-muted font-normal text-[12px]">({docsInCategory(selectedFolder).length} tài liệu)</span></span>
              }
            </div>

            {/* Search users in by-doc panel */}
            <div className="px-3 py-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Tìm người dùng..."
                  className="input-base pl-7 py-1.5 text-[12px] w-full"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {filteredUsers.length === 0 && (
                <p className="text-center py-6 text-[13px] text-text-muted">Không tìm thấy</p>
              )}
              {filteredUsers.map(user => {
                if (byDocTab === 'doc') {
                  const allowed = userHasDoc(user.id, selectedDoc);
                  return (
                    <div key={user.id} className="flex items-center gap-3 px-4 py-3 hover:bg-hover/50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-accent flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                        {userInitial(user.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-text-primary">{user.full_name}</p>
                        <p className="text-[11px] text-text-muted">{user.department} · {user.role}</p>
                      </div>
                      <span className={cn('text-[12px] font-semibold mr-2', allowed ? 'text-success' : 'text-text-muted')}>
                        {allowed ? 'Được phép' : 'Bị chặn'}
                      </span>
                      <DocCheckbox allowed={allowed} onClick={() => toggleDoc(user.id, selectedDoc)} />
                    </div>
                  );
                } else {
                  const state = userFolderState(user.id, selectedFolder);
                  const count = folderAllowedCount(user.id, selectedFolder);
                  const total = docsInCategory(selectedFolder).length;
                  return (
                    <div key={user.id} className="flex items-center gap-3 px-4 py-3 hover:bg-hover/50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-accent flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                        {userInitial(user.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-text-primary">{user.full_name}</p>
                        <p className="text-[11px] text-text-muted">{user.department} · {user.role}</p>
                      </div>
                      <span className={cn(
                        'text-[12px] font-semibold mr-2',
                        state === 'all' ? 'text-success' : state === 'some' ? 'text-warning' : 'text-text-muted'
                      )}>
                        {state === 'all' ? 'Toàn bộ' : state === 'some' ? `${count}/${total} doc` : 'Không có'}
                      </span>
                      <FolderCheckbox state={state} onClick={() => toggleFolderForUser(user.id, selectedFolder)} />
                    </div>
                  );
                }
              })}
            </div>

            <div className="px-4 py-3 border-t border-border flex justify-end">
              <button
                onClick={() => setSaved(true)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors',
                  saved ? 'bg-success/20 text-success border border-success/30' : 'bg-accent text-white hover:bg-accent-hover'
                )}
              >
                {saved ? '✓ Đã lưu' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocPermissionsPage;
