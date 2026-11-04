'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useElementHeight } from '@/lib/use-element-height';

export interface SheetColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
  /** Fixed width in pixels. Columns without one share what's left. */
  width?: number;
}

export interface SheetCell {
  text: string;
  /** The raw number. Giving a cell one makes it editable. */
  value?: number;
  /** Custom content, such as a dropdown. */
  node?: React.ReactNode;
  strong?: boolean;
  tone?: 'good' | 'warn';
}

export interface SheetRow {
  id: string;
  cells: Record<string, SheetCell>;
  onOpen?: () => void;
}

interface SheetGridProps {
  columns: SheetColumn[];
  rows: SheetRow[];
  /** Pinned under the rows, like a totals row. */
  total?: SheetRow;
  onEdit?: (rowId: string, columnKey: string, value: number) => void;
  /** Lets a dragged purchase be dropped on a row. Receives the row and the purchase. */
  onDropItem?: (rowId: string, itemId: string) => void;
  /** A gentle note under the sheet when there's room for it. */
  hint?: string;
  /** Change this to replay the rows filling in, after new data arrives. */
  fillKey?: number;
}

const MIN_ROW_HEIGHT = 34;
const MAX_ROW_HEIGHT = 48;

/** Marks a drag as a purchase moving between sheets, not a file from the desktop. */
export const ITEM_DRAG_TYPE = 'text/pathfinder-item';

const CELL = 'border-b border-r border-[var(--pf-border)] px-2 text-[14px] leading-none last:border-r-0';

