import { create } from 'zustand';

// Estado de escena compartido entre la página (panel, consulta o landing) y el lienzo 3D.
export const useScene = create((set) => ({
  vehicles: [], others: [], selectedId: null, focus: null, fallback: false, ready: false,
  setData: (vehicles, others = []) => set({ vehicles, others }),
  select: (selectedId) => set({ selectedId }),
  focusOn: (id) => set({ focus: { id, n: Date.now() } }),
  setFallback: (fallback) => set({ fallback }),
  setReady: (ready) => set({ ready }),
  reset: () => set({ vehicles: [], others: [], selectedId: null, focus: null, ready: false }),
}));
