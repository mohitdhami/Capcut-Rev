import { useEditor, clipEnd, projectDuration, resolveClipValue } from '../store/editor';
import type { Clip, MediaAsset, Project } from '../types';
import { renderFrame, type FrameResources } from './render';
import { loadImage } from '../utils/media';

const RENDER_MAX = 1280;

function computeRenderSize(project: Project) {
  const { width, height } = project.settings;
  const scale = RENDER_MAX / Math.max(width, height);
  return { W: Math.round(width * scale), H: Math.round(height * scale) };
}

export class PlaybackEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private lastTs = 0;
  private lastUsed = new Map<string, number>();
  private frameCounter = 0;

  private videoPool = new Map<string, HTMLVideoElement>();
  private audioPool = new Map<string, HTMLAudioElement>();
  private imageMap = new Map<string, HTMLImageElement>();
  private imageLoading = new Set<string>();

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lastTs = performance.now();
    this.start();
  }

  detach() {
    this.stop();
    for (const el of this.videoPool.values()) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    for (const el of this.audioPool.values()) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    this.videoPool.clear();
    this.audioPool.clear();
    this.imageMap.clear();
    this.canvas = null;
    this.ctx = null;
  }

  start() {
    if (this.raf) return;
    this.lastTs = performance.now();
    const tick = (ts: number) => {
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      this.tick(dt);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick(dt: number) {
    const state = useEditor.getState();
    const project = state.project;
    this.frameCounter++;

    if (state.playing) {
      const total = projectDuration(project);
      let t = state.currentTime + dt;
      if (t >= total) {
        if (state.loop && total > 0) {
          t = t % total;
          state.setTime(t);
        } else {
          state.setTime(total);
          state.setPlaying(false);
          t = total;
        }
      } else {
        state.setTime(t);
      }
    }

    const time = useEditor.getState().currentTime;
    this.syncMedia(project, time, state.playing);

    if (this.ctx && this.canvas) {
      const { W, H } = computeRenderSize(project);
      if (this.canvas.width !== W || this.canvas.height !== H) {
        this.canvas.width = W;
        this.canvas.height = H;
      }
      renderFrame(this.ctx, project, time, W, H, this.resources(project));
    }

    if (this.frameCounter % 240 === 0) this.prunePools();
  }

  private resources(project: Project): FrameResources {
    return {
      assetById: (id) => (id ? project.assets.find((a) => a.id === id) : undefined),
      videoForClip: (clip) => this.videoPool.get(clip.id) ?? null,
      imageForAsset: (asset) => this.imageForAsset(asset),
    };
  }

  private imageForAsset(asset: MediaAsset): HTMLImageElement | null {
    const cached = this.imageMap.get(asset.id);
    if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
    if (!this.imageLoading.has(asset.id)) {
      this.imageLoading.add(asset.id);
      loadImage(asset.url)
        .then((img) => this.imageMap.set(asset.id, img))
        .catch(() => {})
        .finally(() => this.imageLoading.delete(asset.id));
    }
    return null;
  }

  private ensureVideo(clip: Clip, asset: MediaAsset): HTMLVideoElement {
    let el = this.videoPool.get(clip.id);
    if (!el) {
      el = document.createElement('video');
      el.src = asset.url;
      el.preload = 'auto';
      el.playsInline = true;
      el.crossOrigin = 'anonymous';
      this.videoPool.set(clip.id, el);
    } else if (el.src !== asset.url) {
      el.src = asset.url;
    }
    return el;
  }

  private ensureAudio(clip: Clip, asset: MediaAsset): HTMLAudioElement {
    let el = this.audioPool.get(clip.id);
    if (!el) {
      el = document.createElement('audio');
      el.src = asset.url;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      this.audioPool.set(clip.id, el);
    } else if (el.src !== asset.url) {
      el.src = asset.url;
    }
    return el;
  }

  private syncMedia(project: Project, time: number, playing: boolean) {
    const now = performance.now();
    const activeClips: { clip: Clip; srcTime: number; extended: boolean; gain: number }[] = [];
    const trackById = new Map(project.tracks.map((t) => [t.id, t]));

    for (const clip of project.clips) {
      if (clip.kind === 'text' || clip.kind === 'sticker') continue;
      const asset = project.assets.find((a) => a.id === clip.assetId);
      if (!asset) continue;
      const track = trackById.get(clip.trackId);
      if (!track) continue;
      const end = clipEnd(clip);
      let extended = false;
      let inWindow = time >= clip.start - 1e-6 && time < end;

      if (!inWindow && clip.transitionIn) {
        const next = project.clips.find(
          (c) =>
            c.trackId === clip.trackId && c.id !== clip.id && c.start > clip.start && Math.abs(c.start - end) < 0.35 &&
            c.kind !== 'text' && c.kind !== 'sticker'
        );
        if (next && next.transitionIn && time >= next.start && time < next.start + next.transitionIn.duration) {
          inWindow = true;
          extended = true;
        }
      }
      if (!inWindow) continue;

      const localTime = time - clip.start;
      const srcTime = clip.offset + localTime * clip.speed;

      let gain = resolveClipValue(clip, 'volume', localTime);
      if (clip.fadeIn > 0 && localTime < clip.fadeIn) gain *= Math.max(0, localTime / clip.fadeIn);
      if (clip.fadeOut > 0 && localTime > clip.duration - clip.fadeOut) {
        gain *= Math.max(0, (clip.duration - localTime) / clip.fadeOut);
      }
      if (clip.muted || track.muted) gain = 0;
      if (track.hidden && track.type !== 'video') gain = 0;

      if (clip.transitionIn && localTime >= 0 && localTime < clip.transitionIn.duration) {
        if (clip.transitionIn.type === 'dissolve' || clip.transitionIn.type === 'zoom-in' || clip.transitionIn.type === 'zoom-out') {
          gain *= Math.max(0, Math.min(1, localTime / clip.transitionIn.duration));
        }
      }
      if (extended && clip.transitionIn) {
        const next = project.clips.find(
          (c) =>
            c.trackId === clip.trackId && c.start > clip.start && Math.abs(c.start - end) < 0.35 && c.transitionIn &&
            c.kind !== 'text' && c.kind !== 'sticker'
        );
        if (next && next.transitionIn) {
          const p = (time - next.start) / next.transitionIn.duration;
          if (next.transitionIn.type === 'dissolve' || next.transitionIn.type === 'zoom-in' || next.transitionIn.type === 'zoom-out') {
            gain *= Math.max(0, 1 - p);
          }
        }
      }

      activeClips.push({ clip, srcTime: Math.max(0, srcTime), extended, gain: Math.max(0, Math.min(2, gain)) });
    }

    const usedVideoIds = new Set<string>();
    const usedAudioIds = new Set<string>();

    for (const entry of activeClips) {
      const { clip, srcTime, gain } = entry;
      const asset = project.assets.find((a) => a.id === clip.assetId)!;
      const isAudioOnly = clip.kind === 'audio';
      const el: HTMLMediaElement = isAudioOnly ? this.ensureAudio(clip, asset) : this.ensureVideo(clip, asset);
      if (isAudioOnly) usedAudioIds.add(clip.id);
      else usedVideoIds.add(clip.id);
      this.lastUsed.set(clip.id, now);

      el.muted = false;
      el.volume = gain;
      if (!playing) el.playbackRate = 1;
      else el.playbackRate = Math.max(0.0625, Math.min(16, clip.speed));

      try {
        if (playing) {
          if (Math.abs(el.currentTime - srcTime) > (entry.extended ? 0.45 : 0.3) && el.readyState > 0) {
            el.currentTime = srcTime;
          }
          if (el.paused && el.readyState >= 1) {
            const p = el.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          }
        } else {
          if (!el.paused) el.pause();
          if (el.readyState > 0 && Math.abs(el.currentTime - srcTime) > 0.02) {
            el.currentTime = srcTime;
          }
        }
      } catch {
        /* ignore media errors during sync */
      }
    }

    for (const [id, el] of this.videoPool) {
      if (!usedVideoIds.has(id)) {
        if (!el.paused) el.pause();
        el.volume = 0;
      }
    }
    for (const [id, el] of this.audioPool) {
      if (!usedAudioIds.has(id)) {
        if (!el.paused) el.pause();
        el.volume = 0;
      }
    }
  }

  private prunePools() {
    const now = performance.now();
    for (const pool of [this.videoPool, this.audioPool]) {
      if (pool.size <= 24) continue;
      const entries = [...pool.entries()].sort((a, b) => (this.lastUsed.get(a[0]) ?? 0) - (this.lastUsed.get(b[0]) ?? 0));
      const toRemove = entries.slice(0, pool.size - 24);
      for (const [id, el] of toRemove) {
        if (!el.paused) continue;
        el.removeAttribute('src');
        el.load();
        pool.delete(id);
      }
    }
    void now;
  }
}

export const playbackEngine = new PlaybackEngine();
