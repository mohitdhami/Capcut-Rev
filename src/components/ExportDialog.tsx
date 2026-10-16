import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, projectDuration, uid } from '../store/editor';
import { EXPORT_AUDIO_BITRATES, EXPORT_FPS, EXPORT_RESOLUTIONS } from '../constants';
import { buildExportArgs } from '../engine/exportBuilder';
import { useUI } from '../store/ui';
import { formatDuration } from '../utils/time';
import { IconExport, IconFolder, IconX } from './icons';
import type { ExportPreset } from '../types';

export function ExportDialog() {
  const open = useEditor((s) => s.exportOpen);
  const setOpen = useEditor((s) => s.setExportOpen);
  const project = useEditor((s) => s.project);
  const showToast = useEditor((s) => s.showToast);
  const fonts = useUI((s) => s.fonts);

  const [resolution, setResolution] = useState('1080p');
  const [fps, setFps] = useState<number>(project.settings.fps || 30);
  const [codec, setCodec] = useState<'h264' | 'hevc'>('h264');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('high');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [audioBitrate, setAudioBitrate] = useState(192);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<string>('');
  const [log, setLog] = useState('');
  const [donePath, setDonePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const jobIdRef = useRef<string>('');
  const duration = projectDuration(project);

  const preset: ExportPreset = useMemo(() => {
    const short = EXPORT_RESOLUTIONS.find((r) => r.id === resolution)?.short ?? 1080;
    const minSide = Math.min(project.settings.width, project.settings.height);
    const scale = short / minSide;
    const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);
    return {
      resolution,
      width: even(project.settings.width * scale),
      height: even(project.settings.height * scale),
      fps,
      codec,
      quality,
      audioBitrate,
      includeAudio,
    };
  }, [resolution, fps, codec, quality, includeAudio, audioBitrate, project.settings]);

  useEffect(() => {
    return window.api.onExportProgress((data) => {
      if (data.id !== jobIdRef.current) return;
      if (data.progress !== undefined) setProgress(data.progress);
      if (data.speed) setSpeed(data.speed);
      if (data.log) setLog(data.log);
      if (data.done) setProgress(1);
    });
  }, []);

  useEffect(() => {
    if (open) {
      setProgress(0);
      setLog('');
      setError(null);
      setDonePath(null);
      setSpeed('');
      setFps(project.settings.fps || 30);
    }
  }, [open, project.settings.fps]);

  if (!open) return null;

  const defaultName = `${project.settings.name || 'export'}_${new Date().toISOString().slice(0, 10)}.mp4`;

  const startExport = async () => {
    setError(null);
    setDonePath(null);
    const outputPath = await window.api.chooseExportPath(defaultName);
    if (!outputPath) return;
    try {
      const built = await buildExportArgs(project, preset, fonts, outputPath);
      setUnsupported(built.unsupported);
      const id = uid();
      jobIdRef.current = id;
      setExporting(true);
      setProgress(0);
      const res = await window.api.startExport({ id, args: built.args, duration: built.duration });
      setExporting(false);
      if (res.ok) {
        setDonePath(outputPath);
        showToast('Export complete');
      } else if (res.canceled) {
        showToast('Export canceled');
      } else {
        setError(res.error || 'Export failed');
        if (res.log) setLog(res.log);
      }
    } catch (err) {
      setExporting(false);
      setError(String(err));
    }
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget && !exporting) setOpen(false); }}>
      <div className="modal">
        <div className="modal-head">
          <span>Export</span>
          <button className="btn ghost icon" disabled={exporting} onClick={() => setOpen(false)}>
            <IconX />
          </button>
        </div>
        <div className="modal-body">
          <div className="export-row">
            <div className="export-field">
              <span className="lbl">Resolution</span>
              <select className="select-input" value={resolution} onChange={(e) => setResolution(e.target.value)}>
                {EXPORT_RESOLUTIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="export-field">
              <span className="lbl">Frame Rate</span>
              <select className="select-input" value={fps} onChange={(e) => setFps(parseInt(e.target.value, 10))}>
                {EXPORT_FPS.map((f) => (
                  <option key={f} value={f}>
                    {f}fps
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="export-row">
            <div className="export-field">
              <span className="lbl">Codec</span>
              <select className="select-input" value={codec} onChange={(e) => setCodec(e.target.value as 'h264' | 'hevc')}>
                <option value="h264">H.264 (best compatibility)</option>
                <option value="hevc">H.265 / HEVC (smaller file)</option>
              </select>
            </div>
            <div className="export-field">
              <span className="lbl">Quality</span>
              <select className="select-input" value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High (recommended)</option>
                <option value="ultra">Ultra</option>
              </select>
            </div>
          </div>
          <div className="export-row">
            <div className="export-field">
              <span className="lbl">Audio</span>
              <select
                className="select-input"
                value={includeAudio ? String(audioBitrate) : 'none'}
                onChange={(e) => {
                  if (e.target.value === 'none') setIncludeAudio(false);
                  else {
                    setIncludeAudio(true);
                    setAudioBitrate(parseInt(e.target.value, 10));
                  }
                }}
              >
                <option value="none">No audio</option>
                {EXPORT_AUDIO_BITRATES.map((b) => (
                  <option key={b} value={b}>
                    AAC {b}kbps
                  </option>
                ))}
              </select>
            </div>
            <div className="export-field">
              <span className="lbl">Format</span>
              <select className="select-input" disabled>
                <option>MP4 / MOV</option>
              </select>
            </div>
          </div>

          <div className="export-summary">
            <div>
              Duration {formatDuration(duration)} · {preset.width}×{preset.height} · {preset.fps}fps · {preset.codec === 'hevc' ? 'H.265' : 'H.264'} · {quality}
            </div>
            {unsupported.length > 0 && (
              <div className="warn">⚠ These effects will be approximated or are not supported: {unsupported.join(', ')}</div>
            )}
            <div className="small">Text is rendered with system fonts. Do not close the window while exporting.</div>
          </div>

          {exporting && (
            <>
              <div className="progress-bar">
                <div className="fill" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div className="small dim">
                Exporting… {Math.round(progress * 100)}% {speed ? `· ${speed}` : ''}
              </div>
            </>
          )}
          {log && <div className="export-log">{log}</div>}
          {error && <div className="export-summary" style={{ color: 'var(--danger)' }}>{error}</div>}
          {donePath && (
            <div className="export-summary">
              ✅ Export complete: {donePath}
              <div style={{ marginTop: 8 }}>
                <button className="btn sm" onClick={() => void window.api.revealInFolder(donePath)}>
                  <IconFolder size={13} /> Reveal in Finder
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          {exporting ? (
            <button className="btn" onClick={() => window.api.cancelExport(jobIdRef.current)}>
              Cancel Export
            </button>
          ) : (
            <button className="btn" onClick={() => setOpen(false)}>
              Close
            </button>
          )}
          <button className="btn primary" disabled={exporting} onClick={() => void startExport()}>
            <IconExport size={14} />
            {exporting ? 'Exporting…' : 'Start Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
