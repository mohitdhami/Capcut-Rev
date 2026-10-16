import type { Clip, ExportPreset, Keyframe, Project } from '../types';
import { EFFECTS, EXPORT_QUALITY_CRF, FILTERS, TRANSITIONS } from '../constants';
import { clipEnd, projectDuration, resolveClipValue } from '../store/editor';
import { clamp } from '../utils/time';

export interface BuildResult {
  args: string[];
  duration: number;
  unsupported: string[];
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

function escapeQuoted(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function ffColor(hex: string, alpha?: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '#000000');
  const base = m ? `0x${m[1]}` : '0x000000';
  if (alpha !== undefined && alpha < 1) return `${base}@${alpha.toFixed(3)}`;
  return base;
}

function keyframeExpr(kfs: Keyframe[] | undefined, clipStart: number, base: number): string {
  if (!kfs || kfs.length === 0) return base.toFixed(3);
  const lt = `(t-${clipStart.toFixed(3)})`;
  let expr = kfs[kfs.length - 1].value.toFixed(3);
  for (let i = kfs.length - 1; i > 0; i--) {
    const a = kfs[i - 1];
    const b = kfs[i];
    const span = Math.max(0.001, b.time - a.time);
    const seg = `(${a.value.toFixed(3)}+(${(b.value - a.value).toFixed(3)})*(${lt}-${a.time.toFixed(3)})/${span.toFixed(3)})`;
    expr = `if(lt(${lt},${b.time.toFixed(3)}),${seg},${expr})`;
  }
  return `if(lte(${lt},${kfs[0].time.toFixed(3)}),${kfs[0].value.toFixed(3)},${expr})`;
}

function atempoChain(speed: number): string[] {
  if (Math.abs(speed - 1) < 0.01) return [];
  const out: string[] = [];
  let v = speed;
  while (v > 2.001) {
    out.push('atempo=2');
    v /= 2;
  }
  while (v < 0.499) {
    out.push('atempo=0.5');
    v *= 2;
  }
  out.push(`atempo=${v.toFixed(4)}`);
  return out;
}

function colorSteps(clip: Clip): string[] {
  const preset = FILTERS.find((f) => f.id === (clip.filterId ?? 'none'));
  const params = preset?.params ?? {};
  const t = clamp((clip.filterIntensity ?? 100) / 100, 0, 1);
  const steps: string[] = [];
  const brightness = ((params.brightness ?? 1) - 1) * t;
  const contrast = 1 + (((params.contrast ?? 1) - 1) * t);
  const saturation = 1 + (((params.saturation ?? 1) - 1) * t);
  if (Math.abs(brightness) > 0.002 || Math.abs(contrast - 1) > 0.002 || Math.abs(saturation - 1) > 0.002) {
    steps.push(`eq=brightness=${brightness.toFixed(4)}:contrast=${contrast.toFixed(4)}:saturation=${saturation.toFixed(4)}`);
  }
  if (params.hue) steps.push(`hue=h=${(params.hue * t).toFixed(2)}`);
  if (params.sepia) {
    const s = params.sepia * t;
    steps.push(
      `colorchannelmixer=${(1 - 0.607 * s).toFixed(3)}:${(0.769 * s).toFixed(3)}:${(0.189 * s).toFixed(3)}:0:${(0.349 * s).toFixed(3)}:${(1 - 0.314 * s).toFixed(3)}:${(0.168 * s).toFixed(3)}:0:${(0.272 * s).toFixed(3)}:${(0.534 * s).toFixed(3)}:${(1 - 0.869 * s).toFixed(3)}`
    );
  }
  if (params.grayscale) steps.push(`hue=s=${(1 - params.grayscale * t).toFixed(3)}`);
  if (params.temp) {
    const temp = params.temp * t;
    if (temp > 0) {
      steps.push(`colorbalance=rs=${(0.12 * temp).toFixed(3)}:gs=${(0.03 * temp).toFixed(3)}:bs=${(-0.12 * temp).toFixed(3)}`);
    } else {
      steps.push(`colorbalance=rs=${(0.12 * temp).toFixed(3)}:bs=${(-0.12 * temp).toFixed(3)}`);
    }
  }
  return steps;
}

export async function renderStickerToTemp(emoji: string): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    ctx.font = `${Math.floor(size * 0.8)}px "Apple Color Emoji"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size * 0.54);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    return await window.api.writeTempFile('sticker.png', base64);
  } catch {
    return null;
  }
}

const SLIDE: Record<string, { axis: 'x' | 'y'; sign: number }> = {
  'slide-left': { axis: 'x', sign: 1 },
  'slide-right': { axis: 'x', sign: -1 },
  'slide-up': { axis: 'y', sign: 1 },
  'slide-down': { axis: 'y', sign: -1 },
};

interface Piece {
  clip: Clip;
  trackIdx: number;
  kind: 'media' | 'text';
  inputIdx: number;
  hasAudio: boolean;
  trackHidden: boolean;
  trackMuted: boolean;
}

export async function buildExportArgs(
  project: Project,
  preset: ExportPreset,
  fonts: Record<string, string>,
  outputPath: string
): Promise<BuildResult> {
  const W = preset.width;
  const H = preset.height;
  const FPS = preset.fps;
  const duration = Math.max(0.1, projectDuration(project));
  const unsupported = new Set<string>();

  const inputs: string[][] = [];
  inputs.push(['-f', 'lavfi', '-i', `color=c=${(project.settings.background || '#000000').replace('#', '0x')}:s=${W}x${H}:r=${FPS}:d=${(duration + 1).toFixed(3)}`]);

  const trackIdxById = new Map(project.tracks.map((t, i) => [t.id, i]));
  const trackById = new Map(project.tracks.map((t) => [t.id, t]));

  const pieces: Piece[] = [];

  const ordered = [...project.clips].sort((a, b) => {
    const ta = trackIdxById.get(a.trackId) ?? 0;
    const tb = trackIdxById.get(b.trackId) ?? 0;
    if (ta !== tb) return ta - tb;
    return a.start - b.start;
  });

  for (const clip of ordered) {
    const track = trackById.get(clip.trackId);
    if (!track) continue;
    const trackIdx = trackIdxById.get(clip.trackId) ?? 0;

    if (clip.kind === 'text') {
      if (!track.hidden) {
        pieces.push({ clip, trackIdx, kind: 'text', inputIdx: -1, hasAudio: false, trackHidden: track.hidden, trackMuted: track.muted });
      }
      continue;
    }

    if (clip.kind === 'sticker') {
      const stickerPath = clip.sticker?.imagePath ?? (clip.sticker?.emoji ? await renderStickerToTemp(clip.sticker.emoji) : null);
      if (!stickerPath || track.hidden) continue;
      inputs.push(['-loop', '1', '-framerate', String(FPS), '-i', stickerPath]);
      pieces.push({ clip, trackIdx, kind: 'media', inputIdx: inputs.length - 1, hasAudio: false, trackHidden: track.hidden, trackMuted: track.muted });
      continue;
    }

    const asset = project.assets.find((a) => a.id === clip.assetId);
    if (!asset || asset.offline) continue;
    if (asset.kind === 'image') {
      inputs.push(['-loop', '1', '-framerate', String(FPS), '-i', asset.path]);
      pieces.push({
        clip, trackIdx, kind: 'media', inputIdx: inputs.length - 1,
        hasAudio: false, trackHidden: track.hidden, trackMuted: track.muted,
      });
    } else {
      inputs.push(['-i', asset.path]);
      pieces.push({
        clip, trackIdx, kind: 'media', inputIdx: inputs.length - 1,
        hasAudio: !!asset.hasAudio, trackHidden: track.hidden, trackMuted: track.muted,
      });
    }
  }

  const clipsByTrack = new Map<string, Clip[]>();
  for (const t of project.tracks) clipsByTrack.set(t.id, []);
  for (const c of project.clips) {
    if (c.kind === 'text' || c.kind === 'sticker') continue;
    clipsByTrack.get(c.trackId)?.push(c);
  }
  for (const [, arr] of clipsByTrack) arr.sort((a, b) => a.start - b.start);
  const nextByClipId = new Map<string, Clip | null>();
  for (const [, arr] of clipsByTrack) {
    arr.forEach((c, i) => nextByClipId.set(c.id, i < arr.length - 1 ? arr[i + 1] : null));
  }

  const filterParts: string[] = [];
  const audioLabels: string[] = [];
  let baseLabel = '0:v';
  let n = 0;

  const fontPath = (family: string): string =>
    fonts[family] || fonts['Helvetica Neue'] || fonts['Helvetica'] || '/System/Library/Fonts/Helvetica.ttc';

  const sortedPieces = [...pieces].sort((a, b) => {
    if (a.trackIdx !== b.trackIdx) return a.trackIdx - b.trackIdx;
    return a.clip.start - b.clip.start;
  });

  for (const piece of sortedPieces) {
    const clip = piece.clip;

    if (piece.kind === 'text') {
      const text = clip.text;
      if (!text || !text.content.trim()) continue;
      const label = `v${n++}`;
      const ts = clip.start.toFixed(3);
      const te = clipEnd(clip).toFixed(3);
      const din = text.animationIn && text.animationIn.preset !== 'none' ? text.animationIn.duration : 0;
      const dout = text.animationOut && text.animationOut.preset !== 'none' ? text.animationOut.duration : 0;
      if (text.animationIn?.preset === 'typewriter') unsupported.add('Typewriter animation (exported as fade)');
      if (text.animationIn?.preset === 'pop' || text.animationIn?.preset === 'bounce' || text.animationIn?.preset === 'zoom-in' || text.animationIn?.preset === 'zoom-out') {
        unsupported.add('Zoom-style text intro (exported as fade)');
      }
      const fontsize = Math.max(8, Math.round(text.fontSize * (H / 1080) * resolveClipValue(clip, 'scale', 0)));
      const py = `(${clip.transform.y}/100*h)`;
      const slideOffset = 60 * (H / 1080);
      let yExpr = `(h-text_h)/2+${py}`;
      const inPreset = text.animationIn?.preset;
      if (inPreset === 'slide-up') yExpr = `((h-text_h)/2+${py}+if(lt(t-${ts},${din.toFixed(3)}),(1-(t-${ts})/${din.toFixed(3)})*${slideOffset.toFixed(1)},0))`;
      else if (inPreset === 'slide-down') yExpr = `((h-text_h)/2+${py}-if(lt(t-${ts},${din.toFixed(3)}),(1-(t-${ts})/${din.toFixed(3)})*${slideOffset.toFixed(1)},0))`;
      if (text.animationLoop === 'sway') yExpr = `(${yExpr}+sin(t*3.8)*${((6 * H) / 1080).toFixed(1)})`;
      else if (text.animationLoop === 'bounce') yExpr = `(${yExpr}-abs(sin(t*5.0))*${((10 * H) / 1080).toFixed(1)})`;

      let a = '1';
      if (dout > 0) a = `if(gt(t,${(clipEnd(clip) - dout).toFixed(3)}),(${te}-t)/${dout.toFixed(3)},${a})`;
      if (din > 0) a = `if(lt(t-${ts},${din.toFixed(3)}),(t-${ts})/${din.toFixed(3)},${a})`;
      a = `if(lt(t,${ts}),0,${a})`;
      const alphaExpr = `min(1,max(0,${a}))`;

      const opts: string[] = [
        `fontfile='${escapeQuoted(fontPath(text.fontFamily))}'`,
        `text='${escapeQuoted(text.content)}'`,
        'expansion=none',
        `fontsize=${fontsize}`,
        `fontcolor=${ffColor(text.color)}`,
        `x='(w-text_w)/2+(${clip.transform.x}/100*w)'`,
        `y='${escapeQuoted(yExpr)}'`,
        `alpha='${escapeQuoted(alphaExpr)}'`,
        `enable='between(t,${ts},${te})'`,
      ];
      if (text.bgOpacity > 0) {
        opts.push('box=1', `boxcolor=${ffColor(text.bgColor, clamp(text.bgOpacity, 0, 1))}`, `boxborderw=${Math.round(text.bgPadding * (H / 1080))}`);
      }
      if (text.strokeWidth > 0) {
        opts.push(`borderw=${Math.round(text.strokeWidth * (H / 1080) * 2)}`, `bordercolor=${ffColor(text.strokeColor)}`);
      }
      if (text.shadowBlur > 0 || text.shadowOffX || text.shadowOffY) {
        opts.push(
          `shadowcolor=${ffColor(text.shadowColor.startsWith('#') ? text.shadowColor : '#000000')}`,
          `shadowx=${Math.round(text.shadowOffX * (H / 1080))}`,
          `shadowy=${Math.round(text.shadowOffY * (H / 1080))}`
        );
      }
      filterParts.push(`[${baseLabel}]drawtext=${opts.join(':')}[${label}]`);
      baseLabel = label;
      continue;
    }

    const asset = clip.assetId ? project.assets.find((a) => a.id === clip.assetId) : undefined;
    const next = nextByClipId.get(clip.id) ?? null;
    const extendedBy = next && next.transitionIn && Math.abs(next.start - clipEnd(clip)) < 0.35 ? next.transitionIn.duration : 0;

    const nativeW = asset?.width || W;
    const nativeH = asset?.height || H;

    if (!piece.trackHidden && clip.kind !== 'audio') {
      const label = `s${n++}`;
      const steps: string[] = [];
      const startScale = resolveClipValue(clip, 'scale', 0);
      const zoomSlow = clip.effects.find((e) => e.effectId === 'zoom-slow');
      const scaleMul = startScale * (zoomSlow ? 1 + 0.035 * (zoomSlow.intensity / 100) : 1);
      const isSticker = clip.kind === 'sticker';
      const baseFitW = isSticker ? H * 0.2 : nativeW * Math.min(W / nativeW, H / nativeH);
      const baseFitH = isSticker ? H * 0.2 : nativeH * Math.min(W / nativeW, H / nativeH);

      if (asset && asset.kind === 'video') {
        const consumed = clip.duration * clip.speed;
        const available = Math.max(0, (asset.duration || 0) - clip.offset);
        const consumedSource = Math.min(available, (clip.duration + extendedBy) * clip.speed);
        const neededStream = clip.duration + extendedBy;
        const availableStream = consumedSource / Math.max(0.01, clip.speed);
        const deficit = Math.max(0, neededStream - availableStream);
        steps.push(`trim=start=${clip.offset.toFixed(3)}:duration=${Math.max(0.04, consumedSource).toFixed(3)}`);
        steps.push('setpts=PTS-STARTPTS');
        if (Math.abs(clip.speed - 1) > 0.01) steps.push(`setpts=PTS/${clip.speed.toFixed(4)}`);
        if (deficit > 0.01) steps.push(`tpad=stop_mode=clone:stop_duration=${deficit.toFixed(3)}`);
        void consumed;
      } else {
        steps.push(`trim=duration=${(clip.duration + extendedBy).toFixed(3)},setpts=PTS-STARTPTS`);
      }

      steps.push(`scale=${even(baseFitW * scaleMul)}:${even(baseFitH * scaleMul)}:flags=bicubic`, 'setsar=1');

      if (asset && asset.kind === 'audio') {
        /* pure audio has no picture: skip video chain */
      } else {
        const swayEffect = clip.effects.find((e) => e.effectId === 'sway');
        const needsAlpha =
          !!clip.transitionIn ||
          clip.transform.rotation !== 0 ||
          (clip.keyframes.rotation?.length ?? 0) > 0 ||
          clip.chromaKey.enabled ||
          clip.opacity < 0.999 ||
          !!swayEffect;
        if (needsAlpha) steps.push('format=rgba');
        if (clip.chromaKey.enabled) {
          steps.push(
            `colorkey=${ffColor(clip.chromaKey.color)}:${((clip.chromaKey.similarity / 100) * 0.6).toFixed(3)}:${((clip.chromaKey.smoothness / 100) * 0.4).toFixed(3)}`
          );
        }
        steps.push(...colorSteps(clip));
        if (clip.opacity < 0.999) steps.push(`colorchannelmixer=aa=${clip.opacity.toFixed(3)}`);

        const win = clip.transitionIn;
        if (win && win.duration > 0) {
          if (!SLIDE[win.type]) {
            steps.push(`fade=t=in:st=0:d=${win.duration.toFixed(3)}:alpha=1`);
            if (win.type === 'zoom-in' || win.type === 'zoom-out') {
              unsupported.add(`Transition "${TRANSITIONS.find((tr) => tr.id === win.type)?.name ?? win.type}" (exported as dissolve)`);
            }
          }
        }

        steps.push(`setpts=PTS+${clip.start.toFixed(3)}/TB`);

        const rotKf = clip.keyframes.rotation;
        let rotExpr = keyframeExpr(rotKf, clip.start, clip.transform.rotation || 0);
        if (swayEffect) {
          rotExpr = `(${rotExpr}+${(3 * (swayEffect.intensity / 100)).toFixed(3)}*sin(2.513*(t-${clip.start.toFixed(3)})))`;
        }
        if ((clip.transform.rotation || 0) !== 0 || (rotKf?.length ?? 0) > 0 || swayEffect) {
          steps.push(`rotate=angle='(${rotExpr})*PI/180':ow=rotw(iw):oh=roth(ih):c=none`);
        }

        filterParts.push(`[${piece.inputIdx}:v]${steps.join(',')}[${label}]`);

        let xExpr = keyframeExpr(clip.keyframes.positionX, clip.start, clip.transform.x);
        let yExpr = keyframeExpr(clip.keyframes.positionY, clip.start, clip.transform.y);
        for (const effect of clip.effects) {
          const amt = effect.intensity / 100;
          const lt = `(t-${clip.start.toFixed(3)})`;
          if (effect.effectId === 'shake') {
            xExpr = `(${xExpr}+sin(47.3*${lt})*${(14 * amt * (H / 1080)).toFixed(2)})`;
            yExpr = `(${yExpr}+cos(53.1*${lt})*${(14 * amt * (H / 1080)).toFixed(2)})`;
          } else if (effect.effectId === 'glitch') {
            xExpr = `(${xExpr}+if(lt(mod(${lt},0.5),0.12),sin(311.7*floor(${lt}/0.18))*${(20 * amt * (H / 1080)).toFixed(2)},0))`;
          } else if (!EFFECTS.find((e) => e.id === effect.effectId)?.exportable) {
            unsupported.add(`Effect "${EFFECTS.find((e) => e.id === effect.effectId)?.name ?? effect.effectId}"`);
          }
        }
        if (win && win.duration > 0 && SLIDE[win.type]) {
          const s = SLIDE[win.type];
          const offset = `(1-min(1,max(0,(t-${clip.start.toFixed(3)})/${win.duration.toFixed(3)})))*${(s.axis === 'x' ? W : H) * s.sign}`;
          if (s.axis === 'x') xExpr = `(${xExpr}+${offset})`;
          else yExpr = `(${yExpr}+${offset})`;
        }

        const xFull = `(main_w-overlay_w)/2+(${xExpr})/100*main_w`;
        const yFull = `(main_h-overlay_h)/2+(${yExpr})/100*main_h`;
        const outLabel = `o${n++}`;
        filterParts.push(
          `[${baseLabel}][${label}]overlay=x='${escapeQuoted(xFull)}':y='${escapeQuoted(yFull)}':enable='between(t,${clip.start.toFixed(3)},${(clipEnd(clip) + extendedBy).toFixed(3)})'[${outLabel}]`
        );
        baseLabel = outLabel;
      }
    }

    /* audio chain for video/audio clips */
    if (piece.hasAudio && (clip.kind === 'video' || clip.kind === 'audio')) {
      const label = `a${n++}`;
      const steps: string[] = [];
      const consumed = clip.duration * clip.speed;
      const available = asset ? Math.max(0, (asset.duration || 0) - clip.offset) : consumed;
      const useDur = Math.min(consumed, available);
      steps.push(`atrim=start=${clip.offset.toFixed(3)}:duration=${Math.max(0.04, useDur).toFixed(3)}`);
      steps.push('asetpts=PTS-STARTPTS');
      steps.push(...atempoChain(clip.speed));
      const gain = clamp(clip.muted || piece.trackMuted ? 0 : clip.volume, 0, 4);
      if (Math.abs(gain - 1) > 0.005) steps.push(`volume=${gain.toFixed(3)}`);
      if (clip.fadeIn > 0) steps.push(`afade=t=in:st=0:d=${Math.min(clip.fadeIn, clip.duration).toFixed(3)}`);
      if (clip.fadeOut > 0) {
        const st = Math.max(0, clip.duration - clip.fadeOut);
        steps.push(`afade=t=out:st=${st.toFixed(3)}:d=${Math.min(clip.fadeOut, clip.duration).toFixed(3)}`);
      }
      const delayMs = Math.round(clip.start * 1000);
      steps.push(`adelay=${delayMs}|${delayMs}`);
      filterParts.push(`[${piece.inputIdx}:a]${steps.join(',')}[${label}]`);
      audioLabels.push(`[${label}]`);
    }
  }

  let composedGraph = filterParts.join(';');
  let silenceInputIdx = -1;
  if (preset.includeAudio) {
    if (audioLabels.length > 0) {
      const mix = `${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=longest:normalize=0[aout]`;
      composedGraph = composedGraph ? `${composedGraph};${mix}` : mix;
    } else {
      silenceInputIdx = inputs.length;
      inputs.push(['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']);
    }
  }

  const finalArgs: string[] = ['-y', ...inputs.flat()];
  if (composedGraph) finalArgs.push('-filter_complex', composedGraph);
  finalArgs.push('-map', `[${baseLabel}]`);
  if (preset.includeAudio) {
    finalArgs.push('-map', audioLabels.length > 0 ? '[aout]' : `${silenceInputIdx}:a`);
  }

  const crf = EXPORT_QUALITY_CRF[preset.quality] ?? 22;
  finalArgs.push(
    '-c:v', preset.codec === 'hevc' ? 'libx265' : 'libx264',
    '-preset', 'medium',
    '-crf', String(crf),
    ...(preset.codec === 'hevc' ? ['-tag:v', 'hvc1'] : []),
    '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    '-t', duration.toFixed(3)
  );
  if (preset.includeAudio) finalArgs.push('-c:a', 'aac', '-b:a', `${preset.audioBitrate}k`);
  else finalArgs.push('-an');
  finalArgs.push('-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', outputPath);

  return { args: finalArgs, duration, unsupported: [...unsupported] };
}
