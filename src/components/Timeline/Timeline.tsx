import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, projectDuration, clipEnd, clipsOnTrack } from '../../store/editor';
import { MAX_ZOOM, MIN_ZOOM, TIMELINE_HEADER_WIDTH, TRACK_HEIGHTS } from '../../constants';
import { Ruler } from './Ruler';
import { TrackRow } from './TrackRow';
import {
  IconEye,
  IconEyeOff,
  IconLock,
  IconMinus,
  IconPlus,
  IconRedo,
  IconSnap,
  IconSplit,
  IconTrash,
  IconUndo,
  IconUnlock,
  IconVolume,
  IconVolumeOff,
} from '../icons';
import type { Track } from '../../types';

export function Timeline() {
  const project = useEditor((s) => s.project);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const currentTime = useEditor((s) => s.currentTime);
  const playing = useEditor((s) => s.playing);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const setSnap = useEditor((s) => s.setSnap);
  const clearSelection = useEditor((s) => s.clearSelection);
  const setTime = useEditor((s) => s.setTime);
  const splitAt = useEditor((s) => s.splitAt);
  const selectedClipIds = useEditor((s) => s.selectedClipIds);
  const removeClips = useEditor((s) => s.removeClips);
  const rippleDelete = useEditor((s) => s.rippleDelete);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const addTrack = useEditor((s) => s.addTrack);
  const updateTrack = useEditor((s) => s.updateTrack);

  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportW, setViewportW] = useState(800);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headersScrollRef = useRef<HTMLDivElement>(null);

  const duration = projectDuration(project);
  const contentWidth = Math.max(1200, (duration + 20) * zoom);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportW(el.clientWidth);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (!playing || !scrollRef.current) return;
    const el = scrollRef.current;
    const x = currentTime * zoom;
    const viewW = el.clientWidth;
    if (x > el.scrollLeft + viewW - 80 || x < el.scrollLeft + TIMELINE_HEADER_WIDTH) {
      el.scrollLeft = Math.max(0, x - viewW * 0.4);
    }
  }, [currentTime, playing, zoom]);

  const onWheel = (e: React.WheelEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + el.scrollLeft;
      const timeAtMouse = mouseX / zoom;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
      setZoom(next);
      requestAnimationFrame(() => {
        const newX = timeAtMouse * next;
        el.scrollLeft = Math.max(0, newX - (e.clientX - rect.left));
      });
    } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      el.scrollLeft += e.deltaX;
    } else {
      el.scrollLeft += e.deltaY;
    }
  };

  const nameFor = (track: Track, index: number): string => {
    if (track.type === 'video') {
      const videoTracks = project.tracks.filter((t) => t.type === 'video');
      const i = videoTracks.findIndex((t) => t.id === track.id);
      return videoTracks.length > 1 ? `Video ${i + 1}` : 'Main';
    }
    if (track.type === 'overlay') {
      const overlays = project.tracks.filter((t) => t.type === 'overlay');
      const i = overlays.findIndex((t) => t.id === track.id);
      return `Overlay ${i + 1}`;
    }
    const audios = project.tracks.filter((t) => t.type === 'audio');
    const i = audios.findIndex((t) => t.id === track.id);
    return `Audio ${i + 1}`;
  };

  const hasSelected = selectedClipIds.length > 0;
  const selectedInsidePlayhead = useMemo(() => {
    return project.clips.some(
      (c) => selectedClipIds.includes(c.id) && currentTime > c.start && currentTime < clipEnd(c)
    );
  }, [project.clips, selectedClipIds, currentTime]);

  return (
    <div className="timeline">
      <div className="timeline-toolbar">
        <button className="btn ghost icon" onClick={undo} title="Undo">
          <IconUndo />
        </button>
        <button className="btn ghost icon" onClick={redo} title="Redo">
          <IconRedo />
        </button>
        <div className="divider" />
        <button
          className="btn ghost icon"
          disabled={!selectedInsidePlayhead}
          onClick={() => splitAt(currentTime, selectedClipIds)}
          title="Split ⌘B"
        >
          <IconSplit />
        </button>
        <button
          className="btn ghost icon"
          disabled={!hasSelected}
          onClick={() => removeClips(selectedClipIds)}
          title="Delete ⌫"
        >
          <IconTrash />
        </button>
        <button
          className="btn ghost sm"
          disabled={!hasSelected}
          onClick={() => rippleDelete(selectedClipIds)}
          title="Delete and close the gap"
        >
          Ripple Delete
        </button>
        <div className="divider" />
        <button
          className={`btn ghost icon ${snapEnabled ? 'active' : ''}`}
          onClick={() => setSnap(!snapEnabled)}
          title="Snap"
          style={snapEnabled ? { color: 'var(--accent)' } : undefined}
        >
          <IconSnap />
        </button>
        <div className="divider" />
        <button className="btn ghost sm" onClick={() => addTrack('overlay')} title="Add overlay track">
          <IconPlus size={13} /> Track
        </button>
        <div className="spacer" />
        <button className="btn ghost icon" onClick={() => setZoom(zoom / 1.4)} title="Zoom out">
          <IconMinus />
        </button>
        <input
          className="slider zoom-slider"
          type="range"
          min={Math.log(MIN_ZOOM)}
          max={Math.log(MAX_ZOOM)}
          step={0.01}
          value={Math.log(zoom)}
          onChange={(e) => setZoom(Math.exp(parseFloat(e.target.value)))}
        />
        <button className="btn ghost icon" onClick={() => setZoom(zoom * 1.4)} title="Zoom in">
          <IconPlus />
        </button>
      </div>
      <div className="timeline-body">
        <div className="track-headers">
          <div className="ruler-spacer" />
          <div className="track-headers-scroll" ref={headersScrollRef} style={{ overflow: 'hidden' }}>
            {project.tracks.map((track, i) => (
              <div key={track.id} className="track-header" style={{ height: TRACK_HEIGHTS[track.type] ?? 60 }}>
                <span className="track-name">{nameFor(track, i)}</span>
                {track.type !== 'audio' && (
                  <button
                    className={`icon-btn ${track.hidden ? 'on' : ''}`}
                    title={track.hidden ? 'Show' : 'Hide'}
                    onClick={() => updateTrack(track.id, { hidden: !track.hidden })}
                  >
                    {track.hidden ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                  </button>
                )}
                {track.type !== 'video' && (
                  <button
                    className={`icon-btn ${track.muted ? 'on' : ''}`}
                    title={track.muted ? 'Unmute' : 'Mute'}
                    onClick={() => updateTrack(track.id, { muted: !track.muted })}
                  >
                    {track.muted ? <IconVolumeOff size={14} /> : <IconVolume />}
                  </button>
                )}
                <button
                  className={`icon-btn ${track.locked ? 'on' : ''}`}
                  title={track.locked ? 'Unlock' : 'Lock'}
                  onClick={() => updateTrack(track.id, { locked: !track.locked })}
                >
                  {track.locked ? <IconLock size={14} /> : <IconUnlock size={14} />}
                </button>
              </div>
            ))}
          </div>
        </div>
        <div
          className="timeline-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.target as HTMLElement;
            setScrollLeft(el.scrollLeft);
            if (headersScrollRef.current) {
              headersScrollRef.current.scrollTop = el.scrollTop;
            }
          }}
          onWheel={onWheel}
        >
          <div className="timeline-content" style={{ width: contentWidth }} onPointerDown={() => clearSelection()}>
            <Ruler scrollLeft={scrollLeft} viewportWidth={viewportW} />
            <div className="tracks">
              {project.tracks.map((track) => (
                <TrackRow key={track.id} track={track} onSnapLine={setSnapLine} />
              ))}
            </div>
            {snapLine !== null && <div className="snap-line" style={{ left: snapLine * zoom }} />}
            <div className="playhead" style={{ left: currentTime * zoom }} />
          </div>
        </div>
      </div>
    </div>
  );
}
