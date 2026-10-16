import { useEffect, useRef } from 'react';
import { useEditor, projectDuration } from '../../store/editor';
import { rulerStep } from '../../utils/time';

export function Ruler({ scrollLeft, viewportWidth }: { scrollLeft: number; viewportWidth: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoom = useEditor((s) => s.zoom);
  const project = useEditor((s) => s.project);
  const setTime = useEditor((s) => s.setTime);
  const setPlaying = useEditor((s) => s.setPlaying);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewportWidth <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(10, Math.ceil(viewportWidth));
    const H = 28;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#131318';
    ctx.fillRect(0, 0, W, H);

    const { major, minor } = rulerStep(zoom);
    const total = projectDuration(project);
    const startT = Math.max(0, Math.floor((scrollLeft / zoom) / minor) * minor);
    const endT = (scrollLeft + W) / zoom;

    ctx.font = '10px -apple-system, sans-serif';
    ctx.textBaseline = 'bottom';

    let t = startT;
    let guard = 0;
    while (t <= endT && guard++ < 4000) {
      const x = Math.round(t * zoom - scrollLeft) + 0.5;
      if (x >= -20 && x <= W + 20) {
        const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
        ctx.beginPath();
        ctx.moveTo(x, isMajor ? 8 : 19);
        ctx.lineTo(x, 27);
        ctx.strokeStyle = isMajor ? '#4a4a55' : '#2c2c34';
        ctx.stroke();
        if (isMajor) {
          ctx.fillStyle = '#8a8a96';
          ctx.fillText(formatTick(Math.round(t * 1000) / 1000), x + 4, 18);
        }
      }
      t += minor;
    }

    const endX = Math.round(total * zoom - scrollLeft) + 0.5;
    if (endX >= 0 && endX <= W && total > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, H);
      ctx.stroke();
    }
  }, [zoom, viewportWidth, scrollLeft, project]);

  const seekFromEvent = (clientX: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + scrollLeft;
    setTime(Math.max(0, x / zoom));
  };

  return (
    <div
      className="ruler"
      style={{ position: 'sticky', top: 0, left: 0, width: viewportWidth, zIndex: 30 }}
      onPointerDown={(e) => {
        setPlaying(false);
        seekFromEvent(e.clientX);
        const move = (ev: PointerEvent) => seekFromEvent(ev.clientX);
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

function formatTick(t: number): string {
  const m = Math.floor(t / 60);
  const s = t % 60;
  const sStr = Number.isInteger(s) ? String(s) : s.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  if (m > 0) return `${m}:${String(Math.floor(s)).padStart(2, '0')}${s % 1 !== 0 ? '.' + sStr.split('.')[1] : ''}`;
  return `${sStr}s`;
}
