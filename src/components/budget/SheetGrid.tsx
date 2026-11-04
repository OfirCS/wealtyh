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
  /** Change this to replay the rows filling in, after new data arrives. */
  fillKey?: number;
}

const ROW_HEIGHT = 34;
const LETTER_HEIGHT = 22;
const GUTTER_WIDTH = 34;

/** Marks a drag as a purchase moving between sheets, not a file from the desktop. */
export const ITEM_DRAG_TYPE = 'text/pathfinder-item';

const CELL = 'border border-[var(--pf-border)] px-2 text-[14px] leading-none';

function columnLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** A real spreadsheet: click a cell, type, Enter. It pages rather than scrolls, so it always fits the window. */
export default function SheetGrid({ columns, rows, total, onEdit, onDropItem, fillKey = 0 }: SheetGridProps) {
  const [areaRef, areaHeight] = useElementHeight<HTMLDivElement>();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{ row: number; column: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [dropRow, setDropRow] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const chrome = LETTER_HEIGHT + ROW_HEIGHT + (total ? ROW_HEIGHT : 0);
  const capacity = Math.max(1, Math.floor((areaHeight - chrome) / ROW_HEIGHT));
  const needsPages = rows.length > capacity;
  const perPage = needsPages ? Math.max(1, capacity - 1) : capacity;
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const currentPage = Math.min(page, pages - 1);
  const visible = rows.slice(currentPage * perPage, (currentPage + 1) * perPage);
  // Blank rows fill the rest of the card, the way a spreadsheet always looks full
  const emptyRows = areaHeight > 0 ? Math.max(0, perPage - visible.length) : 0;

  const cellAt = (row: number, column: number) => visible[row]?.cells[columns[column]?.key];

  const startEdit = (initial?: string) => {
    if (!selected) return;
    const cell = cellAt(selected.row, selected.column);
    if (cell?.value === undefined) return;
    setText(initial ?? String(cell.value));
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
    else if (event.key === 'Enter' || event.key === 'F2') startEdit();
    else if (/^\d$/.test(event.key)) startEdit(event.key);
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
          if (isSelected && editable) startEdit();
          else {
            commit();
            setSelected({ row: rowIndex, column: columnIndex });
          }
          if (isFirst) row.onOpen?.();
        }}
        className={`${CELL} truncate ${column.align === 'right' ? 'text-right' : 'text-left'} ${cell?.strong ? 'font-semibold' : ''} ${isFirst && row.onOpen ? 'cursor-pointer' : ''} ${editable ? 'cursor-cell' : ''}`}
        style={isSelected ? { outline: '2px solid var(--pf-text-primary)', outlineOffset: -2 } : undefined}
      >
        {isSelected && editing ? (
          <input
            autoFocus
            inputMode="numeric"
            aria-label={`Edit ${column.label}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={commit}
            className="h-full w-full bg-transparent text-right outline-none"
          />
        ) : cell?.node ?? cell?.text}
      </td>
    );
  };

  return (
    <div ref={areaRef} className="min-h-0 flex-1 overflow-hidden">
      <div ref={gridRef} tabIndex={0} onKeyDown={onKeyDown} className="outline-none">
        <table role="grid" className="w-full table-fixed border-collapse">
          <colgroup>
            <col style={{ width: GUTTER_WIDTH }} />
            {columns.map((column) => <col key={column.key} style={column.width ? { width: column.width } : undefined} />)}
          </colgroup>
          <thead>
            <tr aria-hidden style={{ height: LETTER_HEIGHT }} className="bg-[var(--pf-bg-elevated)] text-[11px] text-[var(--pf-text-tertiary)]">
              <th className="border border-[var(--pf-border)] font-normal" />
              {columns.map((column, index) => <th key={column.key} className="border border-[var(--pf-border)] font-normal">{columnLetter(index)}</th>)}
            </tr>
            <tr style={{ height: ROW_HEIGHT }}>
              <th aria-hidden className="border border-[var(--pf-border)] bg-[var(--pf-bg-elevated)] text-[11px] font-normal text-[var(--pf-text-tertiary)]">1</th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={`${CELL} truncate bg-[var(--pf-bg-elevated)] font-semibold ${column.align === 'right' ? 'text-right' : 'text-left'}`}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <motion.tr
                key={`${row.id}-${fillKey}`}
                style={{ height: ROW_HEIGHT, ...(dropRow === row.id ? { background: 'var(--pf-text-primary)', color: 'var(--pf-text-inverse)' } : {}) }}
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
                <td aria-hidden className="border border-[var(--pf-border)] bg-[var(--pf-bg-elevated)] text-center text-[11px] text-[var(--pf-text-tertiary)]">{rowIndex + 2 + currentPage * perPage}</td>
                {columns.map((column, columnIndex) => renderCell(row, column, columnIndex, rowIndex))}
              </motion.tr>
            ))}
            {Array.from({ length: emptyRows }, (_, index) => (
              <tr key={`empty-${index}`} aria-hidden style={{ height: ROW_HEIGHT }}>
                <td className="border border-[var(--pf-border)] bg-[var(--pf-bg-elevated)] text-center text-[11px] text-[var(--pf-text-tertiary)]">{visible.length + index + 2 + currentPage * perPage}</td>
                {columns.map((column) => <td key={column.key} className="border border-[var(--pf-border)]" />)}
              </tr>
            ))}
            {total && (
              <tr style={{ height: ROW_HEIGHT }} className="bg-[var(--pf-bg-elevated)]">
                <td aria-hidden className="border border-[var(--pf-border)] text-center text-[11px] text-[var(--pf-text-tertiary)]">Σ</td>
                {columns.map((column, columnIndex) => renderCell(total, column, columnIndex, null))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
