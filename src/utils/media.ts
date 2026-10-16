import type { MediaAsset } from '../types';

const thumbCache = new Map<string, Promise<string | null>>();
const filmstripCache = new Map<string, Promise<string[]>>();
const waveformCache = new Map<string, Promise<number[]>>();
const imageCache = new Map<string, HTMLImageElement>();

let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function videoElement(url: string): HTMLVideoElement {
  const el = document.createElement('video');
  el.src = url;
  el.crossOrigin = 'anonymous';
  el.preload = 'auto';
  el.muted = true;
  el.playsInline = true;
  return el;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.currentTime = time;
  });
}

export function generateThumbnail(asset: MediaAsset): Promise<string | null> {
  const key = asset.path;
  const existing = thumbCache.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      if (asset.kind === 'audio') return null;
      if (asset.kind === 'image') {
        const img = await loadImage(asset.url);
        const c = document.createElement('canvas');
        const w = 240;
        const h = Math.max(1, Math.round((asset.height / (asset.width || 1)) * w)) || 135;
        c.width = w;
        c.height = Math.min(h, 240);
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, c.width, c.height);
        const scale = Math.min(c.width / asset.width, c.height / asset.height);
        const dw = asset.width * scale;
        const dh = asset.height * scale;
        ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
        return c.toDataURL('image/jpeg', 0.72);
      }
      const video = videoElement(asset.url);
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error('load failed'));
        setTimeout(() => resolve(), 6000);
      });
      const t = Math.min(Math.max(0.1, asset.duration * 0.12), Math.max(0.1, asset.duration - 0.1));
      try { await seek(video, t); } catch { /* ignore */ }
      const c = document.createElement('canvas');
      c.width = 240;
      c.height = Math.max(1, Math.round((asset.height / (asset.width || 1)) * 240)) || 135;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(video, 0, 0, c.width, c.height);
      video.removeAttribute('src');
      video.load();
      const url = c.toDataURL('image/jpeg', 0.72);
      return url === 'data:,' ? null : url;
    } catch {
      return null;
    }
  })();
  thumbCache.set(key, p);
  return p;
}

export function generateFilmstrip(asset: MediaAsset, count = 8): Promise<string[]> {
  const key = `${asset.path}:${count}`;
  const existing = filmstripCache.get(key);
  if (existing) return existing;
  const p = (async () => {
    if (asset.kind !== 'video' || asset.duration <= 0) {
      const t = await generateThumbnail(asset);
      return t ? [t] : [];
    }
    const frames: string[] = [];
    const video = videoElement(asset.url);
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('load failed'));
      setTimeout(() => resolve(), 8000);
    });
    const c = document.createElement('canvas');
    const aspect = asset.height / (asset.width || 1);
    c.width = 128;
    c.height = Math.max(1, Math.round(128 * aspect));
    const ctx = c.getContext('2d')!;
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.max(0, asset.duration - 0.05) + 0.02;
      try {
        await seek(video, t);
        ctx.drawImage(video, 0, 0, c.width, c.height);
        frames.push(c.toDataURL('image/jpeg', 0.6));
      } catch {
        frames.push('');
      }
    }
    video.removeAttribute('src');
    video.load();
    return frames;
  })();
  filmstripCache.set(key, p);
  return p;
}

export function getWaveform(asset: MediaAsset, buckets = 1200): Promise<number[]> {
  const key = `${asset.path}:${buckets}`;
  const existing = waveformCache.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(asset.url);
      const buf = await res.arrayBuffer();
      const ctx = getAudioContext();
      const audio = await ctx.decodeAudioData(buf);
      const data = audio.getChannelData(0);
      const ch2 = audio.numberOfChannels > 1 ? audio.getChannelData(1) : null;
      const per = Math.max(1, Math.floor(data.length / buckets));
      const peaks: number[] = new Array(buckets);
      for (let i = 0; i < buckets; i++) {
        let max = 0;
        const start = i * per;
        const end = Math.min(data.length, start + per);
        for (let j = start; j < end; j += 4) {
          const v = Math.abs(data[j]);
          if (v > max) max = v;
          if (ch2) {
            const v2 = Math.abs(ch2[j]);
            if (v2 > max) max = v2;
          }
        }
        peaks[i] = max;
      }
      const mx = Math.max(...peaks, 0.001);
      return peaks.map((v) => v / mx);
    } catch {
      return [];
    }
  })();
  waveformCache.set(key, p);
  return p;
}

export function invalidateAssetCaches(asset: MediaAsset) {
  thumbCache.delete(asset.path);
  for (const key of [...filmstripCache.keys()]) if (key.startsWith(asset.path + ':')) filmstripCache.delete(key);
  for (const key of [...waveformCache.keys()]) if (key.startsWith(asset.path + ':')) waveformCache.delete(key);
}

export function fitScale(canvasW: number, canvasH: number, w: number, h: number): number {
  if (!w || !h) return 1;
  return Math.min(canvasW / w, canvasH / h);
}
