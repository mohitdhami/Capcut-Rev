import { useState } from 'react';
import { useEditor, resolveClipValue } from '../store/editor';
import {
  ANIMATIONS_IN,
  ANIMATIONS_OUT,
  ASPECTS,
  EFFECTS,
  FILTERS,
  FONT_FAMILIES,
  LOOPS,
  SPEED_PRESETS,
  TEXT_PRESETS,
} from '../constants';
import type { Clip, KeyframeProperty } from '../types';
import {
  IconKeyframe,
  IconX,
  IconSpeech,
  IconTrash,
  IconLock,
  IconMusic,
  IconSettings,
} from './icons';
import { detachAudio } from '../utils/actions';
import { formatDuration } from '../utils/time';

/* ------------------------------ small controls ----------------------------- */

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="insp-section">
      <div className="sec-title">
        <span>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  onCommit?: () => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="fill row" style={{ gap: 8 }}>
        <input
          className="slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onPointerUp={onCommit}
        />
        <span className="small dim" style={{ width: 46, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {format ? format(value) : value.toFixed(0)}
        </span>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="num-input fill"
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="fill row">
        <button className="color-swatch" style={{ background: value }}>
          <input type="color" value={toHex6(value)} onChange={(e) => onChange(e.target.value)} />
        </button>
        <span className="small dim">{toHex6(value).toUpperCase()}</span>
      </div>
    </div>
  );
}

function toHex6(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  const m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return `#${m[1].split('').map((x) => x + x).join('')}`;
  return '#000000';
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: React.ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- keyframes -------------------------------- */

const KF_PROPS: { prop: KeyframeProperty; name: string; min: number; max: number; step: number }[] = [
  { prop: 'positionX', name: 'Position X', min: -100, max: 100, step: 0.5 },
  { prop: 'positionY', name: 'Position Y', min: -100, max: 100, step: 0.5 },
  { prop: 'scale', name: 'Scale', min: 0.05, max: 5, step: 0.01 },
  { prop: 'rotation', name: 'Rotation', min: -180, max: 180, step: 1 },
  { prop: 'opacity', name: 'Opacity', min: 0, max: 1, step: 0.01 },
  { prop: 'volume', name: 'Volume', min: 0, max: 2, step: 0.01 },
];

function KeyframeStrip({ clip, prop }: { clip: Clip; prop: KeyframeProperty }) {
  const moveKeyframe = useEditor((s) => s.moveKeyframe);
  const removeKeyframeAt = useEditor((s) => s.removeKeyframeAt);
  const kfs = clip.keyframes[prop] ?? [];
  if (kfs.length === 0) return null;
  return (
    <div
      style={{ position: 'relative', height: 16, background: 'var(--bg-elevated)', borderRadius: 4, margin: '2px 0 8px 70px' }}
      title="Drag a keyframe to move it in time, double-click to delete"
    >
      {kfs.map((k) => (
        <div
          key={k.time}
          style={{
            position: 'absolute',
            left: `${(k.time / Math.max(0.001, clip.duration)) * 100}%`,
            top: 1,
            transform: 'translateX(-50%)',
            color: 'var(--accent)',
            cursor: 'ew-resize',
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            const startX = e.clientX;
            const origTime = k.time;
            const stripW = (e.currentTarget.parentElement?.offsetWidth ?? 200) || 200;
            const timePerPx = clip.duration / stripW;
            const move = (ev: PointerEvent) => {
              const dt = (ev.clientX - startX) * timePerPx;
              moveKeyframe(clip.id, prop, origTime, Math.max(0, Math.min(clip.duration, origTime + dt)), k.value, true);
            };
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              useEditor.getState().endTransient();
            };
            useEditor.getState().beginTransient();
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            removeKeyframeAt(clip.id, prop, k.time);
          }}
        >
          <IconKeyframe size={13} />
        </div>
      ))}
    </div>
  );
}

