import { useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { MediaPanel } from './components/MediaPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline/Timeline';
import { ExportDialog } from './components/ExportDialog';
import { ContextMenu } from './components/ContextMenu';
import { useEditor, normalizeProject, projectDuration } from './store/editor';
import { useUI } from './store/ui';
import { importMedia, openProjectFile, saveProject, verifyAssets } from './utils/actions';

const AUTOSAVE_KEY = 'capcut-rev.autosave.v1';

export default function App() {
  const toast = useEditor((s) => s.toast);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const project = normalizeProject(parsed.project);
        if (project.clips.length > 0 || project.assets.length > 0) {
          useEditor.getState().loadProject(project, parsed.filePath ?? null);
          void verifyAssets();
        }
      } catch {
        /* ignore corrupt autosave */
      }
    }
  }, []);

  useEffect(() => {
    const unsub = useEditor.subscribe((state, prev) => {
      if (state.project !== prev.project) {
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          try {
            localStorage.setItem(
              AUTOSAVE_KEY,
              JSON.stringify({ project: state.project, filePath: state.projectFilePath })
            );
          } catch {
            /* storage full */
          }
        }, 1500);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    window.api.getFonts().then((fonts) => useUI.getState().setFonts(fonts));
  }, []);

  useEffect(() => {
    const off = window.api.onMenuAction((action) => {
      const s = useEditor.getState();
      switch (action) {
        case 'new-project':
          s.newProject();
          localStorage.removeItem(AUTOSAVE_KEY);
          break;
        case 'open-project':
          void openProjectFile();
          break;
        case 'save-project':
          void saveProject();
          break;
        case 'import-media':
          void importMedia();
          break;
        case 'export':
          if (s.project.clips.length > 0) s.setExportOpen(true);
          else s.showToast('Timeline is empty — import and add media first');
          break;
        default:
          break;
      }
    });
    return off;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const s = useEditor.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key;

      if (key === 'Escape') {
        useUI.getState().closeContextMenu();
        if (s.exportOpen) s.setExportOpen(false);
        else s.clearSelection();
        return;
      }

      if (key === ' ' && !mod) {
        e.preventDefault();
        s.setPlaying(!s.playing);
        return;
      }

      if (mod && key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key.toLowerCase() === 's') {
        e.preventDefault();
        void saveProject(e.shiftKey);
        return;
      }
      if (mod && key.toLowerCase() === 'o') {
        e.preventDefault();
        void openProjectFile();
        return;
      }
      if (mod && key.toLowerCase() === 'i') {
        e.preventDefault();
        void importMedia();
        return;
      }
      if (mod && key.toLowerCase() === 'n') {
        e.preventDefault();
        s.newProject();
        localStorage.removeItem(AUTOSAVE_KEY);
        return;
      }
      if (mod && key.toLowerCase() === 'e') {
        e.preventDefault();
        if (s.project.clips.length > 0) s.setExportOpen(true);
        return;
      }
      if (mod && key.toLowerCase() === 'b') {
        e.preventDefault();
        s.splitAt(s.currentTime, s.selectedClipIds.length ? s.selectedClipIds : undefined);
        return;
      }
      if (mod && key.toLowerCase() === 'c') {
        if (s.selectedClipIds.length) {
          e.preventDefault();
          s.copyClips(s.selectedClipIds);
        }
        return;
      }
      if (mod && key.toLowerCase() === 'x') {
        if (s.selectedClipIds.length) {
          e.preventDefault();
          s.cutClips(s.selectedClipIds);
        }
        return;
      }
      if (mod && key.toLowerCase() === 'v') {
        e.preventDefault();
        s.pasteClips();
        return;
      }
      if (mod && key.toLowerCase() === 'd') {
        e.preventDefault();
        if (s.selectedClipIds.length) s.duplicateClips(s.selectedClipIds);
        return;
      }
      if (mod && (key === '=' || key === '+')) {
        e.preventDefault();
        s.setZoom(s.zoom * 1.3);
        return;
      }
      if (mod && key === '-') {
        e.preventDefault();
        s.setZoom(s.zoom / 1.3);
        return;
      }

      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        if (s.selectedClipIds.length) s.removeClips(s.selectedClipIds);
        else if (s.selectedAssetIds.length) s.removeAssets(s.selectedAssetIds);
        return;
      }

      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault();
        const step = (e.shiftKey ? 1 : 1 / s.project.settings.fps) * (key === 'ArrowLeft' ? -1 : 1);
        s.setTime(s.currentTime + step);
        return;
      }
      if (key === 'Home') {
        e.preventDefault();
        s.setTime(0);
        return;
      }
      if (key === 'End') {
        e.preventDefault();
        s.setTime(projectDuration(s.project));
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <MediaPanel />
        <div className="center">
          <PreviewPanel />
        </div>
        <Inspector />
      </div>
      <Timeline />
      <ExportDialog />
      <ContextMenu />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
