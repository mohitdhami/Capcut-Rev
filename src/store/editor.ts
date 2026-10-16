import { create } from 'zustand';
import type {
  Clip,
  ClipKind,
  Keyframe,
  KeyframeProperty,
  MediaAsset,
  Project,
  ProjectSettings,
  Track,
  TrackType,
  Transition,
} from '../types';
import { EFFECTS } from '../constants';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const DEFAULT_TRANSFORM = { x: 0, y: 0, scale: 1, rotation: 0 };

export function createProject(name = 'Untitled Project'): Project {
  return {
    settings: {
      name,
      aspect: '16:9',
      width: 1920,
      height: 1080,
      fps: 30,
      background: '#000000',
    },
    assets: [],
    tracks: [{ id: uid(), type: 'video', name: 'Main', muted: false, hidden: false, locked: false }],
    clips: [],
  };
}

export function defaultTextData(): NonNullable<Clip['text']> {
  return {
    content: 'Default text',
    fontFamily: 'Helvetica Neue',
    fontSize: 48,
    color: '#ffffff',
    bold: false,
    italic: false,
    align: 'center',
    letterSpacing: 0,
    lineHeight: 1.25,
    strokeColor: '#000000',
    strokeWidth: 0,
    shadowColor: 'rgba(0,0,0,0)',
    shadowBlur: 0,
    shadowOffX: 0,
    shadowOffY: 0,
    bgColor: '#000000',
    bgOpacity: 0,
    bgPadding: 12,
    animationIn: null,
    animationOut: null,
    animationLoop: 'none',
  };
}

export function makeClip(partial: Partial<Clip> & { kind: ClipKind; trackId: string; start: number }): Clip {
  const base: Clip = {
    id: uid(),
    trackId: partial.trackId,
    kind: partial.kind,
    assetId: partial.assetId,
    start: Math.max(0, partial.start),
    duration: partial.duration ?? 5,
    offset: partial.offset ?? 0,
    speed: 1,
    volume: 1,
    muted: false,
    fadeIn: 0,
    fadeOut: 0,
    opacity: 1,
    transform: { ...DEFAULT_TRANSFORM },
    filterId: null,
    filterIntensity: 100,
    effects: [],
    chromaKey: { enabled: false, color: '#00ff00', similarity: 30, smoothness: 10, spill: 10 },
    keyframes: {},
    transitionIn: null,
  };
  const merged: Clip = { ...base, ...partial, id: partial.id ?? base.id, transform: { ...base.transform, ...(partial.transform || {}) } };
  if (merged.kind === 'text' && !merged.text) merged.text = defaultTextData();
  if (merged.kind === 'sticker' && !merged.sticker) merged.sticker = { emoji: '⭐' };
  return merged;
}

function normalizeClip(raw: Partial<Clip>): Clip {
  return makeClip({
    ...raw,
    id: raw.id ?? uid(),
    kind: (raw.kind ?? 'video') as ClipKind,
    trackId: raw.trackId ?? '',
    start: raw.start ?? 0,
  });
}

export function normalizeProject(input: unknown): Project {
  const p = (input ?? {}) as Partial<Project>;
  const base = createProject();
  const settings: ProjectSettings = { ...base.settings, ...(p.settings || {}) };
  const tracks: Track[] = Array.isArray(p.tracks) && p.tracks.length ? p.tracks.map((t) => ({ ...t, name: t.name ?? '', muted: !!t.muted, hidden: !!t.hidden, locked: !!t.locked })) : base.tracks;
  const clips: Clip[] = Array.isArray(p.clips) ? p.clips.map(normalizeClip).filter((c) => tracks.some((t) => t.id === c.trackId)) : [];
  const assets: MediaAsset[] = Array.isArray(p.assets) ? p.assets : [];
  return { settings, tracks, clips, assets };
}

export function clipEnd(c: Clip) {
  return c.start + c.duration;
}

export function sourceDuration(c: Clip, assets: MediaAsset[]) {
  const asset = c.assetId ? assets.find((a) => a.id === c.assetId) : undefined;
  return asset ? asset.duration : Infinity;
}

