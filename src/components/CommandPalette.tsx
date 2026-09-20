import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CornerDownLeft,
  FileText,
  FolderOpen,
  Heart,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { Folder, Note } from "../storage";
import "./CommandPalette.css";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
  notes: Note[];
  onOpenFolder: (id: string) => void;
  onOpenFavorites: () => void;
  onCreateFolder?: () => void;
}

type Kind = "action" | "folder" | "note";

interface Result {
  id: string;
  kind: Kind;
  title: string;
  subtitle?: string;
  icon: typeof FolderOpen;
  accent?: "favorite";
  onSelect: () => void;
}

export default function CommandPalette({
  open,
  onClose,
  folders,
  notes,
  onOpenFolder,
  onOpenFavorites,
  onCreateFolder,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const folderMap = useMemo(() => {
    const map = new Map<string, Folder>();
    for (const f of folders) map.set(f.id, f);
    return map;
  }, [folders]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const items: Result[] = [];

    items.push({
      id: "action:favorites",
      kind: "action",
      title: "Open Favorites",
      subtitle: "View all favorite notes",
      icon: Heart,
      accent: "favorite",
      onSelect: () => {
        onOpenFavorites();
        onClose();
      },
    });

    if (onCreateFolder) {
      items.push({
        id: "action:new-folder",
        kind: "action",
        title: "Create new folder",
        subtitle: "Add a new workspace",
        icon: Plus,
        onSelect: () => {
          onCreateFolder();
          onClose();
        },
      });
    }

    for (const folder of folders) {
      if (q && !folder.name.toLowerCase().includes(q)) continue;
      const count = notes.filter((n) => n.folderId === folder.id).length;
      items.push({
        id: `folder:${folder.id}`,
        kind: "folder",
        title: folder.name,
        subtitle: `${count} ${count === 1 ? "note" : "notes"}`,
        icon: FolderOpen,
        onSelect: () => {
          onOpenFolder(folder.id);
          onClose();
        },
      });
    }

    for (const note of notes) {
      const hay = `${note.title} ${note.text} ${note.url}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const folder = folderMap.get(note.folderId);
      items.push({
        id: `note:${note.id}`,
        kind: "note",
        title: note.title || "Untitled note",
        subtitle: folder?.name || "Unknown folder",
        icon: FileText,
        accent: note.favorite ? "favorite" : undefined,
        onSelect: () => {
          onOpenFolder(note.folderId);
          onClose();
        },
      });
    }

    return items.slice(0, 40);
  }, [
    query,
    folders,
    notes,
    folderMap,
    onClose,
    onOpenFolder,
    onOpenFavorites,
    onCreateFolder,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const r = results[activeIndex];
        if (r) r.onSelect();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIndex, onClose]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const grouped: Record<Kind, Result[]> = {
    action: [],
    folder: [],
    note: [],
  };
  for (const r of results) grouped[r.kind].push(r);

  const labels: Record<Kind, string> = {
    action: "Actions",
    folder: "Folders",
    note: "Notes",
  };

  return (
    <div
      className="cmd-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={onClose}
    >
      <div className="cmd-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Search folders, notes, or actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="cmd-close"
            onClick={onClose}
            aria-label="Close command palette"
          >
            <X size={14} />
          </button>
        </div>

        <div className="cmd-results" ref={listRef}>
          {results.length === 0 ? (
            <div className="cmd-empty">
              <Search size={20} />
              <strong>No matches</strong>
              <span>Try a different search term.</span>
            </div>
          ) : (
            (["action", "folder", "note"] as const).map((kind) => {
              const items = grouped[kind];
              if (items.length === 0) return null;
              return (
                <div className="cmd-group" key={kind}>
                  <div className="cmd-group-label">{labels[kind]}</div>
                  {items.map((r) => {
                    const idx = results.indexOf(r);
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.id}
                        data-index={idx}
                        type="button"
                        className={`cmd-item${
                          idx === activeIndex ? " is-active" : ""
                        }`}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={r.onSelect}
                      >
                        <span
                          className={`cmd-item-icon${
                            r.accent === "favorite" ? " is-fav" : ""
                          }`}
                        >
                          <Icon size={14} />
                        </span>
                        <span className="cmd-item-body">
                          <strong>{r.title}</strong>
                          {r.subtitle && <small>{r.subtitle}</small>}
                        </span>
                        {idx === activeIndex && (
                          <span className="cmd-item-enter" aria-hidden="true">
                            <CornerDownLeft size={12} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="cmd-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Navigate
          </span>
          <span>
            <kbd>↵</kbd> Select
          </span>
          <span>
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}