function KeyframeSection({ clips }: { clips: Clip[] }) {
  const currentTime = useEditor((s) => s.currentTime);
  const setKeyframe = useEditor((s) => s.setKeyframe);
  const removeKeyframeAt = useEditor((s) => s.removeKeyframeAt);
  const clip = clips[0];
  const localTime = Math.max(0, Math.min(clip.duration, currentTime - clip.start));
  const hasAt = (prop: KeyframeProperty) =>
    (clip.keyframes[prop] ?? []).some((k) => Math.abs(k.time - localTime) < 0.03);

  return (
    <Section title="Keyframes" action={<span className="small dim">At playhead ◆</span>}>
      {KF_PROPS.filter((p) => p.prop !== 'volume' || clip.kind === 'video' || clip.kind === 'audio').map((p) => {
        const kfs = clip.keyframes[p.prop] ?? [];
        const at = hasAt(p.prop);
        return (
          <div key={p.prop}>
            <div className="keyframe-row">
              <span className="kf-name">{p.name}</span>
              <span className="small dim grow" style={{ textAlign: 'right' }}>
                {kfs.length > 0 ? `${kfs.length} keyframe${kfs.length === 1 ? '' : 's'}` : '—'}
              </span>
              <button
                className={`btn sm ${at ? 'primary' : ''}`}
                title={at ? 'Remove keyframe here' : 'Add keyframe at playhead'}
                onClick={() => {
                  if (at) removeKeyframeAt(clip.id, p.prop, localTime);
                  else setKeyframe(clip.id, p.prop, localTime, resolveClipValue(clip, p.prop, localTime));
                }}
              >
                <IconKeyframe size={12} />
              </button>
              {kfs.length > 0 && (
                <button
                  className="btn sm ghost"
                  title="Clear all"
                  onClick={() => {
                    for (const k of kfs) removeKeyframeAt(clip.id, p.prop, k.time);
                  }}
                >
                  <IconX size={12} />
                </button>
              )}
            </div>
            <KeyframeStrip clip={clip} prop={p.prop} />
          </div>
        );
      })}
    </Section>
  );
}

/* -------------------------------- main panel ------------------------------- */

export function Inspector() {
  const project = useEditor((s) => s.project);
  const selectedClipIds = useEditor((s) => s.selectedClipIds);
  const clips = project.clips.filter((c) => selectedClipIds.includes(c.id));

  if (clips.length === 0) return <ProjectPanel />;
  if (clips.length > 1) return <MultiPanel clips={clips} />;
  const clip = clips[0];
  return (
    <div className="right-panel">
      <div className="insp-header">
        <span>{clip.kind === 'text' ? 'Text' : clip.kind === 'sticker' ? 'Sticker' : clip.kind === 'audio' ? 'Audio' : clip.kind === 'image' ? 'Image' : 'Video'}</span>
        <span className="kind-chip">{formatDuration(clip.duration)}</span>
      </div>
      <div className="panel-body">
        {clip.kind === 'text' && <TextPanel clip={clip} />}
        {(clip.kind === 'video' || clip.kind === 'image' || clip.kind === 'audio' || clip.kind === 'sticker') && <TransformPanel clip={clip} />}
        {(clip.kind === 'video' || clip.kind === 'audio') && <SpeedPanel clip={clip} />}
        {(clip.kind === 'video' || clip.kind === 'audio') && <AudioPanel clip={clip} />}
        {(clip.kind === 'video' || clip.kind === 'image') && <FilterPanel clip={clip} />}
        {clip.kind !== 'audio' && <EffectsPanel clip={clip} />}
        {clip.kind === 'video' && <ChromaKeyPanel clip={clip} />}
        <KeyframeSection clips={clips} />
      </div>
    </div>
  );
}

