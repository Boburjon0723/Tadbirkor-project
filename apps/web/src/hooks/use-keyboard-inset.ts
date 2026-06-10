'use client';

import { useEffect, useState } from 'react';

/** Mobil brauzer klaviaturasi ochilganda pastki inset (px) */
export function useKeyboardInset(active = true) {
  const [inset, setInset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [offsetTop, setOffsetTop] = useState(0);

  useEffect(() => {
    if (!active || typeof window === 'undefined') {
      setInset(0);
      setViewportHeight(null);
      setOffsetTop(0);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const keyboard = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop,
      );
      setInset(keyboard);
      setViewportHeight(vv.height);
      setOffsetTop(vv.offsetTop);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [active]);

  return { inset, viewportHeight, offsetTop };
}
