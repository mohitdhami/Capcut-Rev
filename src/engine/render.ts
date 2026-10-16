import type { Clip, MediaAsset, Project, TextClipData } from '../types';
import { FILTERS } from '../constants';
import { easeInOut, easeOut, clamp } from '../utils/time';
import { resolveClipValue, clipEnd } from '../store/editor';

export interface FrameResources {
  assetById: (id: string | undefined) => MediaAsset | undefined;
  videoForClip: (clip: Clip, asset: MediaAsset) => HTMLVideoElement | null;
  imageForAsset: (asset: MediaAsset) => HTMLImageElement | null;
}

const keyCanvasCache = new Map<string, HTMLCanvasElement>();

/* ------------------------------ filter string ----------------------------- */

export function cssFilter(params: import('../constants').FilterParams, intensity = 1): string {
  const t = clamp(intensity, 0, 1);
  const parts: string[] = [];
  const b = 1 + (((params.brightness ?? 1) - 1) * t);
  const c = 1 + (((params.contrast ?? 1) - 1) * t);
  const s = 1 + (((params.saturation ?? 1) - 1) * t);
  const hue = (params.hue ?? 0) * t;
  const sepia = (params.sepia ?? 0) * t;
  const gray = (params.grayscale ?? 0) * t;
  const temp = (params.temp ?? 0) * t;
  if (Math.abs(b - 1) > 0.001) parts.push(`brightness(${b.toFixed(3)})`);
  if (Math.abs(c - 1) > 0.001) parts.push(`contrast(${c.toFixed(3)})`);
  if (Math.abs(s - 1) > 0.001) parts.push(`saturate(${s.toFixed(3)})`);
  if (Math.abs(hue) > 0.01) parts.push(`hue-rotate(${hue.toFixed(1)}deg)`);
  if (sepia > 0.001) parts.push(`sepia(${sepia.toFixed(3)})`);
  if (gray > 0.001) parts.push(`grayscale(${gray.toFixed(3)})`);
  if (Math.abs(temp) > 0.001) {
    if (temp > 0) {
      parts.push(`sepia(${(0.18 * temp).toFixed(3)})`);
      parts.push(`saturate(${(1 + 0.12 * temp).toFixed(3)})`);
      parts.push(`hue-rotate(${(-7 * temp).toFixed(1)}deg)`);
    } else {
      const at = -temp;
      parts.push(`hue-rotate(${(8 * at).toFixed(1)}deg)`);
      parts.push(`saturate(${(1 + 0.05 * at).toFixed(3)})`);
      parts.push(`brightness(${(1 + 0.02 * at).toFixed(3)})`);
    }
  }
  return parts.join(' ') || 'none';
}

export function filterString(clip: Clip): string {
  const preset = FILTERS.find((f) => f.id === (clip.filterId ?? 'none'));
  return cssFilter(preset?.params ?? {}, (clip.filterIntensity ?? 100) / 100);
}