export function maxClipDuration(c: Clip, assets: MediaAsset[]) {
  const asset = c.assetId ? assets.find((a) => a.id === c.assetId) : undefined;
  if (!asset || asset.kind === 'image') return Infinity;
  return Math.max(0.05, (asset.duration - c.offset) / c.speed);
}

export function clipTransientDuration(c: Clip, assets: MediaAsset[]) {
  const asset = c.assetId ? assets.find((a) => a.id === c.assetId) : undefined;
  if (!asset) return Infinity;
  return asset.duration / c.speed;
}

export function getBaseValue(clip: Clip, prop: KeyframeProperty): number {
  switch (prop) {
    case 'positionX': return clip.transform.x;
    case 'positionY': return clip.transform.y;
    case 'scale': return clip.transform.scale;
    case 'rotation': return clip.transform.rotation;
    case 'opacity': return clip.opacity;
    case 'volume': return clip.volume;
  }
}

export function interpolateValue(kfs: Keyframe[] | undefined, time: number, fallback: number): number {
  if (!kfs || kfs.length === 0) return fallback;
  if (kfs.length === 1) return kfs[0].value;
  const sorted = kfs;
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time;
      if (span <= 0) return b.value;
      const t = (time - a.time) / span;
      const eased = t * t * (3 - 2 * t);
      return a.value + (b.value - a.value) * eased;
    }
  }
  return fallback;
}

export function resolveClipValue(clip: Clip, prop: KeyframeProperty, localTime: number): number {
  const kfs = clip.keyframes[prop];
  const base = getBaseValue(clip, prop);
  if (!kfs || kfs.length === 0) return base;
  return interpolateValue(kfs, Math.max(0, Math.min(localTime, clip.duration)), base);
}

export interface ClipboardEntry {
  clip: Clip;
  trackType: TrackType;
}

interface EditorState {
  project: Project;
  past: Project[];
  future: Project[];
  selectedClipIds: string[];
  selectedAssetIds: string[];
  currentTime: number;
  playing: boolean;
  loop: boolean;
  zoom: number;
  snapEnabled: boolean;
  projectFilePath: string | null;
  dirty: boolean;
  clipboard: ClipboardEntry[];
  exportOpen: boolean;
  exportRunning: boolean;
  toast: string | null;

  commit: (fn: (draft: Project) => void) => void;
  beginTransient: () => void;
  endTransient: () => void;
  undo: () => void;
  redo: () => void;

  selectClips: (ids: string[], additive?: boolean) => void;
  selectAssets: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;

  setTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setLoop: (l: boolean) => void;
  setZoom: (z: number) => void;
  setSnap: (s: boolean) => void;
  showToast: (msg: string | null) => void;
  setExportOpen: (open: boolean) => void;
  setExportRunning: (r: boolean) => void;

  addAssets: (assets: MediaAsset[]) => void;
  updateAsset: (id: string, patch: Partial<MediaAsset>) => void;
  removeAssets: (ids: string[]) => void;

  addTrack: (type: TrackType, atIndex?: number) => string;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  ensureOverlayTrack: () => string;

  addClip: (partial: Partial<Clip> & { kind: ClipKind; trackId: string; start: number }) => string;
  addTextClip: (start: number, trackId?: string) => string;
  addStickerClip: (emoji: string, start: number, trackId?: string) => string;
  updateClip: (id: string, patch: Partial<Clip> | ((c: Clip) => Partial<Clip>), opts?: { transient?: boolean }) => void;
  updateClips: (ids: string[], patch: Partial<Clip>, opts?: { transient?: boolean }) => void;
  moveClip: (id: string, trackId: string, start: number, opts?: { transient?: boolean }) => void;
  resizeClip: (id: string, edge: 'left' | 'right', patch: { start: number; duration: number; offset: number }, opts?: { transient?: boolean }) => void;
  removeClips: (ids: string[]) => void;
  rippleDelete: (ids: string[]) => void;
  splitAt: (time: number, ids?: string[]) => void;
  duplicateClips: (ids: string[]) => void;
  copyClips: (ids: string[]) => void;
  cutClips: (ids: string[]) => void;
  pasteClips: () => void;
  setTransition: (clipId: string, transition: Transition | null) => void;
  addEffect: (clipId: string, effectId: string) => void;
  removeEffect: (clipId: string, effectId: string) => void;

