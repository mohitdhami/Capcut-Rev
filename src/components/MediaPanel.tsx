import { useMemo, useState } from 'react';
import { useEditor } from '../store/editor';
import { useMediaCache } from '../store/mediaCache';
import { useUI, type CtxItem } from '../store/ui';
import {
  EMOJI_GROUPS,
  EFFECTS,
  FILTERS,
  TEXT_PRESETS,
  TRANSITIONS,
} from '../constants';
import { addAssetToTimeline, addStickerAt, addTextAt, importFromDrop, importMedia } from '../utils/actions';
import { formatDuration } from '../utils/time';
import { cssFilter } from '../engine/render';
import {
  IconEffects,
  IconFilter,
  IconImage,
  IconImport,
  IconMusic,
  IconSpeech,
  IconSticker,
  IconText,
  IconTransition,
  IconVideo,
} from './icons';
import type { MediaAsset } from '../types';

const TABS = [
  { id: 'media', name: 'Media', icon: IconVideo },
  { id: 'audio', name: 'Audio', icon: IconMusic },
  { id: 'text', name: 'Text', icon: IconText },
  { id: 'sticker', name: 'Stickers', icon: IconSticker },
  { id: 'effect', name: 'Effects', icon: IconEffects },
  { id: 'transition', name: 'Transitions', icon: IconTransition },
  { id: 'filter', name: 'Filters', icon: IconFilter },
];

export function MediaPanel() {
  const tab = useUI((s) => s.mediaTab);
  const setTab = useUI((s) => s.setMediaTab);
  const [dropping, setDropping] = useState(false);

  return (
    <div
      className="left-panel"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={async (e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDropping(false);
          await importFromDrop(e.dataTransfer);
        }
      }}
      style={dropping ? { outline: '2px dashed var(--accent)', outlineOffset: '-6px' } : undefined}
    >
      <div className="panel-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.id} className={`panel-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Icon size={14} />
                {t.name}
              </span>
            </div>
          );
        })}
      </div>
      <div className="panel-body">
        {tab === 'media' && <MediaTab />}
        {tab === 'audio' && <AudioTab />}
        {tab === 'text' && <TextTab />}
        {tab === 'sticker' && <StickerTab />}
        {tab === 'effect' && <EffectTab />}
        {tab === 'transition' && <TransitionTab />}
        {tab === 'filter' && <FilterTab />}
      </div>
    </div>
  );
}

/* --------------------------------- media --------------------------------- */

