import { useEffect, useRef, useState } from 'react';

/** Tracks an element's size, so layouts can show exactly what fits without scrolling. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

export function useElementHeight<T extends HTMLElement>() {
  const [ref, size] = useElementSize<T>();
  return [ref, size.height] as const;
}
