import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: P) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export const IconPlay = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);
export const IconPause = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="7" y="5" width="3.6" height="14" rx="1" />
    <rect x="13.4" y="5" width="3.6" height="14" rx="1" />
  </svg>
);
export const IconSkipStart = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M7 5h2v14H7z" />
    <path d="M19 6.5v11L9.5 12z" />
  </svg>
);
export const IconSkipEnd = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M15 5h2v14h-2z" />
    <path d="M5 6.5v11L14.5 12z" />
  </svg>
);
export const IconUndo = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);
export const IconRedo = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </svg>
);
export const IconSplit = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="2.6" />
    <circle cx="6" cy="18" r="2.6" />
    <path d="M8.2 7.6 20 18M8.2 16.4 20 6" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7" />
    <path d="M6.5 7 7.3 19a1.6 1.6 0 0 0 1.6 1.5h6.2A1.6 1.6 0 0 0 16.7 19L17.5 7" />
    <path d="M10 11v5.5M14 11v5.5" />
  </svg>
);
export const IconSnap = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 3v8M18 3v8" />
    <path d="M6 11a6 6 0 0 0 12 0" />
    <path d="M6 11H3.5v3A7.5 7.5 0 0 0 11 21.5h2a7.5 7.5 0 0 0 7.5-7.5v-3H18" />
  </svg>
);
export const IconImport = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);
export const IconExport = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5" />
    <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
  </svg>
);
export const IconMusic = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 18.5V6.2a1 1 0 0 1 .8-1l8-1.6a1 1 0 0 1 1.2 1v11.9" />
    <circle cx="6.6" cy="18.5" r="2.6" />
    <circle cx="16.4" cy="16.5" r="2.6" />
  </svg>
);
export const IconText = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 6V4.5h14V6" />
    <path d="M12 4.5V19.5M9 19.5h6" />
  </svg>
);
export const IconSticker = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3a9 9 0 0 0 0 18c1.2 0 2-.4 2.6-.9l4.6-4.6c.5-.6.8-1.5.8-2.5a9 9 0 0 0-8-9z" />
    <path d="M13.5 20.5c0-3.5 3-5 6.6-5" />
    <path d="M8.5 10h.01M14.5 10h.01" strokeWidth="2.4" />
    <path d="M8.6 14a4.3 4.3 0 0 0 6 0.4" />
  </svg>
);
export const IconEffects = (p: P) => (
  <svg {...base(p)}>
    <path d="M11 4.5 12.4 8.6 16.5 10 12.4 11.4 11 15.5 9.6 11.4 5.5 10 9.6 8.6z" />
    <path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    <path d="M5.5 16.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z" />
  </svg>
);
export const IconTransition = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="8" height="14" rx="1.5" />
    <rect x="13" y="5" width="8" height="14" rx="1.5" strokeDasharray="3 2.5" />
    <path d="M11 12h2" />
  </svg>
);
export const IconFilter = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="9" r="5.5" />
    <circle cx="15" cy="15" r="5.5" />
  </svg>
);
export const IconVolume = (p: P) => (
  <svg {...base(p)}>
    <path d="M11 5.5 6.5 9H3.5v6h3L11 18.5z" />
    <path d="M14.5 9.2a4 4 0 0 1 0 5.6M17 6.8a7.6 7.6 0 0 1 0 10.4" />
  </svg>
);
export const IconVolumeOff = (p: P) => (
  <svg {...base(p)}>
    <path d="M11 5.5 6.5 9H3.5v6h3L11 18.5z" />
    <path d="m15 10 5 4M20 10l-5 4" />
  </svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);
export const IconEyeOff = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4.5 20 19.5" />
    <path d="M9.6 9.7a2.8 2.8 0 0 0 4 3.9" />
    <path d="M6.4 6.8C4 8.5 2.5 12 2.5 12s3.5 6.2 9.5 6.2c1.7 0 3.2-.5 4.4-1.2M9.6 5.9A9.6 9.6 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a15 15 0 0 1-2.1 2.8" />
  </svg>
);
export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <rect x="5.5" y="10.5" width="13" height="9" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
);
export const IconUnlock = (p: P) => (
  <svg {...base(p)}>
    <rect x="5.5" y="10.5" width="13" height="9" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconMinus = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);
export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 3h9A1.5 1.5 0 0 1 15.5 4.5V5" />
  </svg>
);
export const IconLoop = (p: P) => (
  <svg {...base(p)}>
    <path d="M17.5 3.5 20.5 6.5 17.5 9.5" />
    <path d="M20.5 6.5H7a4 4 0 0 0 0 8" />
    <path d="M6.5 20.5 3.5 17.5 6.5 14.5" />
    <path d="M3.5 17.5H17a4 4 0 0 0 0-8" />
  </svg>
);
export const IconVideo = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="12.5" height="12" rx="2" />
    <path d="m15.5 10.5 5-2.8v8.6l-5-2.8" />
  </svg>
);
export const IconImage = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4.5 17 4.5-4 3.5 3 3-2.5 4.5 4" />
  </svg>
);
export const IconMic = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <path d="M12 18v3" />
  </svg>
);
export const IconKeyframe = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4l6 8-6 8-6-8z" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.15-1.5l2-1.55-2-3.4-2.35.95A7 7 0 0 0 14.1 5L13.8 2.5h-3.6L9.9 5a7 7 0 0 0-2.4 1.5l-2.35-.95-2 3.4 2 1.55a7 7 0 0 0 0 3l-2 1.55 2 3.4 2.35-.95A7 7 0 0 0 9.9 19l.3 2.5h3.6l.3-2.5a7 7 0 0 0 2.4-1.5l2.35.95 2-3.4-2-1.55c.1-.5.15-1 .15-1.5z" />
  </svg>
);
export const IconSpeech = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
  </svg>
);
export const IconLayers = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
);
export const IconFolder = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
  </svg>
);
