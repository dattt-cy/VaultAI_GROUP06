import React from 'react';
import { Check } from 'lucide-react';

const ROLES = [
  { label: 'Pháp chế',   icon: '⚖️', accent: '#388bfd' },
  { label: 'Kế toán',    icon: '💰', accent: '#3fb950' },
  { label: 'Nhân sự',    icon: '👥', accent: '#d29922' },
  { label: 'Hành chính', icon: '🏛️', accent: '#a78bfa' },
  { label: 'Lãnh đạo',   icon: '⭐', accent: '#f85149' },
];

export const RoleSelector: React.FC<{ value: string; onChange: (r: string) => void }> = ({ value, onChange }) => (
  <div className="py-1 px-2 flex flex-col gap-0.5">
    {ROLES.map(r => (
      <button
        key={r.label}
        onClick={() => onChange(r.label)}
        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[15px] transition-all duration-150 text-left
          ${value === r.label ? 'font-semibold' : 'text-text-secondary hover:bg-hover'}`}
        style={value === r.label ? { background: `${r.accent}1a`, border: `1px solid ${r.accent}55`, color: r.accent } : { border: '1px solid transparent' }}
      >
        <span className="text-sm">{r.icon}</span>
        <span className="flex-1">{r.label}</span>
        {value === r.label && <Check className="w-3 h-3 flex-shrink-0" />}
      </button>
    ))}
  </div>
);
