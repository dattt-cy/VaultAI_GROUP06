import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Download, Table2 } from 'lucide-react';
import type { TableData } from '../../hooks/useChatState';

interface DataTableProps {
  data: TableData;
}

export const DataTable: React.FC<DataTableProps> = ({ data }) => {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');

  const filteredRows = useMemo(() => {
    const lower = filter.toLowerCase().trim();
    if (!lower) return data.rows;
    return data.rows.filter(row =>
      row.some(cell => cell.toLowerCase().includes(lower))
    );
  }, [data.rows, filter]);

  const sortedRows = useMemo(() => {
    if (sortCol === null) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const av = a[sortCol] ?? '';
      const bv = b[sortCol] ?? '';
      // Thử so sánh số nếu có thể
      const an = parseFloat(av.replace(/[^0-9.-]/g, ''));
      const bn = parseFloat(bv.replace(/[^0-9.-]/g, ''));
      const cmp = (!isNaN(an) && !isNaN(bn))
        ? an - bn
        : av.localeCompare(bv, 'vi');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortCol, sortDir]);

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colIdx);
      setSortDir('asc');
    }
  };

  const exportCsv = () => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      data.columns.map(escape).join(','),
      ...data.rows.map(row => row.map(escape).join(',')),
    ];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: number }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-accent" />
      : <ArrowDown className="w-3 h-3 text-accent" />;
  };

  return (
    <div className="mt-3 rounded-2xl border border-border/60 bg-elevated overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <Table2 className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="text-[13px] font-semibold text-text-primary truncate">{data.title}</span>
          <span className="text-[11px] text-text-muted bg-border/40 px-1.5 py-0.5 rounded-full flex-shrink-0">
            {sortedRows.length} / {data.rows.length} mục
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Filter input */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Lọc..."
              className="pl-6 pr-2.5 py-1 rounded-lg border border-border/60 bg-surface text-[12px] text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors w-28"
            />
          </div>

          {/* Export CSV */}
          <button
            onClick={exportCsv}
            title="Xuất CSV"
            aria-label="Xuất bảng ra file CSV"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/60 bg-surface text-[12px] text-text-secondary hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition-colors cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/40 bg-surface/50">
              {data.columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="group px-4 py-2.5 text-left font-semibold text-text-secondary whitespace-nowrap cursor-pointer hover:text-accent hover:bg-accent/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col}</span>
                    <SortIcon col={i} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={data.columns.length} className="px-4 py-6 text-center text-text-muted text-[12px]">
                  Không có kết quả phù hợp với bộ lọc
                </td>
              </tr>
            ) : (
              sortedRows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-border/30 last:border-0 hover:bg-hover/50 transition-colors"
                >
                  {data.columns.map((_, ci) => (
                    <td
                      key={ci}
                      className="px-4 py-2.5 text-text-primary align-top"
                    >
                      {row[ci] === '—' || row[ci] == null
                        ? <span className="text-text-muted">—</span>
                        : row[ci]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
