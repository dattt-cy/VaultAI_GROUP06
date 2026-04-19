import React from 'react';

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyText?: string;
}

export function AdminTable<T>({ columns, data, rowKey, onRowClick, emptyText = 'Không có dữ liệu' }: AdminTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface">
            {columns.map(col => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className="px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wide border-b border-border whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-[13px] text-text-muted">
                {emptyText}
              </td>
            </tr>
          )}
          {data.map(row => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-border last:border-0 transition-colors duration-150 ${onRowClick ? 'cursor-pointer hover:bg-hover' : 'hover:bg-surface/50'}`}
            >
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3 text-[13px] text-text-primary">
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    COMPLETED:  'bg-success/15 text-success border-success/30',
    PROCESSING: 'bg-accent/15 text-accent border-accent/30',
    PENDING:    'bg-warning/15 text-warning border-warning/30',
    FAILED:     'bg-danger/15 text-danger border-danger/30',
    LIKE:       'bg-success/15 text-success border-success/30',
    DISLIKE:    'bg-warning/15 text-warning border-warning/30',
    HALLUCINATED: 'bg-danger/15 text-danger border-danger/30',
    connected:  'bg-success/15 text-success border-success/30',
    error:      'bg-danger/15 text-danger border-danger/30',
    admin:      'bg-danger/15 text-danger border-danger/30',
    user:       'bg-warning/15 text-warning border-warning/30',
    accountant: 'bg-accent/15 text-accent border-accent/30',
  };
  const cls = map[status] ?? 'bg-border/30 text-text-secondary border-border';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {status}
    </span>
  );
};

export const ActiveToggle: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${active ? 'bg-success/15 text-success border-success/30' : 'bg-border/20 text-text-muted border-border'}`}>
    {active ? 'Hoạt động' : 'Vô hiệu'}
  </span>
);