function ProjectPanel() {
  const project = useEditor((s) => s.project);
  const setProjectSettings = useEditor((s) => s.setProjectSettings);
  const setPlaying = useEditor((s) => s.setPlaying);
  const playing = useEditor((s) => s.playing);
  const clearAll = () => {
    useEditor.getState().commit((d) => {
      d.clips = [];
    });
  };
  return (
    <div className="right-panel">
      <div className="insp-header">
        <IconSettings size={15} />
        <span>Canvas</span>
      </div>
      <div className="panel-body">
        <Section title="Canvas Settings">
          <div className="field">
            <label>Aspect Ratio</label>
            <select
              className="select-input fill"
              value={project.settings.aspect}
              onChange={(e) => {
                const a = ASPECTS.find((x) => x.id === e.target.value);
                if (a) setProjectSettings({ aspect: a.id, width: a.width, height: a.height });
              }}
            >
              {ASPECTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} ({a.width}×{a.height})
                </option>
              ))}
            </select>
          </div>
          <ColorField label="Background" value={project.settings.background} onChange={(v) => setProjectSettings({ background: v })} />
          <NumberField
            label="Frame Rate"
            value={project.settings.fps}
            min={1}
            max={120}
            onChange={(v) => setProjectSettings({ fps: Math.max(1, Math.min(120, Math.round(v))) })}
          />
        </Section>
        <Section title="Playback">
          <div className="field">
            <label>Loop</label>
            <div className="fill">
              <Seg
                value={useEditor.getState().loop ? 'on' : 'off'}
                options={[
                  { id: 'on', label: 'On' },
                  { id: 'off', label: 'Off' },
                ]}
                onChange={(v) => useEditor.getState().setLoop(v === 'on')}
              />
            </div>
          </div>
          <button className="btn" style={{ width: '100%' }} onClick={() => setPlaying(!playing)}>
            {playing ? 'Pause Preview' : 'Play Preview'}
          </button>
        </Section>
        <Section title="Danger Zone">
          <button className="btn danger" style={{ width: '100%' }} onClick={clearAll}>
            <IconTrash size={14} /> Clear Timeline
          </button>
        </Section>
        <div className="insp-section small dim">
          Tip: double-click a timeline clip to select and edit its properties; double-click the preview to quickly add text.
        </div>
      </div>
    </div>
  );
}

function MultiPanel({ clips }: { clips: Clip[] }) {
  const updateClips = useEditor((s) => s.updateClips);
  const ids = clips.map((c) => c.id);
  const any = clips[0];
  const hasAudio = clips.some((c) => c.kind === 'video' || c.kind === 'audio');
  return (
    <div className="right-panel">
      <div className="insp-header">
        <span>{clips.length} clips selected</span>
      </div>
      <div className="panel-body">
        <Section title="Bulk Adjust">
          <SliderField
            label="Opacity"
            min={0}
            max={100}
            value={Math.round((any.opacity ?? 1) * 100)}
            onChange={(v) => updateClips(ids, { opacity: v / 100 })}
            format={(v) => `${v}%`}
          />
          {hasAudio && (
            <SliderField
              label="Volume"
              min={0}
              max={200}
              value={Math.round((any.volume ?? 1) * 100)}
              onChange={(v) => updateClips(ids, { volume: v / 100 })}
              format={(v) => `${v}%`}
            />
          )}
          <SliderField
            label="Scale"
            min={5}
            max={400}
            value={Math.round((any.transform.scale ?? 1) * 100)}
            onChange={(v) => updateClips(ids, { transform: { ...any.transform, scale: v / 100 } })}
            format={(v) => `${v}%`}
          />
        </Section>
        <Section title="Actions">
          <button
            className="btn danger"
            style={{ width: '100%' }}
            onClick={() => useEditor.getState().removeClips(ids)}
          >
            <IconTrash size={14} /> Delete Selected Clips
          </button>
        </Section>
      </div>
    </div>
  );
}

/* ------------------------------ clip panels ------------------------------- */

