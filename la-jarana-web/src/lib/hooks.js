import { useEffect, useState } from 'react';

// pointer: fine (hover real, ratón) — los hovers y el cursor solo existen ahí.
export function useFinePointer() {
  const [fine, set] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(hover: hover) and (pointer: fine)');
    const f = () => set(m.matches);
    f(); m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return fine;
}

export const splitWords = (s) => s.split(/\s+/).filter(Boolean);
