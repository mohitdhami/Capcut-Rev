export interface FilterParams {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  sepia?: number;
  grayscale?: number;
  temp?: number;
}

export interface FilterPreset {
  id: string;
  name: string;
  params: FilterParams;
}

export const FILTERS: FilterPreset[] = [
  { id: 'none', name: 'Original', params: {} },
  { id: 'vivid', name: 'Vivid', params: { saturation: 1.35, contrast: 1.08 } },
  { id: 'clear', name: 'Clear', params: { contrast: 1.12, saturation: 1.06, brightness: 1.03 } },
  { id: 'bw', name: 'B&W', params: { grayscale: 1 } },
  { id: 'retro', name: 'Retro', params: { sepia: 0.45, contrast: 1.05, saturation: 0.85, temp: 0.15 } },
  { id: 'film', name: 'Film', params: { contrast: 1.1, saturation: 0.9, temp: -0.08, brightness: 0.98 } },
  { id: 'cool', name: 'Cool Tone', params: { temp: -0.35, saturation: 1.08 } },
  { id: 'warm', name: 'Warm Tone', params: { temp: 0.35, saturation: 1.08 } },
  { id: 'japan', name: 'Japanese', params: { brightness: 1.08, contrast: 0.92, saturation: 0.95, temp: 0.08 } },
  { id: 'hongkong', name: 'Hong Kong', params: { contrast: 1.16, temp: 0.2, saturation: 1.08, brightness: 0.98 } },
  { id: 'cinematic', name: 'Cinematic', params: { contrast: 1.18, saturation: 0.92, temp: -0.14, brightness: 0.96 } },
  { id: 'cyber', name: 'Cyberpunk', params: { hue: 315, saturation: 1.3, contrast: 1.15 } },
  { id: 'faded', name: 'Faded', params: { contrast: 0.85, saturation: 0.78, brightness: 1.05 } },
  { id: 'bright', name: 'Bright', params: { brightness: 1.15, saturation: 1.05 } },
  { id: 'dark', name: 'Noir', params: { brightness: 0.85, contrast: 1.18 } },
  { id: 'sunset', name: 'Sunset', params: { sepia: 0.25, temp: 0.4, saturation: 1.12 } },
  { id: 'tealorange', name: 'Teal & Orange', params: { hue: 330, saturation: 1.18, contrast: 1.1, temp: -0.06 } },
];

export interface EffectPreset {
  id: string;
  name: string;
  defaultIntensity: number;
  exportable: boolean;
}

export const EFFECTS: EffectPreset[] = [
  { id: 'shake', name: 'Shake', defaultIntensity: 50, exportable: true },
  { id: 'pulse', name: 'Pulse', defaultIntensity: 50, exportable: true },
  { id: 'flash', name: 'Flash', defaultIntensity: 60, exportable: false },
  { id: 'glitch', name: 'Glitch', defaultIntensity: 50, exportable: true },
  { id: 'zoom-slow', name: 'Zoom', defaultIntensity: 40, exportable: true },
  { id: 'sway', name: 'Sway', defaultIntensity: 40, exportable: true },
  { id: 'heartbeat', name: 'Heartbeat', defaultIntensity: 50, exportable: false },
  { id: 'bw-flash', name: 'B&W Flash', defaultIntensity: 50, exportable: false },
];

export interface TransitionPreset {
  id: string;
  name: string;
}

export const TRANSITIONS: TransitionPreset[] = [
  { id: 'dissolve', name: 'Dissolve' },
  { id: 'fade-black', name: 'Fade to Black' },
  { id: 'slide-left', name: 'Slide Left' },
  { id: 'slide-right', name: 'Slide Right' },
  { id: 'slide-up', name: 'Slide Up' },
  { id: 'slide-down', name: 'Slide Down' },
  { id: 'zoom-in', name: 'Zoom In' },
  { id: 'zoom-out', name: 'Zoom Out' },
];

export const ANIMATIONS_IN = [
  { id: 'none', name: 'None' },
  { id: 'fade', name: 'Fade In' },
  { id: 'slide-up', name: 'Slide Up' },
  { id: 'slide-down', name: 'Slide Down' },
  { id: 'slide-left', name: 'Slide Left' },
  { id: 'slide-right', name: 'Slide Right' },
  { id: 'zoom-in', name: 'Zoom In' },
  { id: 'zoom-out', name: 'Zoom Out' },
  { id: 'pop', name: 'Pop In' },
  { id: 'bounce', name: 'Bounce' },
  { id: 'typewriter', name: 'Typewriter' },
] as const;

export const ANIMATIONS_OUT = [
  { id: 'none', name: 'None' },
  { id: 'fade', name: 'Fade Out' },
  { id: 'slide-up', name: 'Slide Up' },
  { id: 'slide-down', name: 'Slide Down' },
  { id: 'slide-left', name: 'Slide Left' },
  { id: 'slide-right', name: 'Slide Right' },
  { id: 'zoom-in', name: 'Zoom In' },
  { id: 'zoom-out', name: 'Zoom Out' },
  { id: 'pop', name: 'Pop Out' },
] as const;