function TransformPanel({ clip }: { clip: Clip }) {
  const updateClip = useEditor((s) => s.updateClip);
  const setKeyframe = useEditor((s) => s.setKeyframe);
  const currentTime = useEditor((s) => s.currentTime);
  const localTime = Math.max(0, Math.min(clip.duration, currentTime - clip.start));

  const setProp = (prop: KeyframeProperty, value: number) => {
    const kfs = clip.keyframes[prop];
    if (kfs && kfs.length > 0) {
      setKeyframe(clip.id, prop, localTime, value);
      return;
    }
    switch (prop) {
      case 'positionX':
        updateClip(clip.id, { transform: { ...clip.transform, x: value } });
        break;
      case 'positionY':
        updateClip(clip.id, { transform: { ...clip.transform, y: value } });
        break;
      case 'scale':
        updateClip(clip.id, { transform: { ...clip.transform, scale: value } });
        break;
      case 'rotation':
        updateClip(clip.id, { transform: { ...clip.transform, rotation: value } });
        break;
      case 'opacity':
        updateClip(clip.id, { opacity: value });
        break;
      default:
        break;
    }
  };

  const x = resolveClipValue(clip, 'positionX', localTime);
  const y = resolveClipValue(clip, 'positionY', localTime);
  const scale = resolveClipValue(clip, 'scale', localTime);
  const rotation = resolveClipValue(clip, 'rotation', localTime);
  const opacity = resolveClipValue(clip, 'opacity', localTime);

  return (
    <Section
      title="Basic"
      action={
        <span
          className="reset"
          onClick={() =>
            updateClip(clip.id, { transform: { x: 0, y: 0, scale: 1, rotation: 0 }, opacity: 1, keyframes: {} })
          }
        >
          Reset
        </span>
      }
    >
      <SliderField label="Position X" min={-100} max={100} step={0.5} value={x} onChange={(v) => setProp('positionX', v)} format={(v) => `${v.toFixed(0)}`} />
      <SliderField label="Position Y" min={-100} max={100} step={0.5} value={y} onChange={(v) => setProp('positionY', v)} format={(v) => `${v.toFixed(0)}`} />
      <SliderField label="Scale" min={5} max={400} step={1} value={scale * 100} onChange={(v) => setProp('scale', v / 100)} format={(v) => `${v.toFixed(0)}%`} />
      <SliderField label="Rotation" min={-180} max={180} step={1} value={rotation} onChange={(v) => setProp('rotation', v)} format={(v) => `${v.toFixed(0)}°`} />
      <SliderField label="Opacity" min={0} max={100} step={1} value={opacity * 100} onChange={(v) => setProp('opacity', v / 100)} format={(v) => `${v.toFixed(0)}%`} />
    </Section>
  );
}

function SpeedPanel({ clip }: { clip: Clip }) {
  const updateClip = useEditor((s) => s.updateClip);
  const assets = useEditor((s) => s.project.assets);
  const asset = clip.assetId ? assets.find((a) => a.id === clip.assetId) : undefined;
  const maxDur = asset && asset.kind !== 'image' ? (asset.duration - clip.offset) / clip.speed : Infinity;
  return (
    <Section title="Speed">
      <SliderField
        label="Speed"
        min={0.1}
        max={4}
        step={0.05}
        value={clip.speed}
        onChange={(v) => {
          const newSpeed = Math.max(0.1, v);
          const newDuration = asset && asset.kind !== 'image' ? Math.min(clip.duration, (asset.duration - clip.offset) / newSpeed) : clip.duration;
          updateClip(clip.id, { speed: newSpeed, duration: Math.max(0.05, newDuration) });
        }}
        format={(v) => `${v.toFixed(2)}x`}
      />
      <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
        {SPEED_PRESETS.map((s) => (
          <button
            key={s}
            className={`btn sm ${Math.abs(clip.speed - s) < 0.001 ? 'primary' : ''}`}
            onClick={() => {
              const newDuration = asset && asset.kind !== 'image' ? Math.min(clip.duration, (asset.duration - clip.offset) / s) : clip.duration;
              updateClip(clip.id, { speed: s, duration: Math.max(0.05, newDuration) });
            }}
          >
            {s}x
          </button>
        ))}
      </div>
      {asset && asset.kind !== 'image' && (
        <div className="small dim mt8">
          Source {formatDuration(asset.duration)} · up to {Number.isFinite(maxDur) ? formatDuration(Math.max(clip.duration, (asset.duration - clip.offset) / clip.speed)) : 'unlimited'}
        </div>
      )}
    </Section>
  );
}

