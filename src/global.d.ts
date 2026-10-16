export {};

declare global {
  interface MediaProbeResult {
    path: string;
    name: string;
    url: string;
    kind: 'video' | 'audio' | 'image';
    duration: number;
    width: number;
    height: number;
    fps: number;
    rotation: number;
    hasAudio: boolean;
    videoCodec: string | null;
    audioCodec: string | null;
    sampleRate: number;
    size: number;
  }

  interface Window {
    api: {
      selectMedia: () => Promise<MediaProbeResult[]>;
      probeFile: (path: string) => Promise<MediaProbeResult | null>;
      mediaUrl: (path: string) => Promise<string>;
      saveProject: (json: string) => Promise<string | null>;
      saveProjectToPath: (filePath: string, json: string) => Promise<string>;
      openProject: () => Promise<{ filePath: string; json: string } | null>;
      chooseExportPath: (name: string) => Promise<string | null>;
      startExport: (job: { id: string; args: string[]; duration: number }) => Promise<{ ok: boolean; error?: string; log?: string; canceled?: boolean }>;
      cancelExport: (id: string) => void;
      onExportProgress: (cb: (data: { id: string; progress?: number; time?: number; speed?: string; log?: string; done?: boolean }) => void) => () => void;
      writeTempFile: (name: string, dataBase64: string) => Promise<string>;
      revealInFolder: (path: string) => Promise<void>;
      getFonts: () => Promise<Record<string, string>>;
      getPaths: () => Promise<{ ffmpeg: string; ffprobe: string; tmp: string }>;
      openExternal: (url: string) => Promise<void>;
      onMenuAction: (cb: (action: string) => void) => () => void;
      getPathForFile: (file: File) => string;
      platform: string;
    };
  }
}