export const LOOPS = [
  { id: 'none', name: 'None' },
  { id: 'pulse', name: 'Pulse' },
  { id: 'sway', name: 'Sway' },
  { id: 'bounce', name: 'Bounce' },
] as const;

export const FONT_FAMILIES = [
  'Helvetica Neue',
  'Arial',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Impact',
  'Comic Sans MS',
  'Trebuchet MS',
  'Futura',
  'Palatino',
  'Baskerville',
  'Snell Roundhand',
];

export interface TextPreset {
  id: string;
  name: string;
  patch: Record<string, unknown>;
}

export const TEXT_PRESETS: TextPreset[] = [
  { id: 'default', name: 'Default', patch: {} },
  { id: 'title', name: 'Title', patch: { fontSize: 96, bold: true, color: '#ffffff', shadowColor: 'rgba(0,0,0,0.6)', shadowBlur: 8, shadowOffY: 4 } },
  { id: 'subtitle', name: 'Subtitle', patch: { fontSize: 48, color: '#ffffff', strokeColor: '#000000', strokeWidth: 3, bold: false } },
  { id: 'black-box', name: 'Black Box', patch: { color: '#ffffff', bgColor: '#000000', bgOpacity: 1, bgPadding: 14, bold: true } },
  { id: 'white-box', name: 'White Box', patch: { color: '#111111', bgColor: '#ffffff', bgOpacity: 1, bgPadding: 14, bold: true } },
  { id: 'red', name: 'Red Outline', patch: { color: '#ff3b30', strokeColor: '#ffffff', strokeWidth: 4, bold: true, fontSize: 80 } },
  { id: 'yellow', name: 'Yellow Outline', patch: { color: '#ffd60a', strokeColor: '#000000', strokeWidth: 5, bold: true, fontSize: 80 } },
  { id: 'neon', name: 'Neon', patch: { color: '#00e5ff', strokeColor: '#00404d', strokeWidth: 3, shadowColor: 'rgba(0,229,255,0.9)', shadowBlur: 18, bold: true } },
];

export const ASPECTS = [
  { id: '16:9', name: '16:9', width: 1920, height: 1080 },
  { id: '9:16', name: '9:16', width: 1080, height: 1920 },
  { id: '1:1', name: '1:1', width: 1080, height: 1080 },
  { id: '4:3', name: '4:3', width: 1440, height: 1080 },
  { id: '3:4', name: '3:4', width: 1080, height: 1440 },
  { id: '21:9', name: '21:9', width: 2560, height: 1080 },
  { id: '2.35:1', name: '2.35:1', width: 2540, height: 1080 },
];

export const SPEED_PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export const EXPORT_RESOLUTIONS = [
  { id: '480p', name: '480P', short: 480 },
  { id: '720p', name: '720P', short: 720 },
  { id: '1080p', name: '1080P', short: 1080 },
  { id: '2k', name: '2K', short: 1440 },
  { id: '4k', name: '4K', short: 2160 },
];

export const EXPORT_QUALITY_CRF: Record<string, number> = {
  low: 30,
  medium: 26,
  high: 22,
  ultra: 17,
};

export const EXPORT_FPS = [24, 25, 30, 50, 60];
export const EXPORT_AUDIO_BITRATES = [128, 192, 320];

export const EMOJI_GROUPS: { name: string; emojis: string[] }[] = [
  {
    name: 'Smileys',
    emojis: ['😀', '😄', '😁', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤩', '🥳', '😏', '😢', '😭', '😡', '🥺', '😱', '🤔', '😴', '🤯', '😇', '🙃', '😉', '🤗'],
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙏', '💪', '✌️', '🤝', '👋', '🤞', '🫶', '☝️', '✊', '👌', '🤙', '🖐️', '👊'],
  },
  {
    name: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💗', '💓', '💞', '💝', '💔', '❣️', '💕'],
  },
  {
    name: 'Symbols',
    emojis: ['✨', '🔥', '⭐', '🌟', '💫', '⚡', '💥', '🎉', '🎊', '🎈', '🎁', '🏆', '👑', '💰', '📌', '✅', '❌', '❗', '❓', '💡', '💯', '🔔', '📢', '🚀'],
  },
  {
    name: 'Nature',
    emojis: ['🌈', '☀️', '🌙', '☁️', '💧', '❄️', '🍀', '🌸', '🌹', '🌻', '🌴', '🌵', '🍁', '🐶', '🐱', '🦄', '🐼', '🦋'],
  },
  {
    name: 'Life',
    emojis: ['🎵', '🎶', '🎬', '📷', '📱', '💻', '🎮', '⚽', '🏀', '🏈', '🎾', '🍕', '🍔', '🍰', '🍺', '☕', '🏠', '✈️', '🚗', '🚀', '🎓', '📚', '🛒', '💊'],
  },
];

export const MIN_ZOOM = 4;
export const MAX_ZOOM = 600;
export const DEFAULT_ZOOM = 50;
export const TRACK_HEIGHTS: Record<string, number> = { video: 64, overlay: 60, audio: 56 };
export const TIMELINE_HEADER_WIDTH = 132;
