import {
  useEditor,
  normalizeProject,
  uid,
  canPlaceOnTrack,
  findFreeStart,
  tracksByType,
  clipEnd,
} from '../store/editor';
import { useMediaCache } from '../store/mediaCache';
import type { ClipKind, MediaAsset } from '../types';

export async function importMedia(): Promise<number> {
  const results = await window.api.selectMedia();
  if (!results || results.length === 0) return 0;
  const assets: MediaAsset[] = results
    .filter((r) => !('error' in r) || !(r as { error?: string }).error)
    .map((r) => ({
      id: uid(),
      path: r.path,
      url: r.url,
      name: r.name,
      kind: r.kind,
      duration: r.duration || (r.kind === 'image' ? 5 : 0),
      width: r.width,
      height: r.height,
      fps: r.fps,
      rotation: r.rotation,
      hasAudio: r.hasAudio,
    }));
  if (assets.length === 0) return 0;
  useEditor.getState().addAssets(assets);
  const sel = useEditor.getState();
  sel.selectAssets(assets.map((a) => a.id));
  const cache = useMediaCache.getState();
  for (const a of assets) {
    cache.ensureThumb(a);
    if (a.kind === 'video') cache.ensureFilmstrip(a);
    if (a.hasAudio) cache.ensureWaveform(a);
  }
  sel.showToast(`Imported ${assets.length} media file${assets.length === 1 ? '' : 's'}`);
  return assets.length;
}

export function pickTrackForKind(kind: ClipKind, atTime: number, duration: number, preferredTrackId?: string): string | null {
  const s = useEditor.getState();
  const project = s.project;
  if (preferredTrackId) {
    const t = project.tracks.find((x) => x.id === preferredTrackId);
    if (t && canPlaceOnTrack(t, kind)) return t.id;
  }
  const order: ('video' | 'overlay' | 'audio')[] =
    kind === 'audio' ? ['audio', 'overlay'] : ['video', 'overlay'];
  for (const type of order) {
    const tracks = tracksByType(project, type);
    for (const t of tracks) {
      if (!canPlaceOnTrack(t, kind)) continue;
      if (findFreeStart(project, t.id, atTime, duration) <= atTime + 1e-6) return t.id;
    }
  }
  return s.addTrack(kind === 'audio' ? 'audio' : 'overlay');
}

export function addAssetToTimeline(assetId: string, atTime?: number, preferredTrackId?: string): void {
  const s = useEditor.getState();
  const asset = s.project.assets.find((a) => a.id === assetId);
  if (!asset) return;
  const kind: ClipKind = asset.kind;
  const start = atTime ?? s.currentTime;
  const duration = asset.kind === 'image' ? 3 : asset.duration > 0 ? asset.duration : 5;
  const trackId = pickTrackForKind(kind, start, duration, preferredTrackId);
  if (!trackId) return;
  const placed = findFreeStart(s.project, trackId, start, duration);
  s.addClip({ kind, trackId, start: placed, duration, offset: 0, assetId: asset.id });
  const cache = useMediaCache.getState();
  if (asset.kind === 'video') cache.ensureFilmstrip(asset);
  if (asset.hasAudio) cache.ensureWaveform(asset);
}

export function addTextAt(atTime?: number, presetPatch?: Record<string, unknown>): void {
  const s = useEditor.getState();
  const start = atTime ?? s.currentTime;
  const id = s.addTextClip(start);
  if (presetPatch) {
    s.updateClip(id, (c) => ({ text: { ...c.text!, ...(presetPatch as object) } }));
  }
}

export function addStickerAt(emoji: string, atTime?: number): void {
  const s = useEditor.getState();
  const start = atTime ?? s.currentTime;
  s.addStickerClip(emoji, start);
}

