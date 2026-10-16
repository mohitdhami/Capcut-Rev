import { useEditor, clipsOnTrack, canPlaceOnTrack, clipEnd } from '../../store/editor';
import { TRACK_HEIGHTS, TEXT_PRESETS, TRANSITIONS } from '../../constants';
import { TimelineClip } from './Clip';
import { useUI } from '../../store/ui';
import { addAssetToTimeline, addTextAt } from '../../utils/actions';
import { IconPlus } from '../icons';
import type { Track } from '../../types';

export function TrackRow({ track, onSnapLine }: { track: Track; onSnapLine: (t: number | null) => void }) {
  const project = useEditor((s) => s.project);
  const zoom = useEditor((s) => s.zoom);
  const setTransition = useEditor((s) => s.setTransition);
  const selectClips = useEditor((s) => s.selectClips);
  const showToast = useEditor((s) => s.showToast);
  const openCtx = useUI((s) => s.openContextMenu);
  const setMediaTab = useUI((s) => s.setMediaTab);
  const pasteClips = useEditor((s) => s.pasteClips);
  const updateTrack = useEditor((s) => s.updateTrack);
  const removeTrack = useEditor((s) => s.removeTrack);
  const addTrack = useEditor((s) => s.addTrack);

  const clips = clipsOnTrack(project, track.id);
  const mediaClips = clips.filter((c) => c.kind !== 'text' && c.kind !== 'sticker');
  const height = TRACK_HEIGHTS[track.type] ?? 60;

  const boundaries: { x: number; nextId: string; transitionType: string | null }[] = [];
  for (let i = 1; i < mediaClips.length; i++) {
    const prev = mediaClips[i - 1];
    const next = mediaClips[i];
    if (Math.abs(clipEnd(prev) - next.start) < 0.35) {
      boundaries.push({ x: next.start * zoom, nextId: next.id, transitionType: next.transitionIn?.type ?? null });
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const time = Math.max(0, (e.clientX - rect.left) / zoom);
    const assetId = e.dataTransfer.getData('application/x-capcut-asset');
    const textPreset = e.dataTransfer.getData('application/x-capcut-text-preset');
    const transId = e.dataTransfer.getData('application/x-capcut-transition');
    e.preventDefault();
    e.stopPropagation();

    if (assetId) {
      const asset = project.assets.find((a) => a.id === assetId);
      if (!asset) return;
      const kind = asset.kind;
      if (!canPlaceOnTrack(track, kind)) {
        showToast(kind === 'audio' ? 'Audio can only go on audio or overlay tracks' : 'Media type does not match this track');
        return;
      }
      addAssetToTimeline(assetId, time, track.id);
      return;
    }
    if (textPreset) {
      if (track.type !== 'overlay') {
        showToast('Text can only go on overlay tracks');
        return;
      }
      const preset = TEXT_PRESETS.find((p) => p.id === textPreset);
      addTextAt(time, preset?.patch);
      return;
    }
    if (transId) {
      const nearest = mediaClips
        .map((c) => ({ c, dist: Math.abs(c.start * zoom - (e.clientX - rect.left)) }))
        .sort((a, b) => a.dist - b.dist)[0];
      if (!nearest || nearest.dist > 40) {
        showToast('Drop at the boundary between two clips to add a transition');
        return;
      }
      const idx = mediaClips.findIndex((c) => c.id === nearest.c.id);
      const prev = idx > 0 ? mediaClips[idx - 1] : null;
      const next = mediaClips[idx];
      const target = prev && Math.abs(clipEnd(prev) - next.start) < 0.35 ? next : mediaClips[idx + 1];
      if (!target) {
        showToast('Transition needs two adjacent clips');
        return;
      }
      const dur = Math.min(0.5, Math.min(target.duration, mediaClips[idx].duration) * 0.9);
      setTransition(target.id, { type: transId, duration: Math.max(0.1, dur) });
      showToast(`Transition added: ${TRANSITIONS.find((t) => t.id === transId)?.name}`);
      return;
    }
  };

  return (
    <div
      className={`track-row ${track.type}`}
      data-track-id={track.id}
      style={{ height }}
      onDragOver={(e) => {
        const types = e.dataTransfer.types;
        if (
          types.includes('application/x-capcut-asset') ||
          types.includes('application/x-capcut-text-preset') ||
          types.includes('application/x-capcut-transition') ||
          types.includes('Files')
        ) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={handleDrop}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('.clip')) return;
        e.preventDefault();
        openCtx(e.clientX, e.clientY, [
          { label: 'Paste', disabled: useEditor.getState().clipboard.length === 0, onClick: () => pasteClips() },
          { label: '', separator: true },
          { label: track.muted ? 'Unmute Track' : 'Mute Track', onClick: () => updateTrack(track.id, { muted: !track.muted }) },
          { label: track.hidden ? 'Show Track' : 'Hide Track', onClick: () => updateTrack(track.id, { hidden: !track.hidden }) },
          { label: track.locked ? 'Unlock Track' : 'Lock Track', onClick: () => updateTrack(track.id, { locked: !track.locked }) },
          { label: '', separator: true },
          { label: 'Add Video Track', onClick: () => addTrack('video') },
          { label: 'Add Overlay Track', onClick: () => addTrack('overlay') },
          { label: 'Add Audio Track', onClick: () => addTrack('audio') },
          ...(track.type !== 'video'
            ? [{ label: 'Delete Track', danger: true, onClick: () => removeTrack(track.id) }]
            : []),
        ]);
      }}
    >
      {clips.map((clip) => (
        <TimelineClip key={clip.id} clip={clip} track={track} onSnapLine={onSnapLine} />
      ))}
      {boundaries.map((b) => (
        <div
          key={b.nextId}
          className={`transition-marker ${b.transitionType ? 'active' : ''}`}
          style={{ left: b.x }}
          title={b.transitionType ? `Transition: ${TRANSITIONS.find((t) => t.id === b.transitionType)?.name}` : 'Click to add transition'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            selectClips([b.nextId]);
            setMediaTab('transition');
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/x-capcut-transition')) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onDrop={(e) => {
            const transId = e.dataTransfer.getData('application/x-capcut-transition');
            if (!transId) return;
            e.preventDefault();
            e.stopPropagation();
            const next = project.clips.find((c) => c.id === b.nextId);
            if (!next) return;
            const prev = clips[clips.findIndex((c) => c.id === b.nextId) - 1];
            const dur = Math.min(0.5, Math.min(prev?.duration ?? 1, next.duration) * 0.9);
            setTransition(next.id, { type: transId, duration: Math.max(0.1, dur) });
          }}
        >
          <IconPlus size={12} />
        </div>
      ))}
    </div>
  );
}
