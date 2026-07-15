'use client';

import { useEffect, useState } from 'react';

/**
 * Detect whether the current device is touch-primary (iPad, phone)
 * Uses `pointer: coarse` media query + iPad-specific UA heuristics.
 * SSR-safe: returns false during server render.
 */
export function useTouchDevice() {
  const [state, setState] = useState({ isTouchDevice: false, isIPad: false });

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const ua = navigator.userAgent;
    const isIPad =
      /iPad/.test(ua) ||
      (/Macintosh/.test(ua) && hasTouch); // iPadOS reports as Mac
    setState({ isTouchDevice: coarse || isIPad, isIPad });
  }, []);

  return state;
}