/** A real spreadsheet: click a cell, type, Enter. It pages rather than scrolls, so it always fits the window. */
export default function SheetGrid({ columns, rows, total, onEdit, onDropItem, hint, fillKey = 0 }: SheetGridProps) {
  const [areaRef, areaHeight] = useElementHeight<HTMLDivElement>();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{ row: number; column: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [dropRow, setDropRow] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Header and total rows count too. Rows then stretch to fill the sheet comfortably.
  const extraRows = 1 + (total ? 1 : 0);
  const capacity = Math.max(1, Math.floor(areaHeight / MIN_ROW_HEIGHT) - extraRows);
  const needsPages = rows.length > capacity;
  const perPage = needsPages ? Math.max(1, capacity - 1) : capacity;
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const shownRows = Math.min(rows.length, perPage) + extraRows;
  const rowHeight = needsPages
    ? MIN_ROW_HEIGHT
    : Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, Math.floor(areaHeight / shownRows)));
  const currentPage = Math.min(page, pages - 1);
  const visible = rows.slice(currentPage * perPage, (currentPage + 1) * perPage);

  const cellAt = (row: number, column: number) => visible[row]?.cells[columns[column]?.key];

  const startEdit = (row: number, column: number, initial?: string) => {
    const cell = cellAt(row, column);
    if (cell?.value === undefined) return;
    setSelected({ row, column });
    setText(initial ?? (cell.value === 0 ? '' : String(cell.value)));
    setEditing(true);
  };

  const commit = () => {
    if (selected && editing) {
      const row = visible[selected.row];
      const key = columns[selected.column].key;
      const next = Number(text.replace(/[^\d.]/g, '')) || 0;
      if (row && next !== row.cells[key]?.value) onEdit?.(row.id, key, next);
    }
    setEditing(false);
  };

  const move = (rowBy: number, columnBy: number) => {
    setSelected((current) => {
      if (!current) return { row: 0, column: 1 };
      return {
        row: Math.max(0, Math.min(visible.length - 1, current.row + rowBy)),
        column: Math.max(0, Math.min(columns.length - 1, current.column + columnBy)),
      };
    });
  };

  useEffect(() => {
    if (!editing) gridRef.current?.focus({ preventScroll: true });
  }, [editing]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (editing) {
      if (event.key === 'Enter') { commit(); move(1, 0); event.preventDefault(); }
      if (event.key === 'Tab') { commit(); move(0, 1); event.preventDefault(); }
      if (event.key === 'Escape') setEditing(false);
      return;
    }
    if (event.key === 'ArrowDown') move(1, 0);
    else if (event.key === 'ArrowUp') move(-1, 0);
    else if (event.key === 'ArrowRight') move(0, 1);
    else if (event.key === 'ArrowLeft') move(0, -1);
    else if (event.key === 'Tab') move(0, event.shiftKey ? -1 : 1);
    else if (selected && (event.key === 'Enter' || event.key === 'F2')) startEdit(selected.row, selected.column);
    else if (selected && /^\d$/.test(event.key)) startEdit(selected.row, selected.column, event.key);
    else return;
    event.preventDefault();
  };

  const renderCell = (row: SheetRow, column: SheetColumn, columnIndex: number, rowIndex: number | null) => {
    const cell = row.cells[column.key];
    const isSelected = rowIndex !== null && selected?.row === rowIndex && selected.column === columnIndex;
    const isFirst = columnIndex === 0;
    const editable = cell?.value !== undefined;
    return (
      <td
        key={column.key}
        role="gridcell"
        onClick={() => {
          if (rowIndex === null) return;
          if (isSelected && editing) return;
          commit();
          if (editable) startEdit(rowIndex, columnIndex);
          else setSelected({ row: rowIndex, column: columnIndex });
          if (isFirst) row.onOpen?.();
        }}
        className={`${CELL} truncate ${column.align === 'right' ? 'text-right' : 'text-left'} ${cell?.strong ? 'font-semibold' : ''} ${isFirst && row.onOpen ? 'cursor-pointer' : ''} ${editable ? 'cursor-cell' : ''}`}
        style={{
          ...(isSelected ? { outline: '2px solid var(--pf-text-primary)', outlineOffset: -2 } : {}),
          color: cell?.tone === 'warn' ? 'var(--pf-warn)' : cell?.tone === 'good' ? 'var(--pf-good)' : undefined,
        }}
      >
        {isSelected && editing ? (
          <input
            autoFocus
            inputMode="numeric"
            aria-label={`Edit ${column.label}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={commit}
            onFocus={(event) => event.target.select()}
            className="h-full w-full bg-transparent text-right outline-none"
          />
        ) : cell?.node ?? cell?.text}
      </td>
    );
  };

  return (
    <div ref={areaRef} className="min-h-0 flex-1 overflow-hidden">
      <div ref={gridRef} tabIndex={0} onKeyDown={onKeyDown} className="overflow-hidden rounded-[12px] border border-[var(--pf-border)] outline-none">
        <table role="grid" className="w-full table-fixed border-collapse">
          <colgroup>
            {columns.map((column) => <col key={column.key} style={column.width ? { width: column.width } : undefined} />)}
          </colgroup>
          <thead>
            <tr style={{ height: rowHeight }}>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={`${CELL} truncate bg-[var(--pf-bg-elevated)] font-semibold ${column.align === 'right' ? 'text-right' : 'text-left'}`}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <motion.tr
                key={`${row.id}-${fillKey}`}
                style={{ height: rowHeight, ...(dropRow === row.id ? { background: 'var(--pf-text-primary)', color: 'var(--pf-text-inverse)' } : {}) }}
                onDragOver={onDropItem ? (event) => {
                  if (!event.dataTransfer.types.includes(ITEM_DRAG_TYPE)) return;
                  event.preventDefault();
                  setDropRow(row.id);
                } : undefined}
                onDragLeave={onDropItem ? () => setDropRow(null) : undefined}
                onDrop={onDropItem ? (event) => {
                  const item = event.dataTransfer.getData(ITEM_DRAG_TYPE);
                  if (!item) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setDropRow(null);
                  onDropItem(row.id, item);
                } : undefined}
                initial={fillKey > 0 ? { opacity: 0, x: -6 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: rowIndex * 0.035 }}
              >
                {columns.map((column, columnIndex) => renderCell(row, column, columnIndex, rowIndex))}
              </motion.tr>
            ))}
            {total && (
              <tr style={{ height: rowHeight }} className="bg-[var(--pf-bg-elevated)]">
                {columns.map((column, columnIndex) => renderCell(total, column, columnIndex, null))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {hint && pages === 1 && <p className="px-1 pt-3 text-center text-[14px] text-[var(--pf-text-tertiary)]">{hint}</p>}
      {pages > 1 && (
        <div className="flex h-[30px] items-center justify-end gap-3 text-[14px] text-[var(--pf-text-secondary)]">
          <button type="button" aria-label="Previous rows" disabled={currentPage === 0} className="cursor-pointer disabled:opacity-25" onClick={() => setPage(currentPage - 1)}>←</button>
          Page {currentPage + 1} of {pages}
          <button type="button" aria-label="More rows" disabled={currentPage === pages - 1} className="cursor-pointer disabled:opacity-25" onClick={() => setPage(currentPage + 1)}>→</button>
        </div>
      )}
    </div>
  );
}