/* ------------------------------- chroma key ------------------------------- */

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 255, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function chromaKeyFrame(clip: Clip, source: CanvasImageSource, w: number, h: number): HTMLCanvasElement | null {
  try {
    let canvas = keyCanvasCache.get(clip.id);
    if (!canvas || canvas.width !== w || canvas.height !== h) {
      canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      keyCanvasCache.set(clip.id, canvas);
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const [kr, kg, kb] = hexToRgb(clip.chromaKey.color);
    const sim = (clip.chromaKey.similarity / 100) * 442;
    const smooth = Math.max(1, (clip.chromaKey.smoothness / 100) * 200);
    const spill = clip.chromaKey.spill / 100;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const dr = r - kr;
      const dg = g - kg;
      const db = b - kb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < sim) {
        data[i + 3] = 0;
      } else if (dist < sim + smooth) {
        const t = (dist - sim) / smooth;
        data[i + 3] = Math.round(data[i + 3] * t);
        if (spill > 0) {
          data[i + 1] = Math.round(g - (g - Math.max(r, b)) * spill * (1 - t));
        }
      } else if (spill > 0) {
        const greenish = Math.max(0, g - Math.max(r, b)) / 255;
        if (greenish > 0.1) data[i + 1] = Math.round(g - g * greenish * spill * 0.5);
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

/* ------------------------------- animations ------------------------------- */

interface TextAnimState {
  alpha: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  revealRatio: number;
}

function textAnimationState(text: TextClipData, localTime: number, duration: number): TextAnimState {
  const state: TextAnimState = { alpha: 1, offsetX: 0, offsetY: 0, scale: 1, revealRatio: 1 };
  const inn = text.animationIn;
  if (inn && inn.preset !== 'none' && inn.duration > 0) {
    const p = clamp(localTime / inn.duration, 0, 1);
    if (p < 1) {
      const e = easeInOut(p);
      switch (inn.preset) {
        case 'fade':
          state.alpha *= p;
          break;
        case 'slide-up':
          state.offsetY += (1 - easeOut(p)) * 60;
          state.alpha *= p;
          break;
        case 'slide-down':
          state.offsetY -= (1 - easeOut(p)) * 60;
          state.alpha *= p;
          break;
        case 'slide-left':
          state.offsetX += (1 - easeOut(p)) * 90;
          state.alpha *= p;
          break;
        case 'slide-right':
          state.offsetX -= (1 - easeOut(p)) * 90;
          state.alpha *= p;
          break;
        case 'zoom-in':
          state.scale *= 0.4 + 0.6 * easeOut(p);
          state.alpha *= p;
          break;
        case 'zoom-out':
          state.scale *= 1.6 - 0.6 * easeOut(p);
          state.alpha *= p;
          break;
        case 'pop': {
          const s = p < 0.7 ? easeOut(p / 0.7) * 1.15 : 1.15 - 0.15 * ((p - 0.7) / 0.3);
          state.scale *= s;
          break;
        }
        case 'bounce': {
          const s = 1 + Math.sin(p * Math.PI * 2) * 0.2 * (1 - p);
          state.offsetY += (1 - p) * 40;
          state.scale *= s;
          break;
        }
        case 'typewriter':
          state.revealRatio = p;
          break;
        default:
          break;
      }
      void e;
    }
  }
  const out = text.animationOut;
  if (out && out.preset !== 'none' && out.duration > 0 && localTime > duration - out.duration) {
    const p = clamp((duration - localTime) / out.duration, 0, 1);
    const e = easeInOut(p);
    switch (out.preset) {
      case 'fade':
        state.alpha *= p;
        break;
      case 'slide-up':
        state.offsetY -= (1 - easeOut(p)) * 60;
        state.alpha *= p;
        break;
      case 'slide-down':
        state.offsetY += (1 - easeOut(p)) * 60;
        state.alpha *= p;
        break;
      case 'slide-left':
        state.offsetX -= (1 - easeOut(p)) * 90;
        state.alpha *= p;
        break;
      case 'slide-right':
        state.offsetX += (1 - easeOut(p)) * 90;
        state.alpha *= p;
        break;
      case 'zoom-in':
        state.scale *= 1.6 - 0.6 * e;
        state.alpha *= p;
        break;
      case 'zoom-out':
        state.scale *= 0.4 + 0.6 * e;
        state.alpha *= p;
        break;
      case 'pop':
        state.scale *= 1 + (1 - p) * 0.1;
        state.alpha *= p;
        break;
      default:
        break;
    }
  }
  if (text.animationLoop === 'pulse') {
    state.scale *= 1 + 0.03 * Math.sin(localTime * Math.PI * 2 * 0.9);
  } else if (text.animationLoop === 'sway') {
    state.offsetX += Math.sin(localTime * Math.PI * 2 * 0.6) * 6;
  } else if (text.animationLoop === 'bounce') {
    state.offsetY += Math.abs(Math.sin(localTime * Math.PI * 2 * 0.8)) * -10;
  }
  return state;
}

/* ------------------------------ transition math ---------------------------- */

export interface TransitionWindow {
  active: boolean;
  progress: number;
  preset: string;
}

export function transitionWindow(clip: Clip, time: number): TransitionWindow {
  if (!clip.transitionIn) return { active: false, progress: 0, preset: 'none' };
  const d = clip.transitionIn.duration;
  if (d <= 0) return { active: false, progress: 0, preset: 'none' };
  const p = (time - clip.start) / d;
  if (p <= 0) return { active: true, progress: 0, preset: clip.transitionIn.type };
  if (p >= 1) return { active: false, progress: 1, preset: clip.transitionIn.type };
  return { active: true, progress: p, preset: clip.transitionIn.type };
}

/* -------------------------------- rendering -------------------------------- */

function drawMediaClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  asset: MediaAsset,
  res: FrameResources,
  W: number,
  H: number,
  time: number,
  isExtended: boolean
) {
  const localTime = time - clip.start;
  const srcTime = clip.offset + localTime * clip.speed;
  const isVideo = asset.kind === 'video';
  const el = isVideo ? res.videoForClip(clip, asset) : res.imageForAsset(asset);
  if (!el) return;
  const ready = isVideo ? (el as HTMLVideoElement).readyState >= 2 : true;
  if (!ready) return;

  const nativeW = isVideo ? (el as HTMLVideoElement).videoWidth || asset.width : asset.width;
  const nativeH = isVideo ? (el as HTMLVideoElement).videoHeight || asset.height : asset.height;
  if (!nativeW || !nativeH) return;

  const fit = Math.min(W / nativeW, H / nativeH);
  let scale = fit * resolveClipValue(clip, 'scale', localTime);
  let alpha = resolveClipValue(clip, 'opacity', localTime);
  let cx = W / 2 + (resolveClipValue(clip, 'positionX', localTime) / 100) * W;
  let cy = H / 2 + (resolveClipValue(clip, 'positionY', localTime) / 100) * H;
  let rotation = (resolveClipValue(clip, 'rotation', localTime) * Math.PI) / 180;

  const win = transitionWindow(clip, time);
  let extraFilter = '';
  let flashAlpha = 0;
  let glitchShift = 0;

  const loopTime = localTime;
  for (const effect of clip.effects) {
    const amt = effect.intensity / 100;
    switch (effect.effectId) {
      case 'shake': {
        const amp = 14 * amt * (H / 1080);
        cx += Math.sin(loopTime * 47.3) * amp;
        cy += Math.cos(loopTime * 53.1) * amp;
        break;
      }
      case 'pulse':
        scale *= 1 + 0.045 * amt * Math.sin(loopTime * Math.PI * 2 * 0.9);
        break;
      case 'flash': {
        const s = Math.max(0, Math.sin(loopTime * Math.PI * 2 * 1.1));
        flashAlpha = Math.pow(s, 6) * 0.6 * amt;
        break;
      }
      case 'glitch': {
        const seg = Math.floor(loopTime / 0.18);
        const rnd = Math.abs(Math.sin(seg * 127.1)) ;
        if (rnd > 0.6) glitchShift = (Math.sin(seg * 311.7) * 26 * amt * H) / 1080;
        break;
      }
      case 'zoom-slow':
        scale *= 1 + 0.07 * amt * clamp(loopTime / Math.max(0.001, clip.duration), 0, 1);
        break;
      case 'sway':
        rotation += ((3 * amt * Math.PI) / 180) * Math.sin(loopTime * Math.PI * 0.8);
        break;
      case 'heartbeat': {
        const ph = loopTime * 1.25;
        const beat = Math.max(Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 10), Math.pow(Math.max(0, Math.sin((ph - 0.16) * Math.PI * 2)), 10));
        scale *= 1 + 0.06 * amt * beat;
        break;
      }
      case 'bw-flash': {
        const s = Math.sin(loopTime * Math.PI * 2 * 1.6);
        if (s > 0.65) extraFilter += ` grayscale(${((s - 0.65) / 0.35).toFixed(2)})`;
        break;
      }
      default:
        break;
    }
  }

  let useEl: CanvasImageSource = el;
  let drawW = nativeW;
  let drawH = nativeH;
  if (clip.chromaKey.enabled && isVideo) {
    const kw = Math.min(nativeW, 1280);
    const kh = Math.round((nativeH / nativeW) * kw);
    const keyed = chromaKeyFrame(clip, el, kw, kh);
    if (keyed) {
      useEl = keyed;
      drawW = kw;
      drawH = kh;
    }
  }

  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  const filter = filterString(clip);
  ctx.filter = (filter === 'none' ? 'none' : filter) + extraFilter;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);

  if (glitchShift !== 0) {
    const sliceH = nativeH / 3;
    ctx.drawImage(useEl, 0, 0, drawW, sliceH, -drawW / 2 + glitchShift, -drawH / 2, drawW, sliceH);
    ctx.drawImage(useEl, 0, sliceH, drawW, sliceH, -drawW / 2 - glitchShift, -drawH / 2 + sliceH, drawW, sliceH);
    ctx.drawImage(useEl, 0, sliceH * 2, drawW, sliceH, -drawW / 2 + glitchShift / 2, -drawH / 2 + sliceH * 2, drawW, sliceH);
  } else {
    ctx.drawImage(useEl, -drawW / 2, -drawH / 2, drawW, drawH);
  }
  ctx.restore();

  if (flashAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  void srcTime;
  void win;
  void isExtended;
}

function drawTextClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  W: number,
  H: number,
  time: number
) {
  const text = clip.text;
  if (!text) return;
  const localTime = time - clip.start;
  const unit = H / 1080;
  const anim = textAnimationState(text, localTime, clip.duration);
  const baseSize = text.fontSize * unit * resolveClipValue(clip, 'scale', localTime) * anim.scale;
  if (baseSize <= 0.5) return;

  const family = text.fontFamily;
  const style = `${text.italic ? 'italic ' : ''}${text.bold ? 'bold ' : ''}`;
  ctx.save();
  ctx.font = `${style}${baseSize}px "${family}"`;
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D).letterSpacing = `${text.letterSpacing * unit}px`;

  let content = text.content || ' ';
  if (anim.revealRatio < 1) {
    const totalChars = content.length;
    content = content.slice(0, Math.max(1, Math.ceil(totalChars * anim.revealRatio)));
  }
  const lines = content.split('\n');
  const lineHeightPx = baseSize * text.lineHeight;
  const totalHeight = lines.length * lineHeightPx;
  const widths = lines.map((l) => ctx.measureText(l || ' ').width);
  const maxWidth = Math.max(...widths, 1);

  const alpha = resolveClipValue(clip, 'opacity', localTime) * anim.alpha;
  const cx = W / 2 + (resolveClipValue(clip, 'positionX', localTime) / 100) * W + anim.offsetX * unit;
  const cy = H / 2 + (resolveClipValue(clip, 'positionY', localTime) / 100) * H + anim.offsetY * unit;
  const rotation = (resolveClipValue(clip, 'rotation', localTime) * Math.PI) / 180;

  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.textBaseline = 'middle';

  if (text.bgOpacity > 0) {
    const padX = (text.bgPadding + 10) * unit;
    const padY = text.bgPadding * unit;
    const rectW = maxWidth + padX * 2;
    const rectH = totalHeight + padY * 2;
    ctx.save();
    ctx.globalAlpha = clamp(alpha * text.bgOpacity, 0, 1);
    ctx.fillStyle = text.bgColor;
    roundRect(ctx, -rectW / 2, -rectH / 2, rectW, rectH, 8 * unit);
    ctx.fill();
    ctx.restore();
  }

  if (text.shadowBlur > 0 || text.shadowOffX !== 0 || text.shadowOffY !== 0) {
    ctx.shadowColor = text.shadowColor || 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = text.shadowBlur * unit;
    ctx.shadowOffsetX = text.shadowOffX * unit;
    ctx.shadowOffsetY = text.shadowOffY * unit;
  }

  lines.forEach((line, i) => {
    const w = widths[i];
    let x: number;
    if (text.align === 'left') x = -maxWidth / 2;
    else if (text.align === 'right') x = maxWidth / 2;
    else x = 0;
    ctx.textAlign = text.align === 'left' ? 'left' : text.align === 'right' ? 'right' : 'center';
    const y = -totalHeight / 2 + lineHeightPx * (i + 0.5);
    if (text.strokeWidth > 0) {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = text.strokeWidth * unit * 2;
      ctx.strokeStyle = text.strokeColor;
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = text.color;
    ctx.fillText(line, x, y);
  });

  ctx.restore();
}

function drawStickerClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  res: FrameResources,
  W: number,
  H: number,
  time: number
) {
  const localTime = time - clip.start;
  const base = H * 0.2 * resolveClipValue(clip, 'scale', localTime);
  const alpha = resolveClipValue(clip, 'opacity', localTime);
  const cx = W / 2 + (resolveClipValue(clip, 'positionX', localTime) / 100) * W;
  const cy = H / 2 + (resolveClipValue(clip, 'positionY', localTime) / 100) * H;
  const rotation = (resolveClipValue(clip, 'rotation', localTime) * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.globalAlpha = clamp(alpha, 0, 1);
  const anim = textAnimationState(
    {
      ...({} as TextClipData),
      animationIn: null,
      animationOut: null,
      animationLoop: 'none',
    } as unknown as TextClipData,
    localTime,
    clip.duration
  );
  void anim;
  if (clip.sticker?.imagePath) {
    const asset = {
      id: clip.sticker.imagePath,
      path: clip.sticker.imagePath,
      url: clip.sticker.imagePath,
      width: 512,
      height: 512,
      kind: 'image',
      duration: 0,
      fps: 30,
      rotation: 0,
      hasAudio: false,
      name: '',
    } as MediaAsset;
    const img = res.imageForAsset(asset);
    if (img) {
      ctx.drawImage(img, -base / 2, -base / 2, base, base);
      ctx.restore();
      return;
    }
  }
  const emoji = clip.sticker?.emoji || '⭐';
  ctx.font = `${base}px "Apple Color Emoji"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 0, base * 0.04);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ------------------------------- main entry -------------------------------- */

interface RenderEntry {
  clip: Clip;
  extended: boolean;
  transitionAlpha: number;
  isIncoming: boolean;
}

function transitionAlphaFor(clip: Clip, time: number): number {
  const win = transitionWindow(clip, time);
  if (!win.active) return 1;
  const p = win.progress;
  switch (win.preset) {
    case 'dissolve':
      return easeInOut(p);
    case 'fade-black':
      return p < 0.5 ? 0 : (p - 0.5) * 2;
    case 'zoom-in':
    case 'zoom-out':
      return easeInOut(p);
    default:
      return 1;
  }
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  time: number,
  W: number,
  H: number,
  res: FrameResources
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.fillStyle = project.settings.background || '#000000';
  ctx.fillRect(0, 0, W, H);

  const tracks = project.tracks;
  for (const track of tracks) {
    if (track.type === 'audio') continue;
    if (track.hidden) continue;
    const clips = project.clips
      .filter((c) => c.trackId === track.id)
      .sort((a, b) => a.start - b.start);
    const mediaClips = clips.filter((c) => c.kind !== 'text' && c.kind !== 'sticker');
    const mediaIdx = new Map(mediaClips.map((c, i) => [c.id, i]));

    const entries: RenderEntry[] = [];
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      const active = time >= c.start - 1e-6 && time < clipEnd(c);
      if (active) {
        entries.push({ clip: c, extended: false, transitionAlpha: transitionAlphaFor(c, time), isIncoming: true });
      }
      const win = transitionWindow(c, time);
      if (win.active) {
        const mi = mediaIdx.get(c.id);
        const prev = mi !== undefined && mi > 0 ? mediaClips[mi - 1] : null;
        if (prev && Math.abs(clipEnd(prev) - c.start) < 0.35 && time >= clipEnd(prev) - 1e-6) {
          let outAlpha = 1;
          if (win.preset === 'fade-black') {
            outAlpha = Math.max(0, 1 - win.progress * 2);
          }
          if (!entries.some((e) => e.clip.id === prev.id)) {
            entries.push({ clip: prev, extended: true, transitionAlpha: outAlpha, isIncoming: false });
          }
        }
      }
    }

    for (const entry of entries) {
      const c = entry.clip;
      if (c.kind === 'video' || c.kind === 'image') {
        const asset = res.assetById(c.assetId);
        if (!asset) continue;
        const win = transitionWindow(c, time);
        if (entry.isIncoming && win.active) {
          ctx.save();
          const baseAlpha = ctx.globalAlpha;
          ctx.globalAlpha = entry.transitionAlpha * baseAlpha;
          drawMediaClip(ctx, c, asset, res, W, H, time, entry.extended);
          ctx.restore();
          continue;
        }
        ctx.save();
        if (!entry.isIncoming) ctx.globalAlpha = entry.transitionAlpha;
        drawMediaClip(ctx, c, asset, res, W, H, time, entry.extended);
        ctx.restore();
      } else if (c.kind === 'text') {
        ctx.save();
        ctx.globalAlpha = entry.transitionAlpha;
        drawTextClip(ctx, c, W, H, time);
        ctx.restore();
      } else if (c.kind === 'sticker') {
        ctx.save();
        ctx.globalAlpha = entry.transitionAlpha;
        drawStickerClip(ctx, c, res, W, H, time);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}