  setKeyframe: (clipId: string, prop: KeyframeProperty, time: number, value: number) => void;
  removeKeyframeAt: (clipId: string, prop: KeyframeProperty, time: number) => void;
  moveKeyframe: (clipId: string, prop: KeyframeProperty, fromTime: number, toTime: number, value: number, transient?: boolean) => void;

  setProjectSettings: (patch: Partial<ProjectSettings>) => void;
  newProject: () => void;
  loadProject: (project: Project, filePath: string | null) => void;
  markSaved: (filePath: string) => void;
}

export const useEditor = create<EditorState>()((set, get) => ({
  project: createProject(),
  past: [],
  future: [],
  selectedClipIds: [],
  selectedAssetIds: [],
  currentTime: 0,
  playing: false,
  loop: true,
  zoom: 50,
  snapEnabled: true,
  projectFilePath: null,
  dirty: false,
  clipboard: [],
  exportOpen: false,
  exportRunning: false,
  toast: null,

  commit: (fn) => {
    const { project, past } = get();
    const draft = structuredClone(project);
    fn(draft);
    set({ project: draft, past: [...past.slice(-99), project], future: [], dirty: true });
  },

  beginTransient: () => {
    const { project } = get();
    set({ past: [...get().past.slice(-99), project] } as Partial<EditorState>);
    set({ future: [], dirty: true });
  },

  endTransient: () => {
    /* snapshot already pushed in beginTransient */
  },

  undo: () => {
    const { past, future, project } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      project: prev,
      past: past.slice(0, -1),
      future: [project, ...future].slice(0, 100),
      dirty: true,
      selectedClipIds: get().selectedClipIds.filter((id) => prev.clips.some((c) => c.id === id)),
      currentTime: Math.min(get().currentTime, projectDuration(prev)),
    });
  },

  redo: () => {
    const { past, future, project } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      project: next,
      past: [...past, project].slice(-100),
      future: future.slice(1),
      dirty: true,
      selectedClipIds: get().selectedClipIds.filter((id) => next.clips.some((c) => c.id === id)),
      currentTime: Math.min(get().currentTime, projectDuration(next)),
    });
  },

  selectClips: (ids, additive) => {
    const cur = get().selectedClipIds;
    if (!additive) set({ selectedClipIds: ids, selectedAssetIds: [] });
    else {
      const next = new Set(cur);
      for (const id of ids) (next.has(id) ? next.delete(id) : next.add(id));
      set({ selectedClipIds: [...next], selectedAssetIds: [] });
    }
  },
  selectAssets: (ids, additive) => {
    if (!additive) set({ selectedAssetIds: ids, selectedClipIds: [] });
    else {
      const next = new Set(get().selectedAssetIds);
      for (const id of ids) (next.has(id) ? next.delete(id) : next.add(id));
      set({ selectedAssetIds: [...next] });
    }
  },
  clearSelection: () => set({ selectedClipIds: [], selectedAssetIds: [] }),

  setTime: (t) => set({ currentTime: Math.max(0, t) }),
  setPlaying: (p) => set({ playing: p }),
  setLoop: (l) => set({ loop: l }),
  setZoom: (z) => set({ zoom: Math.max(4, Math.min(600, z)) }),
  setSnap: (s) => set({ snapEnabled: s }),
  showToast: (msg) => {
    set({ toast: msg });
    if (msg) setTimeout(() => { if (get().toast === msg) set({ toast: null }); }, 2600);
  },
  setExportOpen: (open) => set({ exportOpen: open }),
  setExportRunning: (r) => set({ exportRunning: r }),

  addAssets: (assets) =>
    get().commit((d) => {
      const existingPaths = new Set(d.assets.map((a) => a.path));
      for (const a of assets) {
        if (!existingPaths.has(a.path)) {
          d.assets.push(a);
          existingPaths.add(a.path);
        }
      }
    }),

  updateAsset: (id, patch) =>
    get().commit((d) => {
      const a = d.assets.find((x) => x.id === id);
      if (a) Object.assign(a, patch);
    }),

  removeAssets: (ids) => {
    get().commit((d) => {
      d.assets = d.assets.filter((a) => !ids.includes(a.id));
      d.clips = d.clips.filter((c) => !(c.assetId && ids.includes(c.assetId)));
    });
    set({ selectedAssetIds: [], selectedClipIds: [] });
  },

  addTrack: (type, atIndex) => {
    const id = uid();
    get().commit((d) => {
      const track: Track = { id, type, name: '', muted: false, hidden: false, locked: false };
      if (atIndex === undefined) {
        if (type === 'video') {
          let idx = 0;
          d.tracks.forEach((t, i) => { if (t.type === 'video') idx = i + 1; });
          d.tracks.splice(idx, 0, track);
        } else if (type === 'overlay') {
          let idx = d.tracks.findIndex((t) => t.type === 'audio');
          if (idx === -1) idx = d.tracks.length;
          let lastOverlay = -1;
          d.tracks.forEach((t, i) => { if (t.type === 'overlay') lastOverlay = i; });
          d.tracks.splice(lastOverlay >= 0 ? lastOverlay + 1 : idx, 0, track);
        } else {
          d.tracks.push(track);
        }
      } else {
        d.tracks.splice(atIndex, 0, track);
      }
    });
    return id;
  },

  removeTrack: (id) => {
    get().commit((d) => {
      d.tracks = d.tracks.filter((t) => t.id !== id);
      d.clips = d.clips.filter((c) => c.trackId !== id);
    });
  },

  updateTrack: (id, patch) =>
    get().commit((d) => {
      const t = d.tracks.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    }),

  ensureOverlayTrack: () => {
    const { project } = get();
    const overlays = project.tracks.filter((t) => t.type === 'overlay');
    for (const t of overlays) {
      if (!project.clips.some((c) => c.trackId === t.id)) return t.id;
    }
    return get().addTrack('overlay');
  },

  addClip: (partial) => {
    const clip = makeClip(partial);
    get().commit((d) => { d.clips.push(clip); });
    set({ selectedClipIds: [clip.id], selectedAssetIds: [] });
    return clip.id;
  },

  addTextClip: (start, trackId) => {
    const tid = trackId ?? get().ensureOverlayTrack();
    const clip = makeClip({ kind: 'text', trackId: tid, start, duration: 3 });
    get().commit((d) => { d.clips.push(clip); });
    set({ selectedClipIds: [clip.id], selectedAssetIds: [] });
    return clip.id;
  },

  addStickerClip: (emoji, start, trackId) => {
    const tid = trackId ?? get().ensureOverlayTrack();
    const clip = makeClip({ kind: 'sticker', trackId: tid, start, duration: 3, sticker: { emoji }, transform: { x: 0, y: 0, scale: 1, rotation: 0 } });
    get().commit((d) => { d.clips.push(clip); });
    set({ selectedClipIds: [clip.id], selectedAssetIds: [] });
    return clip.id;
  },

  updateClip: (id, patch, opts) => {
    const apply = (d: Project) => {
      const c = d.clips.find((x) => x.id === id);
      if (!c) return;
      const p = typeof patch === 'function' ? patch(c) : patch;
      Object.assign(c, p);
      if (p.transform) c.transform = { ...c.transform, ...p.transform };
    };
    if (opts?.transient) {
      const project = structuredClone(get().project);
      apply(project);
      set({ project, dirty: true });
    } else {
      get().commit(apply);
    }
  },

  updateClips: (ids, patch, opts) => {
    const apply = (d: Project) => {
      for (const id of ids) {
        const c = d.clips.find((x) => x.id === id);
        if (c) Object.assign(c, patch);
      }
    };
    if (opts?.transient) {
      const project = structuredClone(get().project);
      apply(project);
      set({ project, dirty: true });
    } else {
      get().commit(apply);
    }
  },

  moveClip: (id, trackId, start, opts) => {
    const apply = (d: Project) => {
      const c = d.clips.find((x) => x.id === id);
      if (!c) return;
      c.trackId = trackId;
      c.start = Math.max(0, start);
      if (c.transitionIn && start <= 0) c.transitionIn = null;
    };
    if (opts?.transient) {
      const project = structuredClone(get().project);
      apply(project);
      set({ project, dirty: true });
    } else {
      get().commit(apply);
    }
  },

  resizeClip: (id, edge, patch, opts) => {
    const apply = (d: Project) => {
      const c = d.clips.find((x) => x.id === id);
      if (!c) return;
      c.start = Math.max(0, patch.start);
      c.duration = Math.max(0.05, patch.duration);
      c.offset = Math.max(0, patch.offset);
      if (c.transitionIn && c.start <= 0) c.transitionIn = null;
    };
    if (opts?.transient) {
      const project = structuredClone(get().project);
      apply(project);
      set({ project, dirty: true });
    } else {
      get().commit(apply);
    }
  },

  removeClips: (ids) => {
    get().commit((d) => { d.clips = d.clips.filter((c) => !ids.includes(c.id)); });
    set({ selectedClipIds: get().selectedClipIds.filter((id) => !ids.includes(id)) });
  },

  rippleDelete: (ids) => {
    const { project } = get();
    const removed = project.clips.filter((c) => ids.includes(c.id));
    if (removed.length === 0) return;
    get().commit((d) => {
      d.clips = d.clips.filter((c) => !ids.includes(c.id));
      for (const r of removed) {
        for (const c of d.clips) {
          if (c.trackId === r.trackId && c.start >= clipEnd(r) - 1e-6) {
            c.start = Math.max(0, c.start - r.duration);
          }
        }
      }
    });
    set({ selectedClipIds: get().selectedClipIds.filter((id) => !ids.includes(id)) });
  },

  splitAt: (time, ids) => {
    const { project, selectedClipIds } = get();
    const targetIds = ids ?? selectedClipIds;
    const toSplit = project.clips.filter(
      (c) => targetIds.includes(c.id) && time > c.start + 0.02 && time < clipEnd(c) - 0.02
    );
    if (toSplit.length === 0) return;
    get().commit((d) => {
      for (const c of toSplit) {
        const target = d.clips.find((x) => x.id === c.id);
        if (!target) continue;
        const leftDuration = time - target.start;
        const rightDuration = target.duration - leftDuration;
        const right: Clip = structuredClone(target);
        right.id = uid();
        right.start = time;
        right.duration = rightDuration;
        right.offset = target.offset + leftDuration * target.speed;
        right.transitionIn = null;
        right.fadeIn = 0;
        for (const key of Object.keys(right.keyframes) as KeyframeProperty[]) {
          const kfs = right.keyframes[key];
          if (!kfs) continue;
          right.keyframes[key] = kfs
            .filter((k) => k.time >= leftDuration)
            .map((k) => ({ time: k.time - leftDuration, value: k.value }));
        }
        target.duration = leftDuration;
        target.fadeOut = 0;
        for (const key of Object.keys(target.keyframes) as KeyframeProperty[]) {
          const kfs = target.keyframes[key];
          if (!kfs) continue;
          target.keyframes[key] = kfs.filter((k) => k.time <= leftDuration);
        }
        d.clips.push(right);
      }
    });
  },

  duplicateClips: (ids) => {
    const { project } = get();
    const newIds: string[] = [];
    get().commit((d) => {
      for (const id of ids) {
        const c = d.clips.find((x) => x.id === id);
        if (!c) continue;
        const copy = structuredClone(c);
        copy.id = uid();
        copy.start = clipEnd(c) + 0.05;
        d.clips.push(copy);
        newIds.push(copy.id);
      }
    });
    if (newIds.length) set({ selectedClipIds: newIds });
  },

  copyClips: (ids) => {
    const { project } = get();
    const entries: ClipboardEntry[] = [];
    for (const id of ids) {
      const c = project.clips.find((x) => x.id === id);
      if (!c) continue;
      const track = project.tracks.find((t) => t.id === c.trackId);
      entries.push({ clip: structuredClone(c), trackType: track?.type ?? 'overlay' });
    }
    set({ clipboard: entries });
  },

  cutClips: (ids) => {
    get().copyClips(ids);
    get().removeClips(ids);
  },

  pasteClips: () => {
    const { clipboard } = get();
    if (clipboard.length === 0) return;
    const { currentTime } = get();
    const baseStart = Math.min(...clipboard.map((e) => e.clip.start));
    const newIds: string[] = [];
    get().commit((d) => {
      const overlaySlots: string[] = [];
      for (const entry of clipboard) {
        const trackType = entry.trackType;
        let trackId: string;
        if (trackType === 'video') {
          const video = d.tracks.find((t) => t.type === 'video');
          trackId = video ? video.id : d.tracks[0]?.id;
        } else if (trackType === 'audio') {
          let audio = d.tracks.find((t) => t.type === 'audio');
          if (!audio) {
            audio = { id: uid(), type: 'audio', name: '', muted: false, hidden: false, locked: false };
            d.tracks.push(audio);
          }
          trackId = audio.id;
        } else {
          trackId = overlaySlots[0];
          if (!trackId) {
            let overlay = d.tracks.find((t) => t.type === 'overlay' && !d.clips.some((c) => c.trackId === t.id));
            if (!overlay) {
              overlay = { id: uid(), type: 'overlay', name: '', muted: false, hidden: false, locked: false };
              let idx = d.tracks.findIndex((t) => t.type === 'audio');
              if (idx === -1) idx = d.tracks.length;
              let lastOverlay = -1;
              d.tracks.forEach((t, i) => { if (t.type === 'overlay') lastOverlay = i; });
              d.tracks.splice(lastOverlay >= 0 ? lastOverlay + 1 : idx, 0, overlay);
            }
            overlaySlots.push(overlay.id);
            trackId = overlay.id;
          }
        }
        if (!trackId) return;
        const copy = structuredClone(entry.clip);
        copy.id = uid();
        copy.trackId = trackId;
        copy.start = currentTime + (entry.clip.start - baseStart);
        d.clips.push(copy);
        newIds.push(copy.id);
      }
    });
    if (newIds.length) set({ selectedClipIds: newIds });
  },

  setTransition: (clipId, transition) => {
    get().commit((d) => {
      const c = d.clips.find((x) => x.id === clipId);
      if (c) c.transitionIn = transition;
    });
  },

  addEffect: (clipId, effectId) => {
    get().commit((d) => {
      const c = d.clips.find((x) => x.id === clipId);
      if (!c) return;
      if (c.effects.some((e) => e.effectId === effectId)) return;
      const preset = EFFECTS.find((e) => e.id === effectId);
      c.effects.push({ id: uid(), effectId, intensity: preset?.defaultIntensity ?? 50 });
    });
  },

  removeEffect: (clipId, effectId) => {
    get().commit((d) => {
      const c = d.clips.find((x) => x.id === clipId);
      if (!c) return;
      c.effects = c.effects.filter((e) => e.effectId !== effectId);
    });
  },

  setKeyframe: (clipId, prop, time, value) => {
    get().commit((d) => {
      const c = d.clips.find((x) => x.id === clipId);
      if (!c) return;
      const arr = c.keyframes[prop] ? [...c.keyframes[prop]!] : [];
      const idx = arr.findIndex((k) => Math.abs(k.time - time) < 0.02);
      if (idx >= 0) arr[idx] = { time, value };
      else arr.push({ time, value });
      arr.sort((a, b) => a.time - b.time);
      c.keyframes[prop] = arr;
    });
  },

  removeKeyframeAt: (clipId, prop, time) => {
    get().commit((d) => {
      const c = d.clips.find((x) => x.id === clipId);
      if (!c) return;
      const arr = (c.keyframes[prop] ?? []).filter((k) => Math.abs(k.time - time) >= 0.02);
      if (arr.length) c.keyframes[prop] = arr;
      else delete c.keyframes[prop];
    });
  },

  moveKeyframe: (clipId, prop, fromTime, toTime, value, transient) => {
    const apply = (d: Project) => {
      const c = d.clips.find((x) => x.id === clipId);
      if (!c) return;
      let arr = [...(c.keyframes[prop] ?? [])];
      arr = arr.filter((k) => Math.abs(k.time - fromTime) >= 0.02);
      const t = Math.max(0, Math.min(c.duration, toTime));
      const idx = arr.findIndex((k) => Math.abs(k.time - t) < 0.02);
      if (idx >= 0) arr[idx] = { time: t, value };
      else arr.push({ time: t, value });
      arr.sort((a, b) => a.time - b.time);
      c.keyframes[prop] = arr;
    };
    if (transient) {
      const project = structuredClone(get().project);
      apply(project);
      set({ project, dirty: true });
    } else {
      get().commit(apply);
    }
  },

  setProjectSettings: (patch) => {
    get().commit((d) => { d.settings = { ...d.settings, ...patch }; });
  },

  newProject: () => {
    set({
      project: createProject(),
      past: [],
      future: [],
      selectedClipIds: [],
      selectedAssetIds: [],
      currentTime: 0,
      playing: false,
      projectFilePath: null,
      dirty: false,
      clipboard: [],
    });
  },

  loadProject: (project, filePath) => {
    set({
      project: normalizeProject(project),
      past: [],
      future: [],
      selectedClipIds: [],
      selectedAssetIds: [],
      currentTime: 0,
      playing: false,
      projectFilePath: filePath,
      dirty: false,
      clipboard: [],
    });
  },

  markSaved: (filePath) => set({ projectFilePath: filePath, dirty: false }),
}));

