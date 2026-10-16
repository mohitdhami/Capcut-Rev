import { create } from 'zustand';

export interface CtxItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

interface UIState {
  contextMenu: { x: number; y: number; items: CtxItem[] } | null;
  openContextMenu: (x: number, y: number, items: CtxItem[]) => void;
  closeContextMenu: () => void;
  fonts: Record<string, string>;
  setFonts: (f: Record<string, string>) => void;
  mediaTab: string;
  setMediaTab: (t: string) => void;
}

export const useUI = create<UIState>()((set) => ({
  contextMenu: null,
  openContextMenu: (x, y, items) => set({ contextMenu: { x, y, items } }),
  closeContextMenu: () => set({ contextMenu: null }),
  fonts: {},
  setFonts: (fonts) => set({ fonts }),
  mediaTab: 'media',
  setMediaTab: (mediaTab) => set({ mediaTab }),
}));
