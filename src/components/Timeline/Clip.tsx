import { memo, useEffect, useMemo, useRef } from 'react';
import type { Clip, Track } from '../../types';
import { useEditor, canPlaceOnTrack, clipEnd } from '../../store/editor';
import { useMediaCache } from '../../store/mediaCache';
import { useUI, type CtxItem } from '../../store/ui';
import { formatDuration } from '../../utils/time';
import { detachAudio } from '../../utils/actions';
import { IconKeyframe, IconMusic, IconText, IconVideo, IconVolumeOff } from '../icons';

interface Props {
  clip: Clip;
  track: Track;
  onSnapLine: (t: number | null) => void;
}

export const TimelineClip = memo(function TimelineClip({ clip, track, onSnapLine }: Props) {
  const zoom = useEditor((s) => s.zoom);
  const selected = useEditor((s) => s.selectedClipIds.includes(clip.id));
  const selectedClipIds = useEditor((s) => s.selectedClipIds);
  const project = useEditor((s) => s.project);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const selectClips = useEditor((s) => s.selectClips);
  const beginTransient = useEditor((s) => s.beginTransient);
  const moveClip = useEditor((s) => s.moveClip);
  const resizeClip = useEditor((s) => s.resizeClip);
  const splitAt = useEditor((s) => s.splitAt);
  const removeClips = useEditor((s) => s.removeClips);
  const rippleDelete = useEditor((s) => s.rippleDelete);
  const duplicateClips = useEditor((s) => s.duplicateClips);
  const copyClips = useEditor((s) => s.copyClips);
  const cutClips = useEditor((s) => s.cutClips);
  const pasteClips = useEditor((s) => s.pasteClips);
  const updateClip = useEditor((s) => s.updateClip);
  const openCtx = useUI((s) => s.openContextMenu);
  const setMediaTab = useUI((s) => s.setMediaTab);

  const asset = clip.assetId ? project.assets.find((a) => a.id === clip.assetId) : undefined;
  const filmstrips = useMediaCache((s) => (asset && asset.kind !== 'audio' ? s.filmstrips[asset.path] : undefined));
  const thumb = useMediaCache((s) => (asset ? s.thumbs[asset.path] : undefined));
  const waveform = useMediaCache((s) => (asset && (asset.kind === 'audio' || asset.hasAudio) ? s.waveforms[asset.path] : undefined));
  const ensureFilmstrip = useMediaCache((s) => s.ensureFilmstrip);
  const ensureWaveform = useMediaCache((s) => s.ensureWaveform);
  const ensureThumb = useMediaCache((s) => s.ensureThumb);

  useEffect(() => {
    if (!asset) return;
    ensureThumb(asset);
    if (asset.kind === 'video') ensureFilmstrip(asset);
    if (asset.kind === 'audio' || asset.hasAudio) ensureWaveform(asset);
  }, [asset, ensureFilmstrip, ensureWaveform, ensureThumb]);

  const left = clip.start * zoom;
  const width = Math.max(4, clip.duration * zoom);

  const waveRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (clip.kind !== 'audio' || !waveform || waveform.length === 0) return;
    const canvas = waveRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const H = track.type === 'audio' ? 48 : 52;
    const drawW = Math.max(2, Math.min(3000, Math.floor(width)));
    canvas.width = drawW * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, drawW, H);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const srcDur = asset?.duration || 1;
    const srcStart = clip.offset;
    const srcSpan = clip.duration * clip.speed;
    for (let x = 0; x < drawW; x++) {
      const t = srcStart + (x / drawW) * srcSpan;
      const idx = Math.floor((t / srcDur) * waveform.length);
      const v = waveform[Math.max(0, Math.min(waveform.length - 1, idx))] ?? 0;
      const h = Math.max(1, v * (H - 10));
      ctx.fillRect(x, (H - h) / 2, 1, h);
    }
  }, [waveform, width, clip.offset, clip.duration, clip.speed, clip.kind, asset?.duration, track.type]);

  const stripTiles = useMemo(() => {
    if (!filmstrips || filmstrips.length === 0) return [];
    const aspect = asset && asset.width > 0 ? asset.width / asset.height : 16 / 9;
    const tileW = Math.max(20, Math.round(52 * aspect));
    const count = Math.min(60, Math.max(1, Math.ceil(width / tileW)));
    const tiles: { src: string; w: number }[] = [];
    for (let i = 0; i < count; i++) {
      const p = (i + 0.5) / count;
      const frame = filmstrips[Math.min(filmstrips.length - 1, Math.floor(p * filmstrips.length))];
      if (frame) tiles.push({ src: frame, w: tileW });
    }
    return tiles;
  }, [filmstrips, width, asset]);

  /* ------------------------------ drag & trim ------------------------------ */

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0 || track.locked) return;
    e.stopPropagation();
    const additive = e.metaKey || e.ctrlKey;
    if (!selectedClipIds.includes(clip.id)) {
      selectClips([clip.id], additive);
    } else if (additive) {
      selectClips([clip.id], true);
      return;
    }

    const primaryId = clip.id;
    const originClips = useEditor
      .getState()
      .project.clips.filter((c) => (c.id === primaryId || useEditor.getState().selectedClipIds.includes(c.id)))
      .map((c) => ({ id: c.id, start: c.start, trackId: c.trackId, kind: c.kind }));

    const startX = e.clientX;
    let began = false;
    let snapTime: number | null = null;

    const others = () => useEditor.getState().project.clips.filter((c) => c.id !== primaryId);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!began && Math.abs(dx) < 2) return;
      if (!began) {
        began = true;
        beginTransient();
      }
      const zoomNow = useEditor.getState().zoom;
      const primaryOrigin = originClips.find((c) => c.id === primaryId)!;
      let desired = Math.max(0, primaryOrigin.start + dx / zoomNow);
      const primClip = useEditor.getState().project.clips.find((c) => c.id === primaryId)!;
      const dur = primClip.duration;

      snapTime = null;
      if (snapEnabled && !ev.altKey) {
        const candidates: number[] = [0, useEditor.getState().currentTime];
        for (const c of others()) {
          if (c.trackId === primClip.trackId) {
            candidates.push(c.start, clipEnd(c));
          }
        }
        const threshold = 8 / zoomNow;
        let best: number | null = null;
        let bestDist = threshold;
        for (const cand of candidates) {
          const d1 = Math.abs(desired - cand);
          if (d1 < bestDist) {
            bestDist = d1;
            best = cand;
          }
          const d2 = Math.abs(desired + dur - cand);
          if (d2 < bestDist) {
            bestDist = d2;
            best = cand - dur;
          }
        }
        if (best !== null) {
          desired = Math.max(0, best);
          snapTime = Math.max(0, best);
        }
      }
      onSnapLine(snapTime);

      let targetTrackId = primaryOrigin.trackId;
      const els = document.elementsFromPoint(ev.clientX, ev.clientY);
      for (const el of els) {
        const rowEl = (el as HTMLElement).closest?.('[data-track-id]') as HTMLElement | null;
        if (rowEl) {
          const tid = rowEl.dataset.trackId!;
          const t = useEditor.getState().project.tracks.find((x) => x.id === tid);
          if (t && canPlaceOnTrack(t, primClip.kind)) targetTrackId = tid;
          break;
        }
      }

      const delta = desired - primaryOrigin.start;
      for (const oc of originClips) {
        const newStart = Math.max(0, oc.start + delta);
        moveClip(oc.id, oc.id === primaryId ? targetTrackId : oc.trackId, newStart, { transient: true });
      }
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onSnapLine(null);
      if (began) useEditor.getState().endTransient();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startTrim = (edge: 'left' | 'right') => (e: React.PointerEvent) => {
    if (e.button !== 0 || track.locked) return;
    e.stopPropagation();
    const origin = { start: clip.start, duration: clip.duration, offset: clip.offset, speed: clip.speed };
    const startX = e.clientX;
    let began = false;
    const clipId = clip.id;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!began && Math.abs(dx) < 2) return;
      if (!began) {
        began = true;
        beginTransient();
      }
      const zoomNow = useEditor.getState().zoom;
      const raw = dx / zoomNow;
      const current = useEditor.getState().project.clips.find((c) => c.id === clipId);
      if (!current) return;
      const assetNow = current.assetId ? useEditor.getState().project.assets.find((a) => a.id === current.assetId) : undefined;
      const finiteSource = !!assetNow && assetNow.kind !== 'image';
      const minDur = 0.05;

      let snapTime: number | null = null;
      const collectCandidates = () => {
        const cands: number[] = [0, useEditor.getState().currentTime];
        for (const c of useEditor.getState().project.clips) {
          if (c.id !== clipId && c.trackId === current.trackId) cands.push(c.start, clipEnd(c));
        }
        return cands;
      };
      const snapValue = (val: number) => {
        if (!snapEnabled || ev.altKey) return val;
        const threshold = 8 / zoomNow;
        let best = val;
        let bestDist = threshold;
        for (const cand of collectCandidates()) {
          const d = Math.abs(val - cand);
          if (d < bestDist) {
            bestDist = d;
            best = cand;
          }
        }
        if (best !== val) snapTime = best;
        return best;
      };

      if (edge === 'left') {
        const maxLeft = finiteSource ? Math.min(origin.start, origin.offset / origin.speed) : origin.start;
        let newStart = origin.start + raw;
        newStart = Math.max(origin.start - maxLeft, Math.min(newStart, origin.start + origin.duration - minDur));
        newStart = Math.max(0, newStart);
        newStart = snapValue(newStart);
        newStart = Math.max(0, Math.min(newStart, origin.start + origin.duration - minDur));
        const deltaT = newStart - origin.start;
        resizeClip(
          clipId,
          'left',
          {
            start: newStart,
            duration: origin.duration - deltaT,
            offset: finiteSource ? origin.offset + deltaT * origin.speed : origin.offset,
          },
          { transient: true }
        );
        onSnapLine(snapTime);
      } else {
        let newDuration = origin.duration + raw;
        const maxDur = finiteSource && assetNow ? (assetNow.duration - origin.offset) / origin.speed : Infinity;
        newDuration = Math.max(minDur, Math.min(newDuration, maxDur));
        const endRaw = origin.start + newDuration;
        const snappedEnd = snapValue(endRaw);
        newDuration = Math.max(minDur, Math.min(snappedEnd - origin.start, maxDur));
        resizeClip(clipId, 'right', { start: origin.start, duration: newDuration, offset: origin.offset }, { transient: true });
        onSnapLine(snapTime);
      }
      void current;
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onSnapLine(null);
      if (began) useEditor.getState().endTransient();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /* ------------------------------ context menu ----------------------------- */

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedClipIds.includes(clip.id)) selectClips([clip.id]);
    const s = useEditor.getState();
    const inClip = s.currentTime > clip.start && s.currentTime < clipEnd(clip);
    const items: CtxItem[] = [
      { label: 'Split', shortcut: '⌘B', disabled: !inClip, onClick: () => splitAt(s.currentTime, [clip.id]) },
      { label: 'Copy', shortcut: '⌘C', onClick: () => copyClips(s.selectedClipIds) },
      { label: 'Cut', shortcut: '⌘X', onClick: () => cutClips(s.selectedClipIds) },
      { label: 'Paste', shortcut: '⌘V', disabled: s.clipboard.length === 0, onClick: () => pasteClips() },
      { label: 'Duplicate', shortcut: '⌘D', onClick: () => duplicateClips(s.selectedClipIds) },
      { label: '', separator: true },
      {
        label: 'Go to Transitions',
        onClick: () => {
          setMediaTab('transition');
        },
      },
      ...(clip.kind === 'video' && asset?.hasAudio
        ? [{ label: 'Detach Audio', onClick: () => detachAudio(s.selectedClipIds) } as CtxItem]
        : []),
      ...(clip.kind === 'video' || clip.kind === 'audio' || clip.kind === 'image'
        ? [
            {
              label: clip.muted ? 'Unmute' : 'Mute',
              onClick: () => updateClip(clip.id, { muted: !clip.muted }),
            } as CtxItem,
          ]
        : []),
      { label: '', separator: true },
      { label: 'Ripple Delete', onClick: () => rippleDelete(s.selectedClipIds) },
      { label: 'Delete', shortcut: '⌫', danger: true, onClick: () => removeClips(s.selectedClipIds) },
    ];
    openCtx(e.clientX, e.clientY, items);
  };

  /* --------------------------------- render -------------------------------- */

  const label =
    clip.kind === 'text'
      ? clip.text?.content || 'Text'
      : clip.kind === 'sticker'
        ? clip.sticker?.emoji || 'Sticker'
        : asset?.name || '';

  return (
    <div
      className={`clip ${clip.kind} ${selected ? 'selected' : ''}`}
      style={{ left, width }}
      onPointerDown={startDrag}
      onContextMenu={openMenu}
      title={label}
    >
      {(clip.kind === 'video' || clip.kind === 'image') &&
        (stripTiles.length > 0 ? (
          <div className="filmstrip">
            {stripTiles.map((t, i) => (
              <img key={i} src={t.src} draggable={false} style={{ width: t.w }} />
            ))}
          </div>
        ) : thumb ? (
          <div className="filmstrip">
            <img src={thumb} draggable={false} style={{ width: '100%', objectFit: 'cover' }} />
          </div>
        ) : null)}
      {clip.kind === 'audio' && <canvas ref={waveRef} className="waveform" />}
      {clip.kind === 'text' && <div className="text-preview">{clip.text?.content}</div>}
      {clip.kind === 'sticker' && <div className="sticker-preview">{clip.sticker?.emoji}</div>}
      {(clip.kind === 'video' || clip.kind === 'image' || clip.kind === 'audio') && (
        <div className="clip-label">
          {clip.kind === 'audio' ? <IconMusic size={11} style={{ verticalAlign: -1, marginRight: 3 }} /> : null}
          {label}
          {clip.speed !== 1 ? `  ${clip.speed}x` : ''}
        </div>
      )}
      {clip.kind === 'text' && (
        <div className="clip-icon">
          <IconText size={12} />
        </div>
      )}
      {(clip.kind === 'video' || clip.kind === 'audio') && (
        <div className="clip-icon">
          {clip.muted ? <IconVolumeOff size={12} /> : null}
        </div>
      )}
      {Object.keys(clip.keyframes).length > 0 && (
        <div className="clip-icon" style={{ right: 18 }}>
          <IconKeyframe size={11} />
        </div>
      )}
      {clip.kind === 'image' && (
        <div className="clip-icon">
          <IconVideo size={11} />
        </div>
      )}
      <div className="trim-handle left" onPointerDown={startTrim('left')} />
      <div className="trim-handle right" onPointerDown={startTrim('right')} />
      {width > 60 && <span style={{ position: 'absolute', right: 5, bottom: 2, fontSize: 10, color: 'rgba(255,255,255,0.65)', pointerEvents: 'none' }}>
        {formatDuration(clip.duration)}
      </span>}
    </div>
  );
});