export async function importFilesByPath(paths: string[]): Promise<number> {
  const assets: MediaAsset[] = [];
  for (const p of paths) {
    const probe = await window.api.probeFile(p);
    if (!probe) continue;
    assets.push({
      id: uid(),
      path: probe.path,
      url: probe.url,
      name: probe.name,
      kind: probe.kind,
      duration: probe.duration || (probe.kind === 'image' ? 5 : 0),
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      rotation: probe.rotation,
      hasAudio: probe.hasAudio,
    });
  }
  if (assets.length === 0) return 0;
  const s = useEditor.getState();
  s.addAssets(assets);
  s.selectAssets(assets.map((a) => a.id));
  const cache = useMediaCache.getState();
  for (const a of assets) {
    cache.ensureThumb(a);
    if (a.kind === 'video') cache.ensureFilmstrip(a);
    if (a.hasAudio) cache.ensureWaveform(a);
  }
  s.showToast(`Imported ${assets.length} media file${assets.length === 1 ? '' : 's'}`);
  return assets.length;
}

export async function importFromDrop(dataTransfer: DataTransfer): Promise<number> {
  const paths: string[] = [];
  for (const file of Array.from(dataTransfer.files)) {
    const p = window.api.getPathForFile(file);
    if (p) paths.push(p);
  }
  if (paths.length === 0) return 0;
  return importFilesByPath(paths);
}

export function detachAudio(clipIds: string[]): void {
  const s = useEditor.getState();
  const project = s.project;
  const targets = project.clips.filter((c) => clipIds.includes(c.id) && c.kind === 'video' && c.assetId);
  if (targets.length === 0) {
    s.showToast('Selected clips have no audio to detach');
    return;
  }
  let audioTrack = project.tracks.find((t) => t.type === 'audio');
  const createdIds: string[] = [];
  s.commit((d) => {
    if (!audioTrack) {
      audioTrack = { id: uid(), type: 'audio', name: '', muted: false, hidden: false, locked: false };
      d.tracks.push(audioTrack);
    }
    for (const t of targets) {
      const src = d.clips.find((c) => c.id === t.id);
      if (!src) continue;
      src.muted = true;
      const copy = structuredClone(src);
      copy.id = uid();
      copy.kind = 'audio';
      copy.trackId = audioTrack!.id;
      copy.muted = false;
      copy.volume = 1;
      copy.effects = [];
      copy.chromaKey = { ...copy.chromaKey, enabled: false };
      copy.filterId = null;
      copy.transitionIn = null;
      copy.start = t.start;
      d.clips.push(copy);
      createdIds.push(copy.id);
    }
  });
  if (createdIds.length) s.selectClips(createdIds);
  const anyAsset = project.assets.find((a) => a.id === targets[0].assetId);
  if (anyAsset) useMediaCache.getState().ensureWaveform(anyAsset);
  s.showToast('Audio detached');
}

export function serializeProject(): string {
  const { project } = useEditor.getState();
  return JSON.stringify({ version: 1, ...project }, null, 2);
}

export async function saveProject(saveAs = false): Promise<boolean> {
  const state = useEditor.getState();
  const json = serializeProject();
  try {
    if (state.projectFilePath && !saveAs) {
      await window.api.saveProjectToPath(state.projectFilePath, json);
      state.markSaved(state.projectFilePath);
      state.showToast('Project saved');
      return true;
    }
    const filePath = await window.api.saveProject(json);
    if (!filePath) return false;
    state.markSaved(filePath);
    state.showToast('Project saved');
    return true;
  } catch (err) {
    state.showToast('Save failed: ' + String(err));
    return false;
  }
}

export async function openProjectFile(): Promise<void> {
  const res = await window.api.openProject();
  if (!res) return;
  try {
    const raw = JSON.parse(res.json);
    const project = normalizeProject(raw);
    const state = useEditor.getState();
    state.loadProject(project, res.filePath);
    state.showToast('Project opened');
    await verifyAssets();
  } catch (err) {
    useEditor.getState().showToast('Open failed: invalid file format');
  }
}

export async function verifyAssets(): Promise<void> {
  const state = useEditor.getState();
  const { project } = state;
  const missing: string[] = [];
  for (const asset of project.assets) {
    const probe = await window.api.probeFile(asset.path);
    if (!probe) missing.push(asset.id);
    else if (asset.offline) state.updateAsset(asset.id, { offline: false, url: probe.url });
  }
  if (missing.length) {
    state.commit((d) => {
      for (const id of missing) {
        const a = d.assets.find((x) => x.id === id);
        if (a) a.offline = true;
      }
    });
    state.showToast(`${missing.length} media file${missing.length === 1 ? ' is' : 's are'} offline, please relink`);
  }
}
