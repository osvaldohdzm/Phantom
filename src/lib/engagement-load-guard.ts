import { useCallback, useRef } from 'react';

/** Evita que respuestas tardías de un proyecto anterior pisen el estado del proyecto actual. */
export function useEngagementLoadGuard() {
  const generationRef = useRef(0);

  const beginLoad = useCallback(() => {
    generationRef.current += 1;
    return generationRef.current;
  }, []);

  const invalidate = useCallback(() => {
    generationRef.current += 1;
  }, []);

  const isStale = useCallback((generation: number) => generation !== generationRef.current, []);

  return { beginLoad, invalidate, isStale };
}
