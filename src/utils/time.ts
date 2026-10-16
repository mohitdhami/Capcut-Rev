export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTimecode(sec: number, fps: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const totalFrames = Math.round(sec * fps);
  const f = totalFrames % Math.round(fps);
  const totalSec = Math.floor(totalFrames / fps);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export function formatShort(sec: number, fps: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const totalFrames = Math.round(sec * fps);
  const f = totalFrames % Math.round(fps);
  const totalSec = Math.floor(totalFrames / fps);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const ff = String(f).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${ff}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${ff}`;
}

export function rulerStep(pxPerSec: number): { major: number; minor: number } {
  const targets = [0.04, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  for (const t of targets) {
    if (t * pxPerSec >= 70) return { major: t, minor: t / 5 };
  }
  return { major: 900, minor: 180 };
}

export function easeInOut(t: number): number {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOut(t: number): number {
  t = clamp(t, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

export function easeIn(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * t;
}

export function uidShort() {
  return Math.random().toString(36).slice(2, 8);
}