export function projectDuration(project: Project): number {
  let end = 0;
  for (const c of project.clips) end = Math.max(end, clipEnd(c));
  return end;
}

export function clipsOnTrack(project: Project, trackId: string): Clip[] {
  return project.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);
}

export function activeClipsAt(project: Project, time: number): Clip[] {
  return project.clips.filter((c) => time >= c.start - 1e-6 && time < clipEnd(c) + 1e-6);
}

export function previousClipOnTrack(project: Project, clip: Clip): Clip | null {
  const track = clipsOnTrack(project, clip.trackId);
  const idx = track.findIndex((c) => c.id === clip.id);
  if (idx <= 0) return null;
  return track[idx - 1];
}

export function canPlaceOnTrack(track: Track, kind: ClipKind): boolean {
  if (track.locked) return false;
  if (track.type === 'video') return kind === 'video' || kind === 'image';
  if (track.type === 'audio') return kind === 'audio';
  return true;
}

export function isTrackFreeAt(project: Project, trackId: string, start: number, duration: number, ignoreClipId?: string): boolean {
  const end = start + duration;
  return !project.clips.some(
    (c) => c.trackId === trackId && c.id !== ignoreClipId && start < clipEnd(c) - 1e-6 && end > c.start + 1e-6
  );
}

export function findFreeStart(project: Project, trackId: string, desiredStart: number, duration: number, ignoreClipId?: string): number {
  let start = Math.max(0, desiredStart);
  const clips = clipsOnTrack(project, trackId).filter((c) => c.id !== ignoreClipId);
  let moved = true;
  let guard = 0;
  while (moved && guard++ < 200) {
    moved = false;
    for (const c of clips) {
      if (start < clipEnd(c) - 1e-6 && start + duration > c.start + 1e-6) {
        start = clipEnd(c);
        moved = true;
      }
    }
  }
  return start;
}

export function tracksByType(project: Project, type: TrackType): Track[] {
  return project.tracks.filter((t) => t.type === type);
}
