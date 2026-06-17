'use client';

import { useEffect, useRef, useState } from 'react';

const OVERSCAN = 5;

/**
 * Virtualiza filas de la página actual (datos ya paginados en servidor).
 * No intenta cargar ni renderizar el dataset completo.
 */
export function useVirtualRows<T>({
  items,
  rowHeight,
  containerRef,
  enabled,
}: {
  items: T[];
  rowHeight: number;
  containerRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
}) {
  const [range, setRange] = useState({ start: 0, end: Math.min(items.length, 30) });

  useEffect(() => {
    if (!enabled) {
      setRange({ start: 0, end: items.length });
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const scrollTop = el.scrollTop;
      const height = el.clientHeight || 480;
      const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
      const visible = Math.ceil(height / rowHeight) + OVERSCAN * 2;
      const end = Math.min(items.length, start + visible);
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    update();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [items.length, rowHeight, enabled, containerRef]);

  if (!enabled) {
    return {
      rows: items.map((item, index) => ({ item, index })),
      paddingTop: 0,
      paddingBottom: 0,
    };
  }

  const paddingTop = range.start * rowHeight;
  const paddingBottom = Math.max(0, (items.length - range.end) * rowHeight);
  const rows = items.slice(range.start, range.end).map((item, i) => ({
    item,
    index: range.start + i,
  }));

  return { rows, paddingTop, paddingBottom };
}
