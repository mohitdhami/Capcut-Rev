import { useEffect, useRef } from 'react';
import { useEditor, projectDuration } from '../store/editor';
import { playbackEngine } from '../engine/playback';
import { formatTimecode } from '../utils/time';
import { IconLoop, IconPause, IconPlay, IconSkipEnd, IconSkipStart, IconSplit, IconTrash } from './icons';
import { addTextAt } from '../utils/actions';

export function PreviewPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playing = useEditor((s) => s.playing);
  const loop = useEditor((s) => s.loop);
  const currentTime = useEditor((s) => s.currentTime);
  const project = useEditor((s) => s.project);
  const setPlaying = useEditor((s) => s.setPlaying);
  const setTime = useEditor((s) => s.setTime);
  const setLoop = useEditor((s) => s.setLoop);
  const splitAt = useEditor((s) => s.splitAt);
  const removeClips = useEditor((s) => s.removeClips);
  const selectedClipIds = useEditor((s) => s.selectedClipIds);

  const duration = projectDuration(project);
  const fps = project.settings.fps;

  useEffect(() => {
    if (canvasRef.current) {
      playbackEngine.attach(canvasRef.current);
      return () => playbackEngine.detach();
    }
  }, []);

  return (
    <div className="preview-wrap">
      <div className="preview-stage">
        <div
          className="preview-canvas-box"
          style={{ aspectRatio: `${project.settings.width} / ${project.settings.height}`, height: '100%', maxWidth: '100%' }}
          onDoubleClick={() => addTextAt()}
          title="Double-click to add text"
        >
          <canvas ref={canvasRef} />
        </div>
      </div>
      <div className="transport">
        <button className="btn ghost icon" title="Go to start" onClick={() => setTime(0)}>
          <IconSkipStart />
        </button>
        <button className="play-btn" onClick={() => setPlaying(!playing)} title="Play/Pause (Space)">
          {playing ? <IconPause size={17} /> : <IconPlay size={17} />}
        </button>
        <button className="btn ghost icon" title="Go to end" onClick={() => setTime(duration)}>
          <IconSkipEnd />
        </button>
        <button
          className={`btn ghost icon ${loop ? 'active' : ''}`}
          title="Loop playback"
          onClick={() => setLoop(!loop)}
          style={loop ? { color: 'var(--accent)' } : undefined}
        >
          <IconLoop />
        </button>
        <div className="time-display">
          <span className="cur">{formatTimecode(currentTime, fps)}</span>
          <span>/</span>
          <span>{formatTimecode(duration, fps)}</span>
        </div>
        <div className="spacer" />
        <button
          className="btn ghost icon"
          title="Split clip (⌘B)"
          onClick={() => splitAt(currentTime, selectedClipIds.length ? selectedClipIds : undefined)}
        >
          <IconSplit />
        </button>
        <button
          className="btn ghost icon"
          title="Delete clip (Delete)"
          onClick={() => selectedClipIds.length && removeClips(selectedClipIds)}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}