function MediaTab() {
  const assets = useEditor((s) => s.project.assets);
  const selectedAssetIds = useEditor((s) => s.selectedAssetIds);
  const selectAssets = useEditor((s) => s.selectAssets);
  const removeAssets = useEditor((s) => s.removeAssets);
  const updateAsset = useEditor((s) => s.updateAsset);
  const showToast = useEditor((s) => s.showToast);
  const thumbs = useMediaCache((s) => s.thumbs);
  const openCtx = useUI((s) => s.openContextMenu);

  const visualAssets = assets.filter((a) => a.kind !== 'audio');

  const assetMenu = (asset: MediaAsset): CtxItem[] => [
    { label: 'Add to Timeline', onClick: () => addAssetToTimeline(asset.id) },
    {
      label: 'Reveal in Finder',
      onClick: () => void window.api.revealInFolder(asset.path),
    },
    ...(asset.offline
      ? [
          {
            label: 'Relink',
            onClick: async () => {
              const probe = await window.api.probeFile(asset.path);
              if (probe) {
                updateAsset(asset.id, { offline: false, url: probe.url });
                showToast('Relinked');
              } else showToast('File not found');
            },
          } as CtxItem,
        ]
      : []),
    { label: '', separator: true },
    {
      label: 'Remove from Project',
      danger: true,
      onClick: () => removeAssets([asset.id]),
    },
  ];

  return (
    <div>
      <div className="media-actions">
        <button className="btn" style={{ flex: 1 }} onClick={() => void importMedia()}>
          <IconImport size={15} />
          Import Media
        </button>
      </div>
      {visualAssets.length === 0 ? (
        <div className="empty-hint">
          Click the button above to import videos and images,
          <br />
          or drop files into this panel / timeline
        </div>
      ) : (
        <div className="media-grid">
          {visualAssets.map((asset) => {
            const thumb = thumbs[asset.path];
            return (
              <div
                key={asset.id}
                className={`media-card ${selectedAssetIds.includes(asset.id) ? 'selected' : ''} ${asset.offline ? 'offline' : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-capcut-asset', asset.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={(e) => selectAssets([asset.id], e.metaKey || e.ctrlKey)}
                onDoubleClick={() => addAssetToTimeline(asset.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!selectedAssetIds.includes(asset.id)) selectAssets([asset.id]);
                  openCtx(e.clientX, e.clientY, assetMenu(asset));
                }}
              >
                {thumb ? (
                  <img className="thumb" src={thumb} alt={asset.name} draggable={false} />
                ) : (
                  <div className="thumb audio-thumb">
                    {asset.kind === 'video' ? <IconVideo size={26} /> : <IconImage size={26} />}
                  </div>
                )}
                <span className="kind-badge">{asset.kind === 'video' ? 'Video' : 'Image'}</span>
                {asset.kind === 'video' && <span className="dur">{formatDuration(asset.duration)}</span>}
                <div className="meta">
                  <div className="name" title={asset.name}>
                    {asset.offline ? '⚠ ' : ''}
                    {asset.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- audio --------------------------------- */

function AudioTab() {
  const assets = useEditor((s) => s.project.assets);
  const selectedAssetIds = useEditor((s) => s.selectedAssetIds);
  const selectAssets = useEditor((s) => s.selectAssets);
  const removeAssets = useEditor((s) => s.removeAssets);
  const openCtx = useUI((s) => s.openContextMenu);
  const audioAssets = assets.filter((a) => a.kind === 'audio' || a.hasAudio);

  return (
    <div>
      <div className="media-actions">
        <button className="btn" style={{ flex: 1 }} onClick={() => void importMedia()}>
          <IconImport size={15} />
          Import Audio
        </button>
      </div>
      {audioAssets.length === 0 ? (
        <div className="empty-hint">
          Import music or sound effects,
          <br />
          or right-click a video clip to Detach Audio
        </div>
      ) : (
        <div style={{ padding: '4px 12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {audioAssets.map((asset) => (
            <div
              key={asset.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-capcut-asset', asset.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={(e) => selectAssets([asset.id], e.metaKey || e.ctrlKey)}
              onDoubleClick={() => addAssetToTimeline(asset.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                selectAssets([asset.id]);
                openCtx(e.clientX, e.clientY, [
                  { label: 'Add to Timeline', onClick: () => addAssetToTimeline(asset.id) },
                  { label: 'Remove from Project', danger: true, onClick: () => removeAssets([asset.id]) },
                ]);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 6,
                background: selectedAssetIds.includes(asset.id) ? 'var(--bg-active)' : 'var(--bg-elevated)',
                cursor: 'grab',
              }}
            >
              <IconMusic size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {asset.name}
                </div>
                <div className="small dim">{formatDuration(asset.duration)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- text --------------------------------- */

function TextTab() {
  return (
    <div style={{ padding: 12 }}>
      <div className="small dim mb8">Click a style to add text at the playhead</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {TEXT_PRESETS.map((preset) => (
          <div
            key={preset.id}
            className="chip"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-capcut-text-preset', preset.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => addTextAt(undefined, preset.patch)}
            style={{ padding: '14px 8px', textAlign: 'center' }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: (preset.patch.color as string) || '#fff',
                textShadow: preset.patch.strokeColor
                  ? `0 0 2px ${preset.patch.strokeColor as string}, 0 0 2px ${preset.patch.strokeColor as string}`
                  : 'none',
                background: (preset.patch.bgColor as string) || 'transparent',
                borderRadius: 4,
                padding: '2px 6px',
                display: 'inline-block',
              }}
            >
              {preset.name}
            </div>
          </div>
        ))}
      </div>
      <div className="small dim mt8">Tip: you can also double-click the preview to add centered text</div>
    </div>
  );
}

/* -------------------------------- stickers -------------------------------- */

function StickerTab() {
  return (
    <div style={{ paddingBottom: 12 }}>
      {EMOJI_GROUPS.map((group) => (
        <div key={group.name}>
          <div className="small dim" style={{ padding: '10px 12px 0' }}>
            {group.name}
          </div>
          <div className="emoji-grid">
            {group.emojis.map((emoji) => (
              <div key={emoji} className="emoji-cell" onClick={() => addStickerAt(emoji)} title="Click to add at playhead">
                {emoji}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- effects --------------------------------- */

function EffectTab() {
  const selectedClipIds = useEditor((s) => s.selectedClipIds);
  const project = useEditor((s) => s.project);
  const addEffect = useEditor((s) => s.addEffect);
  const removeEffect = useEditor((s) => s.removeEffect);
  const showToast = useEditor((s) => s.showToast);

  const appliesTo = selectedClipIds.filter((id) => {
    const c = project.clips.find((x) => x.id === id);
    return c && (c.kind === 'video' || c.kind === 'image' || c.kind === 'text' || c.kind === 'sticker');
  });

  const targetClips = project.clips.filter((c) => appliesTo.includes(c.id));

  return (
    <div style={{ padding: 12 }}>
      <div className="small dim mb8">Click an effect to apply to selected clips</div>
      <div className="effect-grid">
        {EFFECTS.map((effect) => {
          const active = targetClips.length > 0 && targetClips.every((c) => c.effects.some((e) => e.effectId === effect.id));
          return (
            <div
              key={effect.id}
              className={`effect-tile ${active ? 'active' : ''}`}
              onClick={() => {
                if (appliesTo.length === 0) {
                  showToast('Select a clip on the timeline first');
                  return;
                }
                if (active) appliesTo.forEach((id) => removeEffect(id, effect.id));
                else appliesTo.forEach((id) => addEffect(id, effect.id));
              }}
            >
              {effect.name}
            </div>
          );
        })}
      </div>
      <div className="small dim mt8">Adjust effect intensity in the Inspector on the right</div>
    </div>
  );
}

/* ------------------------------- transitions ------------------------------ */

function TransitionTab() {
  const selectedClipIds = useEditor((s) => s.selectedClipIds);
  const project = useEditor((s) => s.project);
  const setTransition = useEditor((s) => s.setTransition);
  const showToast = useEditor((s) => s.showToast);

  const firstClip = project.clips.find((c) => c.id === selectedClipIds[0]);

  return (
    <div style={{ padding: 12 }}>
      <div className="small dim mb8">Select a clip, then click a transition to add it between it and the previous clip</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {TRANSITIONS.map((tr) => {
          const active = firstClip?.transitionIn?.type === tr.id;
          return (
            <div
              key={tr.id}
              className={`transition-tile ${active ? 'active' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-capcut-transition', tr.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => {
                if (!firstClip) {
                  showToast('Select a clip on the timeline first');
                  return;
                }
                if (active) {
                  setTransition(firstClip.id, null);
                  return;
                }
                const prev = project.clips
                  .filter((c) => c.trackId === firstClip.trackId && c.start < firstClip.start)
                  .sort((a, b) => b.start - a.start)[0];
                if (!prev) {
                  showToast('No adjacent clip before this one — cannot add a transition');
                  return;
                }
                const maxDur = Math.min(prev.duration, firstClip.duration) * 0.9;
                const dur = Math.min(0.5, Math.max(0.1, maxDur));
                setTransition(firstClip.id, { type: tr.id, duration: dur });
              }}
            >
              {tr.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- filter --------------------------------- */

function FilterTab() {
  const selectedClipIds = useEditor((s) => s.selectedClipIds);
  const project = useEditor((s) => s.project);
  const updateClips = useEditor((s) => s.updateClips);
  const showToast = useEditor((s) => s.showToast);
  const thumbs = useMediaCache((s) => s.thumbs);

  const targetClips = project.clips.filter(
    (c) => selectedClipIds.includes(c.id) && (c.kind === 'video' || c.kind === 'image')
  );

  const previewSrc = useMemo(() => {
    for (const c of targetClips) {
      const a = project.assets.find((x) => x.id === c.assetId);
      if (a && thumbs[a.path]) return thumbs[a.path];
    }
    const first = project.assets.find((a) => (a.kind === 'video' || a.kind === 'image') && thumbs[a.path]);
    return first ? thumbs[first.path] : null;
  }, [targetClips, project.assets, thumbs]);

  return (
    <div style={{ padding: 12 }}>
      <div className="small dim mb8">Select a clip, then click a filter to apply</div>
      <div className="filter-grid">
        {FILTERS.map((f) => {
          const active = targetClips.length > 0 && targetClips.every((c) => (c.filterId ?? 'none') === f.id);
          return (
            <div
              key={f.id}
              className={`filter-tile ${active ? 'active' : ''}`}
              onClick={() => {
                if (targetClips.length === 0) {
                  showToast('Select a video clip on the timeline first');
                  return;
                }
                updateClips(targetClips.map((c) => c.id), { filterId: f.id === 'none' ? null : f.id });
              }}
            >
              {previewSrc ? (
                <img className="preview" src={previewSrc} alt={f.name} draggable={false} style={{ filter: cssFilter(f.params, 1) }} />
              ) : (
                <div className="preview" style={{ filter: cssFilter(f.params, 1), background: 'linear-gradient(135deg,#7c5cff,#25c2a0 60%,#ffb45c)' }} />
              )}
              <div className="name">{f.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
