import { useState } from 'react';

export type PinnedCol = 'item' | 'key' | 'total';

// Resizable widths for the three pinned columns; drive both cell width and sticky left offset.
export function useColumnResize() {
  const [colW, setColW] = useState({ item: 220, key: 110, total: 80 });

  // Drag a column's right edge to resize. ponytail: min 60px, no max — good enough here.
  const startResize = (col: PinnedCol, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colW[col];
    const onMove = (ev: MouseEvent) =>
      setColW((w) => ({ ...w, [col]: Math.max(60, startW + ev.clientX - startX) }));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return { colW, startResize };
}

// Drag handle on a column's right edge. Absolute, so the header cell needs `relative`.
export function ResizeGrip({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <span
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-primary/40"
    />
  );
}