function AudioPanel({ clip }: { clip: Clip }) {
  const updateClip = useEditor((s) => s.updateClip);
  const showToast = useEditor((s) => s.showToast);
  const currentTime = useEditor((s) => s.currentTime);
  const localTime = Math.max(0, Math.min(clip.duration, currentTime - clip.start));
  const kfs = clip.keyframes.volume ?? [];
  const vol = resolveClipValue(clip, 'volume', localTime);

  const setVolume = (v: number) => {
    if (kfs.length > 0) useEditor.getState().setKeyframe(clip.id, 'volume', localTime, v);
    else updateClip(clip.id, { volume: v });
  };

  return (
    <Section title="Audio">
      <SliderField label="Volume" min={0} max={200} value={vol * 100} onChange={(v) => setVolume(v / 100)} format={(v) => `${v.toFixed(0)}%`} />
      <SliderField
        label="Fade In"
        min={0}
        max={Math.max(0.1, Math.min(5, clip.duration / 2))}
        step={0.1}
        value={clip.fadeIn}
        onChange={(v) => updateClip(clip.id, { fadeIn: v })}
        format={(v) => `${v.toFixed(1)}s`}
      />
      <SliderField
        label="Fade Out"
        min={0}
        max={Math.max(0.1, Math.min(5, clip.duration / 2))}
        step={0.1}
        value={clip.fadeOut}
        onChange={(v) => updateClip(clip.id, { fadeOut: v })}
        format={(v) => `${v.toFixed(1)}s`}
      />
      <div className="field">
        <label>Mute</label>
        <div className="fill">
          <Seg
            value={clip.muted ? 'on' : 'off'}
            options={[
              { id: 'off', label: 'Normal' },
              { id: 'on', label: 'Muted' },
            ]}
            onChange={(v) => updateClip(clip.id, { muted: v === 'on' })}
          />
        </div>
      </div>
      {clip.kind === 'video' && (
        <button
          className="btn sm mt8"
          style={{ width: '100%' }}
          onClick={() => {
            detachAudio([clip.id]);
            showToast('Audio detached to an audio track');
          }}
        >
          <IconMusic size={13} /> Detach Audio
        </button>
      )}
    </Section>
  );
}

function FilterPanel({ clip }: { clip: Clip }) {
  const updateClip = useEditor((s) => s.updateClip);
  const current = FILTERS.find((f) => f.id === (clip.filterId ?? 'none')) ?? FILTERS[0];
  return (
    <Section
      title="Filter"
      action={
        clip.filterId ? (
          <span className="reset" onClick={() => updateClip(clip.id, { filterId: null })}>
            Remove
          </span>
        ) : undefined
      }
    >
      <div className="field">
        <label>Current</label>
        <span className="small grow">{current.name}</span>
      </div>
      {clip.filterId && (
        <SliderField
          label="Intensity"
          min={0}
          max={100}
          value={clip.filterIntensity}
          onChange={(v) => updateClip(clip.id, { filterIntensity: v })}
          format={(v) => `${v}%`}
        />
      )}
      {!clip.filterId && <div className="small dim">Pick a filter from the Filters tab on the left</div>}
    </Section>
  );
}

