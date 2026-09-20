import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  CornerDownRight,
  ExternalLink,
  FileText,
  FolderOpen,
  Heart,
  Link2,
  Link2Off,
  Moon,
  Pencil,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";

import {
  displayDate,
  getStorage,
  isExtensionStorageAvailable,
  saveNotes,
  type Folder,
  type Note,
} from "../storage";
import { useTheme } from "../hooks/useTheme";

import "./FolderPage.css";

declare const chrome: {
  storage: {
    onChanged: {
      addListener(
        callback: (
          changes: Record<
            string,
            { newValue?: unknown; oldValue?: unknown }
          >,
          areaName: string,
        ) => void,
      ): void;
      removeListener(
        callback: (
          changes: Record<
            string,
            { newValue?: unknown; oldValue?: unknown }
          >,
          areaName: string,
        ) => void,
      ): void;
    };
  };
};

type SortMode = "newest" | "oldest" | "favorites";

interface FolderPageProps {
  folderId?: string;
}

function getRouteFolderId(): string {
  const hash = window.location.hash;
  const match = hash.match(/^#\/folder\/(.+)$/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function goHome(): void {
  window.location.hash = "";
}

function getSourceDomain(url: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getTimestamp(note: Note): number {
  const value = note.updatedAt || note.createdAt || note.date;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function getChildren(notes: Note[], parentId: string): Note[] {
  return notes.filter((note) => note.parentId === parentId);
}

export default function FolderPage({ folderId }: FolderPageProps) {
  const [folder, setFolder] = useState<Folder | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [linkTarget, setLinkTarget] = useState<Note | null>(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { resolved: themeResolved, toggle: toggleTheme } = useTheme();

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const loadFolder = useCallback(async () => {
    setLoading(true);
    try {
      const storage = await getStorage();
      const currentFolderId = folderId || getRouteFolderId();
      const selectedFolder = storage.folders.find(
        (item) => item.id === currentFolderId,
      );
      if (!selectedFolder) {
        setFolder(null);
        setNotes([]);
        setNotFound(true);
        return;
      }
      const folderNotes = storage.notes.filter(
        (note) => note.folderId === selectedFolder.id,
      );
      setFolder(selectedFolder);
      setNotes(folderNotes);
      setNotFound(false);
    } catch {
      setFolder(null);
      setNotes([]);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    void loadFolder();
  }, [loadFolder]);

  useEffect(() => {
    const handleHashChange = () => {
      void loadFolder();
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [loadFolder]);

  useEffect(() => {
    const listener = (
      changes: Record<
        string,
        { newValue?: unknown; oldValue?: unknown }
      >,
      areaName: string,
    ) => {
      if (areaName !== "local") return;
      const currentFolderId = folderId || getRouteFolderId();

      if (changes.folders) {
        const folders = (changes.folders.newValue as Folder[]) || [];
        const nextFolder = folders.find((item) => item.id === currentFolderId);
        setFolder(nextFolder || null);
        setNotFound(!nextFolder);
      }
      if (changes.notes) {
        const allNotes = (changes.notes.newValue as Note[]) || [];
        setNotes(allNotes.filter((note) => note.folderId === currentFolderId));
      }
    };
    if (!isExtensionStorageAvailable()) return;
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [folderId]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = notes.filter((note) => {
      if (!query) return true;
      return (
        note.text.toLowerCase().includes(query) ||
        note.title.toLowerCase().includes(query) ||
        note.url.toLowerCase().includes(query)
      );
    });
    return [...filtered].sort((a, b) => {
      if (sort === "favorites") {
        const diff = Number(!!b.favorite) - Number(!!a.favorite);
        if (diff !== 0) return diff;
      }
      const first = getTimestamp(a);
      const second = getTimestamp(b);
      if (sort === "oldest") return first - second;
      return second - first;
    });
  }, [notes, search, sort]);

  const favoriteCount = useMemo(
    () => notes.filter((note) => note.favorite).length,
    [notes],
  );

  const parentNotes = useMemo(
    () => filteredNotes.filter((note) => !note.parentId),
    [filteredNotes],
  );

  const childNotes = useMemo(
    () => filteredNotes.filter((note) => !!note.parentId),
    [filteredNotes],
  );

  const orphanNotes = useMemo(() => {
    const ids = new Set(notes.map((note) => note.id));
    return filteredNotes.filter(
      (note) => note.parentId && !ids.has(note.parentId),
    );
  }, [notes, filteredNotes]);

  const eligibleParents = useMemo(
    () => notes.filter((note) => !note.parentId),
    [notes],
  );
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(
    new Set(),
  );

  const canBecomeChild = useCallback((note: Note) => !note.parentId, []);


  function toggleExpanded(noteId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }
  function toggleTextExpanded(noteId: string) {
    setExpandedTextIds((current) => {
      const next = new Set(current);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(
      new Set(
        parentNotes
          .filter((n) => getChildren(notes, n.id).length > 0)
          .map((n) => n.id),
      ),
    );
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function startEditing(note: Note) {
    setEditingId(note.id);
    setEditedText(note.text);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditedText("");
  }

  async function saveEdit(noteId: string) {
    const cleaned = editedText.trim();
    if (!cleaned) {
      showToast("A note cannot be empty.");
      return;
    }
    try {
      const storage = await getStorage();
      const updatedNotes = storage.notes.map((note) =>
        note.id === noteId
          ? {
            ...note,
            text: cleaned,
            updatedAt: new Date().toISOString(),
          }
          : note,
      );
      await saveNotes(updatedNotes);
      setNotes(updatedNotes.filter((note) => note.folderId === folder?.id));
      cancelEditing();
      showToast("Note updated.");
    } catch {
      showToast("Could not update the note.");
    }
  }

  async function toggleFavorite(noteId: string) {
    try {
      const storage = await getStorage();
      let nextFavorite = false;
      const updatedNotes = storage.notes.map((note) => {
        if (note.id !== noteId) return note;
        nextFavorite = !note.favorite;
        return {
          ...note,
          favorite: nextFavorite,
          updatedAt: new Date().toISOString(),
        };
      });
      await saveNotes(updatedNotes);
      setNotes(updatedNotes.filter((note) => note.folderId === folder?.id));
      showToast(
        nextFavorite ? "Added to favorites." : "Removed from favorites.",
      );
    } catch {
      showToast("Could not update favorite.");
    }
  }

  async function duplicateNote(noteId: string) {
    try {
      const storage = await getStorage();
      const source = storage.notes.find((note) => note.id === noteId);
      if (!source) return;
      const timestamp = new Date().toISOString();
      const clone: Note = {
        ...source,
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        title: source.title ? `${source.title} (copy)` : "Untitled note (copy)",
        favorite: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        parentId: null,
      };
      const updatedNotes = [...storage.notes, clone];
      await saveNotes(updatedNotes);
      setNotes(updatedNotes.filter((note) => note.folderId === folder?.id));
      showToast("Note duplicated.");
    } catch {
      showToast("Could not duplicate note.");
    }
  }

  async function linkToParent(noteId: string, parentId: string | null) {
    try {
      const storage = await getStorage();
      const target = storage.notes.find((note) => note.id === noteId);
      if (!target) return;

      if (parentId !== null && target.parentId) {
        showToast("Child notes cannot be nested further.");
        return;
      }

      if (parentId !== null) {
        const parent = storage.notes.find((note) => note.id === parentId);
        if (!parent) return;
        if (parent.parentId) {
          showToast("Parent must be a top-level note.");
          return;
        }
        if (parent.id === target.id) return;
        if (parent.folderId !== target.folderId) {
          showToast("Parent must be in the same folder.");
          return;
        }
      }

      const updatedNotes = storage.notes.map((note) =>
        note.id === noteId
          ? { ...note, parentId, updatedAt: new Date().toISOString() }
          : note,
      );
      await saveNotes(updatedNotes);
      setNotes(updatedNotes.filter((note) => note.folderId === folder?.id));
      setLinkTarget(null);
      if (parentId !== null && expandedIds.size === 0) {
        setExpandedIds(new Set([parentId]));
      }
      showToast(parentId ? "Linked as child note." : "Unlinked from parent.");
    } catch {
      showToast("Could not update link.");
    }
  }

  async function deleteNote(noteId: string) {
    try {
      const storage = await getStorage();
      const target = storage.notes.find(
        (note) => note.id === noteId && note.folderId === folder?.id,
      );
      if (!target) {
        setDeleteTarget(null);
        return;
      }
      const idsToDelete = new Set<string>([target.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const note of storage.notes) {
          if (
            note.parentId &&
            idsToDelete.has(note.parentId) &&
            !idsToDelete.has(note.id)
          ) {
            idsToDelete.add(note.id);
            changed = true;
          }
        }
      }
      const updatedNotes = storage.notes.filter(
        (note) => !idsToDelete.has(note.id),
      );
      await saveNotes(updatedNotes);
      setNotes(updatedNotes.filter((note) => note.folderId === folder?.id));
      setDeleteTarget(null);
      showToast(
        idsToDelete.size > 1
          ? `Deleted note and ${idsToDelete.size - 1} child note${idsToDelete.size - 1 === 1 ? "" : "s"
          }.`
          : "Note deleted.",
      );
    } catch {
      showToast("Could not delete the note.");
    }
  }

  async function copyNote(note: Note) {
    try {
      await navigator.clipboard.writeText(note.text);
      showToast("Note copied to clipboard.");
    } catch {
      showToast("Could not copy this note.");
    }
  }

  function openSource(url: string) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function renderNoteCard(note: Note, depth = 0) {
    const children = getChildren(notes, note.id);
    const hasChildren = children.length > 0;
    const expanded = expandedIds.has(note.id);
    const isEditing = editingId === note.id;
    const domain = getSourceDomain(note.url);
    const isChild = !!note.parentId;

    return (
      <article
        key={note.id}
        className={`folder-note-card${isChild ? " is-child" : ""}`}
        style={{
          marginLeft: depth > 0 ? Math.min(depth * 20, 60) : undefined,
        }}
      >
        <div className="folder-note-top">
          <div className="folder-note-source">
            <div className="folder-note-icon">
              {isChild ? (
                <CornerDownRight size={15} />
              ) : (
                <FileText size={15} />
              )}
            </div>
            <div className="folder-note-source-info">
              <strong>{note.title || "Untitled note"}</strong>
              <span>
                {isChild && <span className="child-tag">child · </span>}
                {domain || "Captured note"}
              </span>
            </div>
          </div>

          <div className="folder-note-actions">
            {hasChildren && (
              <button
                type="button"
                className="note-icon-button"
                onClick={() => toggleExpanded(note.id)}
                aria-label={
                  expanded ? "Collapse child notes" : "Expand child notes"
                }
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? (
                  <ChevronDown size={15} />
                ) : (
                  <ChevronRight size={15} />
                )}
              </button>
            )}
            <button
              type="button"
              className={`note-icon-button${note.favorite ? " is-favorite" : ""
                }`}
              onClick={() => void toggleFavorite(note.id)}
              aria-label={
                note.favorite ? "Remove from favorites" : "Add to favorites"
              }
              title={note.favorite ? "Remove favorite" : "Favorite"}
            >
              <Heart
                size={15}
                fill={note.favorite ? "currentColor" : "none"}
              />
            </button>
            <button
              type="button"
              className="note-icon-button"
              onClick={() => void copyNote(note)}
              aria-label="Copy note"
              title="Copy"
            >
              <Copy size={15} />
            </button>
            <button
              type="button"
              className="note-icon-button"
              onClick={() => void duplicateNote(note.id)}
              aria-label="Duplicate note"
              title="Duplicate"
            >
              <Sparkles size={15} />
            </button>
            {note.url && (
              <button
                type="button"
                className="note-icon-button"
                onClick={() => openSource(note.url)}
                aria-label="Open source"
                title="Open source"
              >
                <ExternalLink size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="folder-note-body">
          {isEditing ? (
            <div className="note-editor">
              <textarea
                value={editedText}
                onChange={(event) => setEditedText(event.target.value)}
                autoFocus
                rows={7}
              />
              <div className="note-editor-actions">
                <button
                  type="button"
                  className="note-action"
                  onClick={cancelEditing}
                >
                  <X size={14} />
                  Cancel
                </button>
                <button
                  type="button"
                  className="note-action primary-note-action"
                  onClick={() => void saveEdit(note.id)}
                >
                  <Check size={14} />
                  Save changes
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3>{note.title || "Untitled note"}</h3>

              {(() => {
                const TRUNCATE = 320;
                const isLong = note.text.length > TRUNCATE;
                const expanded = expandedTextIds.has(note.id);
                const shown =
                  isLong && !expanded
                    ? note.text.slice(0, TRUNCATE).trimEnd() + "…"
                    : note.text;

                return (
                  <>
                    <p
                      className={`folder-note-text${isLong && !expanded ? " is-clamped" : ""
                        }`}
                    >
                      {shown}
                    </p>

                    {isLong && (
                      <button
                        type="button"
                        className="note-text-toggle"
                        onClick={() => toggleTextExpanded(note.id)}
                      >
                        {expanded ? "Show less" : "Read more"}
                      </button>
                    )}
                  </>
                );
              })()}

              {note.url && (
                <button
                  type="button"
                  className="source-preview"
                  onClick={() => openSource(note.url)}
                >
                  <ExternalLink size={13} />
                  <span>{note.url}</span>
                </button>
              )}
            </>
          )}
        </div>

        <div className="folder-note-footer">
          <div className="folder-note-meta">
            <span>
              {note.createdAt ? displayDate(note.createdAt) : note.date}
            </span>
            {hasChildren && (
              <span className="folder-note-count">
                {children.length}{" "}
                {children.length === 1 ? "child note" : "child notes"}
              </span>
            )}
          </div>

          {!isEditing && (
            <div className="folder-note-buttons">
              {isChild ? (
                <button
                  type="button"
                  className="note-action"
                  onClick={() => void linkToParent(note.id, null)}
                  title="Unlink from parent"
                >
                  <Link2Off size={13} />
                  Unlink
                </button>
              ) : (
                canBecomeChild(note) && (
                  <button
                    type="button"
                    className="note-action"
                    onClick={() => setLinkTarget(note)}
                    title="Link to a parent note"
                  >
                    <Link2 size={13} />
                    Link
                  </button>
                )
              )}
              <button
                type="button"
                className="note-action"
                onClick={() => startEditing(note)}
              >
                <Pencil size={13} />
                Edit
              </button>
              <button
                type="button"
                className="note-action danger-note-action"
                onClick={() => setDeleteTarget(note)}
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          )}
        </div>

        {hasChildren && expanded && (
          <div className="related-notes">
            <div className="related-notes-list">
              {children.map((child) => renderNoteCard(child, depth + 1))}
            </div>
          </div>
        )}
      </article>
    );
  }

  if (loading) {
    return (
      <div className="folder-page">
        <div className="folder-page-loading">
          <div className="folder-page-brand-icon">
            <Sparkles size={18} />
          </div>
          <strong>Loading folder…</strong>
          <span>Preparing your notes.</span>
        </div>
      </div>
    );
  }

  if (notFound || !folder) {
    return (
      <div className="folder-page">
        <div className="folder-page-error">
          <div className="folder-empty-icon">
            <FolderOpen size={26} />
          </div>
          <h1>Folder not found</h1>
          <p>
            This folder may have been deleted or the link is no longer valid.
          </p>
          <button type="button" className="empty-action" onClick={goHome}>
            <ArrowLeft size={14} />
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const expandableCount = parentNotes.filter(
    (n) => getChildren(notes, n.id).length > 0,
  ).length;

  return (
    <div className="app folder-page">
      <div className="folder-stage">
        <header className="quicknotes-navbar">
          <div className="quicknotes-navbar-left">
            <button
              type="button"
              className="quicknotes-back"
              onClick={goHome}
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <ArrowLeft size={17} />
            </button>

            <div className="quicknotes-brand">
              <div className="quicknotes-brand-icon">
                <FolderOpen size={16} />
              </div>
              <div className="quicknotes-brand-text">
                <h1>QuickNotes</h1>
                <span>Capture · Organize · Revise</span>
              </div>
            </div>
          </div>

          <div className="quicknotes-navbar-right">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={
                themeResolved === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              title={
                themeResolved === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              <span className="theme-toggle-track" aria-hidden="true">
                <span
                  className={`theme-toggle-icon theme-toggle-sun${themeResolved === "dark" ? " is-active" : ""
                    }`}
                >
                  <Sun size={15} />
                </span>
                <span
                  className={`theme-toggle-icon theme-toggle-moon${themeResolved === "light" ? " is-active" : ""
                    }`}
                >
                  <Moon size={15} />
                </span>
              </span>
            </button>

            <button
              type="button"
              className="quicknotes-favorites"
              onClick={() => {
                window.location.hash = "/favorites";
              }}
              aria-label="Open favorites"
              title="Favorites"
            >
              <Heart size={15} />
              <span>Favorites</span>
            </button>
          </div>
        </header>

        <main className="dashboard folder-dashboard">
          <section className="folder-hero">
            <div className="folder-hero-copy">
              <button
                type="button"
                className="folder-breadcrumb"
                onClick={goHome}
              >
                Dashboard
                <ChevronRight size={13} />
                <span>{folder.name}</span>
              </button>

              <div className="folder-title-row">
                <div className="large-folder-icon">
                  <FolderOpen size={22} />
                </div>
                <div>
                  <h1>{folder.name}</h1>
                  <div className="folder-privacy">
                    <ShieldCheck size={13} />
                    Stored locally
                  </div>
                </div>
              </div>

              <p>
                Everything you captured for this knowledge folder, organized in
                one place.
              </p>
            </div>

            <div className="folder-hero-stats">
              <div className="folder-stat">
                <span className="folder-stat-value">{notes.length}</span>
                <span className="folder-stat-label">Notes</span>
              </div>
              <div className="folder-stat-divider" />
              <div className="folder-stat">
                <span className="folder-stat-value">{favoriteCount}</span>
                <span className="folder-stat-label">Favorites</span>
              </div>
              <div className="folder-stat-divider" />
              <div className="folder-stat">
                <span className="folder-stat-value">{childNotes.length}</span>
                <span className="folder-stat-label">Linked</span>
              </div>
            </div>
          </section>

          <section className="folder-toolbar">
            <label className="folder-toolbar-search">
              <Search size={15} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search notes, titles or sources…"
                aria-label="Search notes"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </label>

            <div className="folder-toolbar-actions">
              {expandableCount > 0 && (
                <div className="expand-controls">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="expand-button"
                    title="Expand all child notes"
                  >
                    <ChevronDown size={13} />
                    Expand
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="expand-button"
                    title="Collapse all child notes"
                  >
                    <ChevronRight size={13} />
                    Collapse
                  </button>
                </div>
              )}

              <label className="sort-control">
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as SortMode)
                  }
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="favorites">Favorites</option>
                </select>
              </label>
            </div>
          </section>

          <section className="folder-notes-section">
            <div className="folder-notes-heading">
              <div>
                <h2>{search ? "Search results" : "Your notes"}</h2>
              </div>
              <span className="note-related-count">
                {filteredNotes.length}{" "}
                {filteredNotes.length === 1 ? "note" : "notes"}
              </span>
            </div>

            {filteredNotes.length === 0 ? (
              <div className="folder-empty-state">
                <div className="folder-empty-icon">
                  <Search size={22} />
                </div>
                <h3>
                  {search ? "No matching notes" : "This folder is empty"}
                </h3>
                <p>
                  {search
                    ? "Try another search term or clear the filter."
                    : "Capture something from a webpage and it will appear here."}
                </p>
                {search && (
                  <button
                    type="button"
                    className="empty-action"
                    onClick={() => setSearch("")}
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="folder-note-list">
                {parentNotes.map((note) => renderNoteCard(note))}
              </div>
            )}
          </section>

          {orphanNotes.length > 0 && (
            <section className="orphan-note-section">
              <div className="orphan-note-heading">
                <div>
                  <h2>Unlinked notes</h2>
                </div>
                <span className="note-related-count">{orphanNotes.length}</span>
              </div>

              <div className="folder-note-list">
                {orphanNotes.map((note) => renderNoteCard(note))}
              </div>
            </section>
          )}

          <footer className="dashboard-footer">
            <div>
              <ShieldCheck size={13} />
              <span>QuickNotes keeps your knowledge organized.</span>
            </div>
            <button type="button" onClick={goHome}>
              <ArrowLeft size={13} />
              Back to dashboard
            </button>
          </footer>
        </main>
      </div>

      {toast && (
        <div className="status-message status-success" role="status">
          <Check size={14} />
          {toast}
        </div>
      )}

      {linkTarget && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-note-title"
        >
          <div className="confirmation-modal link-modal">
            <button
              type="button"
              className="modal-close"
              onClick={() => setLinkTarget(null)}
              aria-label="Cancel"
            >
              <X size={16} />
            </button>

            <div className="link-icon">
              <Link2 size={18} />
            </div>

            <h2 id="link-note-title">Link to a parent note</h2>
            <p>
              Choose a top-level note to become the parent of "
              <strong>{linkTarget.title || "Untitled note"}</strong>". Only
              top-level notes can be parents, and a note can only have one
              parent.
            </p>

            <div className="link-list">
              {eligibleParents.filter((n) => n.id !== linkTarget.id).length ===
                0 ? (
                <div className="link-empty">
                  No top-level notes available in this folder.
                </div>
              ) : (
                eligibleParents
                  .filter((n) => n.id !== linkTarget.id)
                  .map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      className="link-option"
                      onClick={() =>
                        void linkToParent(linkTarget.id, candidate.id)
                      }
                    >
                      <FileText size={14} />
                      <span>{candidate.title || "Untitled note"}</span>
                      <ChevronRight size={14} />
                    </button>
                  ))
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel"
                onClick={() => setLinkTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-note-title"
        >
          <div className="confirmation-modal">
            <button
              type="button"
              className="modal-close"
              onClick={() => setDeleteTarget(null)}
              aria-label="Cancel"
            >
              <X size={16} />
            </button>

            <div className="danger-icon">
              <Trash2 size={18} />
            </div>

            <h2 id="delete-note-title">Delete this note?</h2>
            <p>
              This will permanently remove this note
              {getChildren(notes, deleteTarget.id).length > 0
                ? " and its child notes"
                : ""}
              . This action cannot be undone.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-delete"
                onClick={() => void deleteNote(deleteTarget.id)}
              >
                <Trash2 size={14} />
                Delete note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}