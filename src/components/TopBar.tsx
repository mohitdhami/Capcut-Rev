import { useEditor } from '../store/editor';
import { ASPECTS } from '../constants';
import { IconExport, IconRedo, IconUndo } from './icons';
import { saveProject } from '../utils/actions';

export function TopBar() {
  const project = useEditor((s) => s.project);
  const past = useEditor((s) => s.past.length);
  const future = useEditor((s) => s.future.length);
  const dirty = useEditor((s) => s.dirty);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const setProjectSettings = useEditor((s) => s.setProjectSettings);
  const setExportOpen = useEditor((s) => s.setExportOpen);
  const showToast = useEditor((s) => s.showToast);
  const clipCount = project.clips.length;

  return (
    <div className="topbar">
      <div className="logo">
        <span className="mark">CC</span>
        CapCut Rev
      </div>
      <input
        className="project-name"
        value={project.settings.name}
        spellCheck={false}
        onChange={(e) => setProjectSettings({ name: e.target.value })}
      />
      {dirty && <span className="small dim">Unsaved</span>}
      <div className="row" style={{ gap: 2 }}>
        <button className="btn ghost icon" title="Undo ⌘Z" disabled={past === 0} onClick={undo}>
          <IconUndo />
        </button>
        <button className="btn ghost icon" title="Redo ⇧⌘Z" disabled={future === 0} onClick={redo}>
          <IconRedo />
        </button>
      </div>
      <div className="spacer" />
      <select
        className="select-input"
        style={{ width: 110 }}
        value={project.settings.aspect}
        onChange={(e) => {
          const a = ASPECTS.find((x) => x.id === e.target.value);
          if (a) setProjectSettings({ aspect: a.id, width: a.width, height: a.height });
        }}
        title="Canvas aspect ratio"
      >
        {ASPECTS.map((a) => (
          <option key={a.id} value={a.id}>
            Ratio {a.name}
          </option>
        ))}
      </select>
      <button className="btn ghost" onClick={() => void saveProject()} title="Save project ⌘S">
        Save
      </button>
      <button
        className="btn primary"
        onClick={() => {
          if (clipCount === 0) {
            showToast('Timeline is empty — import and add media first');
            return;
          }
          setExportOpen(true);
        }}
      >
        <IconExport size={15} />
        Export
      </button>
    </div>
  );
}
