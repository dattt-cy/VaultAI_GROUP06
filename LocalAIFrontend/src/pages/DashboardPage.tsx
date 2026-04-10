import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Book, MoreVertical, LayoutGrid, FileText, Settings, HelpCircle, Bot } from 'lucide-react';

const MOCK_NOTEBOOKS = [
  { id: '1', title: 'Quy chế công ty 2024', date: 'Hôm nay', sources: 3 },
  { id: '2', title: 'Hợp đồng lao động mẫu', date: 'Hôm qua', sources: 5 },
  { id: '3', title: 'Tài liệu dự án XYZ', date: '3 ngày trước', sources: 12 },
  { id: '4', title: 'Báo cáo tài chính Q1', date: 'Tuần trước', sources: 1 },
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-base flex flex-col font-sans">
      {/* ── Top Navigation ── */}
      <header className="h-16 flex items-center justify-between px-6 bg-surface border-b border-border">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-accent" />
          </div>
          <span className="text-[16px] font-bold tracking-wide text-text-primary">
            LocalAI <span className="font-medium text-text-muted">Notebook</span>
          </span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <button className="text-text-secondary hover:text-text-primary transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold text-[13px] shadow-sm">
            AD
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-8 py-10">
        
        {/* Title Section */}
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-[20px] font-bold text-text-primary tracking-tight">
            Sổ ghi chú gần đây
          </h2>
        </div>

        {/* ── Notebook Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          
          {/* Add New Card */}
          <div
            onClick={() => navigate('/workspace?id=new')}
            className="group flex flex-col items-center justify-center h-52 bg-surface border border-border border-dashed rounded-2xl cursor-pointer hover:border-accent hover:bg-accent/5 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors mb-3">
              <Plus className="w-6 h-6 text-accent" />
            </div>
            <span className="text-[13px] font-semibold text-text-primary">
              Tạo sổ ghi chú mới
            </span>
          </div>

          {/* Existing Notebook Cards */}
          {MOCK_NOTEBOOKS.map((nb) => (
            <div
              key={nb.id}
              onClick={() => navigate(`/workspace?id=${nb.id}`)}
              className="group relative flex flex-col h-52 bg-surface border border-border rounded-2xl cursor-pointer hover:shadow-lg hover:border-accent/40 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
            >
              {/* Card Header Color Ribbon */}
              <div className="h-2 w-full bg-gradient-to-r from-accent to-purple-500 opacity-60 group-hover:opacity-100 transition-opacity" />
              
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div className="w-10 h-10 rounded-lg bg-base flex items-center justify-center">
                    <Book className="w-5 h-5 text-accent" />
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); /* show menu */ }}
                    className="p-1.5 rounded-full text-text-muted hover:bg-hover hover:text-text-primary transition-colors -mr-1"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
                
                <h3 className="text-[15px] font-bold text-text-primary leading-tight mt-auto mb-1 group-hover:text-accent transition-colors">
                  {nb.title}
                </h3>
                
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium">
                  <span>{nb.date}</span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span>{nb.sources} nguồn</span>
                </div>
              </div>
            </div>
          ))}

        </div>
      </main>
    </div>
  );
};
