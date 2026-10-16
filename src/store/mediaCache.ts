import { create } from 'zustand';
import type { MediaAsset } from '../types';
import { generateFilmstrip, generateThumbnail, getWaveform } from '../utils/media';

interface MediaCacheState {
  thumbs: Record<string, string>;
  filmstrips: Record<string, string[]>;
  waveforms: Record<string, number[]>;
  pendingThumbs: Set<string>;
  pendingFilmstrips: Set<string>;
  pendingWaveforms: Set<string>;
  ensureThumb: (asset: MediaAsset) => void;
  ensureFilmstrip: (asset: MediaAsset) => void;
  ensureWaveform: (asset: MediaAsset) => void;
}

export const useMediaCache = create<MediaCacheState>()((set, get) => ({
  thumbs: {},
  filmstrips: {},
  waveforms: {},
  pendingThumbs: new Set(),
  pendingFilmstrips: new Set(),
  pendingWaveforms: new Set(),

  ensureThumb: (asset) => {
    const s = get();
    if (s.thumbs[asset.path] !== undefined || s.pendingThumbs.has(asset.path)) return;
    s.pendingThumbs.add(asset.path);
    generateThumbnail(asset).then((url) => {
      set((st) => ({
        thumbs: url ? { ...st.thumbs, [asset.path]: url } : st.thumbs,
        pendingThumbs: new Set([...st.pendingThumbs].filter((p) => p !== asset.path)),
      }));
    });
  },

  ensureFilmstrip: (asset) => {
    const s = get();
    if (s.filmstrips[asset.path] !== undefined || s.pendingFilmstrips.has(asset.path)) return;
    s.pendingFilmstrips.add(asset.path);
    generateFilmstrip(asset, 8).then((frames) => {
      set((st) => ({
        filmstrips: { ...st.filmstrips, [asset.path]: frames },
        pendingFilmstrips: new Set([...st.pendingFilmstrips].filter((p) => p !== asset.path)),
      }));
    });
  },

  ensureWaveform: (asset) => {
    const s = get();
    if (s.waveforms[asset.path] !== undefined || s.pendingWaveforms.has(asset.path)) return;
    s.pendingWaveforms.add(asset.path);
    getWaveform(asset).then((peaks) => {
      set((st) => ({
        waveforms: { ...st.waveforms, [asset.path]: peaks },
        pendingWaveforms: new Set([...st.pendingWaveforms].filter((p) => p !== asset.path)),
      }));
    });
  },
}));
