# CapCut Rev

A CapCut-style video editor for the desktop, built with Electron, React, and FFmpeg.

![Electron](https://img.shields.io/badge/Electron-33-47848F) ![React](https://img.shields.io/badge/React-18-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6) ![Vite](https://img.shields.io/badge/Vite-5-646CFF)

## Features

**Core Editing**
- Import video, audio, and image files (⌘I)
- Multi-track timeline with add/remove tracks
- Drag to move, edge handles to trim, ripple delete
- Split at playhead (⌘B), copy/cut/paste/duplicate (⌘C/⌘X/⌘V/⌘D)
- Magnetic snapping, timeline zoom (⌘+/⌘−)
- Full undo/redo history (⌘Z / ⇧⌘Z)
- Project save/open/new (⌘S / ⇧⌘S / ⌘O / ⌘N) with autosave

**Text & Stickers**
- Rich text clips: font family, size, color, bold/italic, alignment, letter/line spacing
- Stroke, shadow, and background styling
- Style presets and in/out/loop animations
- Sticker & emoji library

**Effects & Filters**
- Filter presets with adjustable intensity
- Stackable effects with per-effect intensity
- Chroma key (similarity, smoothness, spill suppression)
- Keyframes for position, scale, rotation, opacity, and volume
- Transitions between adjacent clips

**Audio**
- Volume, fade in/out, mute per clip
- Waveform display on audio clips
- Audio/video speed presets with pitch-corrected tempo
- Detach audio from video (⌘-click context menu)

**Export**
- Resolution presets (16:9, 9:16, 1:1, and more), fps, H.264/H.265
- Quality tiers (low → ultra) and audio mode selection
- Real-time progress with encoding speed, cancellable
- Reveal output in Finder when done

## Getting Started

```bash
npm install
npm start        # build + launch
```

For development with hot reload:

```bash
npm run dev
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server + Electron with hot reload |
| `npm run build` | Build renderer bundle to `dist/` |
| `npm start` | Build and launch the app |
| `npm run typecheck` | TypeScript type check (`tsc --noEmit`) |

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play / pause |
| `⌘B` | Split clips at playhead |
| `⌘C` / `⌘X` / `⌘V` | Copy / cut / paste clips |
| `⌘D` | Duplicate selection |
| `⌘Z` / `⇧⌘Z` | Undo / redo |
| `⌘I` | Import media |
| `⌘E` | Open export dialog |
| `⌘S` / `⇧⌘S` | Save / save as |
| `⌘O` / `⌘N` | Open project / new project |
| `⌘+` / `⌘−` | Zoom timeline in / out |
| `Delete` | Delete selection |
| `←` / `→` | Step one frame (`⇧` for one second) |
| `Home` / `End` | Jump to start / end |
| `Esc` | Close dialog / clear selection |

## Architecture

```
electron/
  main.cjs           Electron main process: window, media:// protocol, FFmpeg IPC
  preload.cjs        Context bridge exposing window.api to the renderer
src/
  App.tsx            Root layout + global keyboard shortcuts
  components/        TopBar, MediaPanel, PreviewPanel, Inspector, ExportDialog, Timeline/*
  engine/
    render.ts        Canvas 2D preview renderer (filters, chroma key, transforms)
    playback.ts      Playback clock and per-frame scheduling
    exportBuilder.ts Builds FFmpeg filtergraph args (drawtext, overlays, transitions, audio mix)
  store/
    editor.ts        Zustand store: project state, clips, tracks, undo/redo
    mediaCache.ts    Thumbnails, filmstrips, waveform caches (non-undoable)
    ui.ts            UI-only state (context menu, dialogs)
  constants.ts       Filters, effects, transitions, animations, text presets, emoji
```

- **Preview** is rendered on a canvas at the project resolution (capped at 1280px) with CSS-style filters, chroma key, and keyframed transforms.
- **Export** builds a single FFmpeg invocation: a base color canvas, per-clip `overlay` with `enable=between(t,…)` windows, `drawtext` for titles, fade/`tpad` transitions, and an audio graph (`atrim`, `atempo`, `afade`, `adelay`, `amix`).
- **Undo/redo** snapshots the project store via `commit()`; transient drags use `beginTransient()`/`endTransient()`.

## Requirements

- Node.js 18+
- macOS, Windows, or Linux (primary development on macOS)

FFmpeg and FFprobe are bundled via `ffmpeg-static` / `ffprobe-static` — no system install needed.

## Notes

- On npm 11.17+, install scripts are blocked by default; approve them with `npm approve-scripts electron ffmpeg-static esbuild fsevents` if the Electron binary fails to download.
- A project `.npmrc` points Electron downloads at the npmmirror binary mirror for faster installs.