function EffectsPanel({ clip }: { clip: Clip }) {
  const updateClip = useEditor((s) => s.updateClip);
  const removeEffect = useEditor((s) => s.removeEffect);
  return (
    <Section title="Effects">
      {clip.effects.length === 0 ? (
        <div className="small dim">Add effects from the Effects tab on the left</div>
      ) : (
        clip.effects.map((e) => {
          const preset = EFFECTS.find((x) => x.id === e.effectId);
          return (
            <div key={e.id} className="field">
              <label>{preset?.name ?? e.effectId}</label>
              <div className="fill row" style={{ gap: 6 }}>
                <input
                  className="slider"
                  type="range"
                  min={0}
                  max={100}
                  value={e.intensity}
                  onChange={(ev) =>
                    updateClip(clip.id, (c) => ({
                      effects: c.effects.map((x) => (x.id === e.id ? { ...x, intensity: parseFloat(ev.target.value) } : x)),
                    }))
                  }
                />
                <button className="btn sm ghost" onClick={() => removeEffect(clip.id, e.effectId)}>
                  <IconX size={12} />
                </button>
              </div>
            </div>
          );
        })
      )}
    </Section>
  );
}

function ChromaKeyPanel({ clip }: { clip: Clip }) {
  const updateClip = useEditor((s) => s.updateClip);
  const ck = clip.chromaKey;
  const set = (patch: Partial<typeof ck>) => updateClip(clip.id, { chromaKey: { ...ck, ...patch } });
  return (
    <Section title="Chroma Key">
      <div className="field">
        <label>Enable</label>
        <div className="fill">
          <Seg
            value={ck.enabled ? 'on' : 'off'}
            options={[
              { id: 'off', label: 'Off' },
              { id: 'on', label: 'On' },
            ]}
            onChange={(v) => set({ enabled: v === 'on' })}
          />
        </div>
      </div>
      {ck.enabled && (
        <>
          <ColorField label="Key Color" value={ck.color} onChange={(v) => set({ color: v })} />
          <div className="row" style={{ gap: 4, marginBottom: 8 }}>
            {['#00ff00', '#0000ff', '#ffffff', '#ff00ff'].map((c) => (
              <button key={c} className="btn sm" style={{ background: c, width: 26, height: 22 }} onClick={() => set({ color: c })} />
            ))}
          </div>
          <SliderField label="Similarity" min={0} max={100} value={ck.similarity} onChange={(v) => set({ similarity: v })} />
          <SliderField label="Smoothness" min={0} max={100} value={ck.smoothness} onChange={(v) => set({ smoothness: v })} />
          <SliderField label="Spill Suppression" min={0} max={100} value={ck.spill} onChange={(v) => set({ spill: v })} />
        </>
      )}
    </Section>
  );
}

/* -------------------------------- text panel ------------------------------- */

