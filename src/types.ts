export type MediaKind = 'video' | 'audio' | 'image';

export interface MediaAsset {
  id: string;
  path: string;
  url: string;
  name: string;
  kind: MediaKind;
  duration: number;
  width: number;
  height: number;
  fps: number;
  rotation: number;
  hasAudio: boolean;
  offline?: boolean;
  thumbnail?: string;
}

export type TrackType = 'video' | 'overlay' | 'audio';

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
}

export type ClipKind = 'video' | 'image' | 'audio' | 'text' | 'sticker';

export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface ChromaKeyState {
  enabled: boolean;
  color: string;
  similarity: number;
  smoothness: number;
  spill: number;
}

export interface Keyframe {
  time: number;
  value: number;
}

export type KeyframeProperty =
  | 'positionX'
  | 'positionY'
  | 'scale'
  | 'rotation'
  | 'opacity'
  | 'volume';

export type AnimationPreset =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'pop'
  | 'typewriter'
  | 'bounce';

export interface ClipAnimation {
  preset: AnimationPreset;
  duration: number;
}

export type LoopAnimation = 'none' | 'pulse' | 'sway' | 'bounce';

export interface TextClipData {
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffX: number;
  shadowOffY: number;
  bgColor: string;
  bgOpacity: number;
  bgPadding: number;
  animationIn: ClipAnimation | null;
  animationOut: ClipAnimation | null;
  animationLoop: LoopAnimation;
}

export interface StickerClipData {
  emoji: string;
  imagePath?: string;
}

export interface EffectInstance {
  id: string;
  effectId: string;
  intensity: number;
}

export interface Transition {
  type: string;
  duration: number;
}

export interface Clip {
  id: string;
  trackId: string;
  kind: ClipKind;
  assetId?: string;
  start: number;
  duration: number;
  offset: number;
  speed: number;
  volume: number;
  muted: boolean;
  fadeIn: number;
  fadeOut: number;
  opacity: number;
  transform: Transform;
  filterId: string | null;
  filterIntensity: number;
  effects: EffectInstance[];
  chromaKey: ChromaKeyState;
  keyframes: Partial<Record<KeyframeProperty, Keyframe[]>>;
  transitionIn: Transition | null;
  text?: TextClipData;
  sticker?: StickerClipData;
}

export interface ProjectSettings {
  name: string;
  aspect: string;
  width: number;
  height: number;
  fps: number;
  background: string;
}

export interface Project {
  settings: ProjectSettings;
  assets: MediaAsset[];
  tracks: Track[];
  clips: Clip[];
}

export interface ExportPreset {
  resolution: string;
  width: number;
  height: number;
  fps: number;
  codec: 'h264' | 'hevc';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  audioBitrate: number;
  includeAudio: boolean;
}

export interface ExportProgress {
  id: string;
  progress?: number;
  time?: number;
  speed?: string;
  log?: string;
  done?: boolean;
}