function TextPanel({ clip }: { clip: Clip }) {
  const updateClip = useEditor((s) => s.updateClip);
  const text = clip.text!;
  const set = (patch: Partial<typeof text>) => updateClip(clip.id, (c) => ({ text: { ...c.text!, ...patch } }));
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <Section title="Text Content">
        <textarea
          className="text-input"
          value={text.content}
          spellCheck={false}
          placeholder="Enter text…"
          onChange={(e) => set({ content: e.target.value })}
        />
      </Section>
      <Section title="Style Presets">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {TEXT_PRESETS.map((p) => (
            <button key={p.id} className="btn sm" onClick={() => set(p.patch as Partial<typeof text>)}>
              {p.name}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Text Style">
        <div className="field">
          <label>Font</label>
          <select className="select-input fill" value={text.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <SliderField label="Font Size" min={12} max={300} value={text.fontSize} onChange={(v) => set({ fontSize: v })} />
        <ColorField label="Color" value={text.color} onChange={(v) => set({ color: v })} />
        <div className="field">
          <label>Style</label>
          <div className="fill row" style={{ gap: 6 }}>
            <button className={`btn sm ${text.bold ? 'active' : ''}`} style={{ fontWeight: 800, width: 32 }} onClick={() => set({ bold: !text.bold })}>
              B
            </button>
            <button className={`btn sm ${text.italic ? 'active' : ''}`} style={{ fontStyle: 'italic', width: 32 }} onClick={() => set({ italic: !text.italic })}>
              I
            </button>
            <div className="grow">
              <Seg
                value={text.align}
                options={[
                  { id: 'left', label: 'L' },
                  { id: 'center', label: 'C' },
                  { id: 'right', label: 'R' },
                ]}
                onChange={(v) => set({ align: v })}
              />
            </div>
          </div>
        </div>
        <SliderField label="Letter Spacing" min={-5} max={30} step={0.5} value={text.letterSpacing} onChange={(v) => set({ letterSpacing: v })} />
        <SliderField label="Line Height" min={0.8} max={3} step={0.05} value={text.lineHeight} onChange={(v) => set({ lineHeight: v })} format={(v) => v.toFixed(2)} />
      </Section>
      <Section title="Stroke / Shadow">
        <SliderField label="Stroke" min={0} max={12} step={0.5} value={text.strokeWidth} onChange={(v) => set({ strokeWidth: v })} />
        {text.strokeWidth > 0 && <ColorField label="Stroke Color" value={text.strokeColor} onChange={(v) => set({ strokeColor: v })} />}
        <SliderField label="Shadow" min={0} max={40} value={text.shadowBlur} onChange={(v) => set({ shadowBlur: v })} />
        {text.shadowBlur > 0 && (
          <>
            <ColorField label="Shadow Color" value={toHex6(text.shadowColor)} onChange={(v) => set({ shadowColor: v })} />
            <SliderField label="Shadow X" min={-30} max={30} value={text.shadowOffX} onChange={(v) => set({ shadowOffX: v })} />
            <SliderField label="Shadow Y" min={-30} max={30} value={text.shadowOffY} onChange={(v) => set({ shadowOffY: v })} />
          </>
        )}
      </Section>
      <Section title="Background">
        <SliderField label="Background Opacity" min={0} max={100} value={text.bgOpacity * 100} onChange={(v) => set({ bgOpacity: v / 100 })} format={(v) => `${v}%`} />
        {text.bgOpacity > 0 && (
          <>
            <ColorField label="Background Color" value={text.bgColor} onChange={(v) => set({ bgColor: v })} />
            <SliderField label="Padding" min={0} max={60} value={text.bgPadding} onChange={(v) => set({ bgPadding: v })} />
          </>
        )}
      </Section>
      <Section title="Animation">
        <div className="field">
          <label>In</label>
          <select
            className="select-input fill"
            value={text.animationIn?.preset ?? 'none'}
            onChange={(e) => set({ animationIn: e.target.value === 'none' ? null : { preset: e.target.value as never, duration: text.animationIn?.duration ?? 0.5 } })}
          >
            {ANIMATIONS_IN.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        {text.animationIn && (
          <NumberField label="In Duration" value={text.animationIn.duration} min={0.1} max={3} step={0.1} onChange={(v) => set({ animationIn: { ...text.animationIn!, duration: v } })} />
        )}
        <div className="field">
          <label>Out</label>
          <select
            className="select-input fill"
            value={text.animationOut?.preset ?? 'none'}
            onChange={(e) => set({ animationOut: e.target.value === 'none' ? null : { preset: e.target.value as never, duration: text.animationOut?.duration ?? 0.5 } })}
          >
            {ANIMATIONS_OUT.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        {text.animationOut && (
          <NumberField label="Out Duration" value={text.animationOut.duration} min={0.1} max={3} step={0.1} onChange={(v) => set({ animationOut: { ...text.animationOut!, duration: v } })} />
        )}
        <div className="field">
          <label>Loop</label>
          <select className="select-input fill" value={text.animationLoop} onChange={(e) => set({ animationLoop: e.target.value as never })}>
            {LOOPS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </Section>
      <Section title="Actions">
        <button className="btn danger" style={{ width: '100%' }} onClick={() => (confirmDelete ? useEditor.getState().removeClips([clip.id]) : setConfirmDelete(true))}>
          <IconTrash size={14} /> {confirmDelete ? 'Confirm delete text?' : 'Delete Text'}
        </button>
      </Section>
      <div style={{ display: 'none' }}>
        <IconSpeech />
        <IconLock />
      </div>
    </>
  );
}
