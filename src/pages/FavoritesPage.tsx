import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";

import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FolderOpen,
  Heart,
  Moon,
  Search,
  ShieldCheck,
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

import "./FavoritesPage.css";

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

export default function FavoritesPage(): ReactElement {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  const toastTimerRef = useRef<number | null>(null);

  const { resolved: themeResolved, toggle: toggleTheme } = useTheme();

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
      toastTimerRef.current = null;
    }, 2200);
  }, []);

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const storage = await getStorage();
      setFolders(storage.folders);
      setNotes(storage.notes.filter((note) => note.favorite === true));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFavorites();

    const listener = (
      changes: Record<
        string,
        { newValue?: unknown; oldValue?: unknown }
      >,
      areaName: string,
    ) => {
      if (areaName !== "local") return;

      if (changes.notes) {
        const next = Array.isArray(changes.notes.newValue)
          ? (changes.notes.newValue as Note[])
          : [];
        setNotes(next.filter((note) => note.favorite === true));
      }
      if (changes.folders) {
        const next = Array.isArray(changes.folders.newValue)
          ? (changes.folders.newValue as Folder[])
          : [];
        setFolders(next);
      }
    };

    if (!isExtensionStorageAvailable()) return;
    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [loadFavorites]);

  const folderMap = useMemo(() => {
    const map = new Map<string, Folder>();
    for (const folder of folders) map.set(folder.id, folder);
    return map;
  }, [folders]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...notes]
      .filter((note) => {
        if (!query) return true;
        const folderName = folderMap.get(note.folderId)?.name || "";
        return (
          note.text.toLowerCase().includes(query) ||
          note.title.toLowerCase().includes(query) ||
          note.url.toLowerCase().includes(query) ||
          folderName.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }, [notes, search, folderMap]);

  async function copyNote(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard.");
    } catch {
      showToast("Could not copy this note.");
    }
  }

  async function removeFavorite(noteId: string): Promise<void> {
    try {
      const storage = await getStorage();
      const updatedNotes = storage.notes.map((note) => {
        if (note.id !== noteId) return note;
        return {
          ...note,
          favorite: false,
          updatedAt: new Date().toISOString(),
        };
      });
      await saveNotes(updatedNotes);
      setNotes(updatedNotes.filter((note) => note.favorite === true));
      showToast("Removed from favorites.");
    } catch {
      showToast("Could not update this note.");
    }
  }

  async function deleteNote(noteId: string): Promise<void> {
    try {
      const storage = await getStorage();
      const exists = storage.notes.some(
        (note) => note.id === noteId && note.favorite === true,
      );
      if (!exists) {
        setDeleteTarget(null);
        showToast("This note is no longer available.");
        return;
      }
      const updatedNotes = storage.notes.filter((note) => note.id !== noteId);
      await saveNotes(updatedNotes);
      setNotes(updatedNotes.filter((note) => note.favorite === true));
      setDeleteTarget(null);
      showToast("Note deleted.");
    } catch {
      showToast("Could not delete this note.");
    }
  }

  function openFolder(folderId: string): void {
    window.location.hash = `/folder/${encodeURIComponent(folderId)}`;
  }

  if (loading) {
    return (
      <div className="app favorites-page">
        <header className="favorites-navbar">
          <button className="favorites-back" type="button" onClick={goHome}>
            <ArrowLeft size={17} />
          </button>
          <div className="favorites-brand">
            <div className="favorites-brand-icon">
              <Heart size={16} fill="currentColor" />
            </div>
            <div className="favorites-brand-text">
              <h1>Favorites</h1>
              <span>Loading…</span>
            </div>
          </div>
        </header>
        <main className="dashboard favorites-dashboard">
          <div className="favorites-empty">
            <div className="favorites-empty-icon">
              <Heart size={22} />
            </div>
            <h3>Loading your favorites</h3>
            <p>Preparing your saved notes.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app favorites-page">
      <header className="favorites-navbar">
        <div className="favorites-navbar-left">
          <button
            type="button"
            className="favorites-back"
            onClick={goHome}
            title="Back to dashboard"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={17} />
          </button>

          <div className="favorites-brand">
            <div className="favorites-brand-icon">
              <Heart size={15} fill="currentColor" />
            </div>
            <div className="favorites-brand-text">
              <h1>Favorites</h1>
              <span>Your saved knowledge</span>
            </div>
          </div>
        </div>

        <div className="favorites-navbar-right">
          <div className="favorites-privacy">
            <ShieldCheck size={13} />
            Local
          </div>

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
                className={`theme-toggle-icon theme-toggle-sun${
                  themeResolved === "dark" ? " is-active" : ""
                }`}
              >
                <Sun size={15} />
              </span>
              <span
                className={`theme-toggle-icon theme-toggle-moon${
                  themeResolved === "light" ? " is-active" : ""
                }`}
              >
                <Moon size={15} />
              </span>
            </span>
          </button>

          <button type="button" className="favorites-home" onClick={goHome}>
            Dashboard
          </button>
        </div>
      </header>

      <main className="dashboard favorites-dashboard">
        {toast && (
          <div
            className="status-message status-success"
            role="status"
            aria-live="polite"
          >
            <Check size={14} />
            <span>{toast}</span>
            <button
              type="button"
              onClick={() => setToast("")}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <section className="favorites-hero">
          <div className="favorites-hero-copy">
            <div className="favorites-hero-icon">
              <Heart size={22} fill="currentColor" />
            </div>
            <div>
              <h2>Favorites</h2>
              <p>
                The notes you marked as important, kept ready for quick access.
              </p>
            </div>
          </div>

          <div className="favorites-hero-stats">
            <div className="favorites-stat">
              <span className="favorites-stat-value">{notes.length}</span>
              <span className="favorites-stat-label">Saved notes</span>
            </div>
            <div className="favorites-stat-divider" />
            <div className="favorites-stat">
              <span className="favorites-stat-value">{folders.length}</span>
              <span className="favorites-stat-label">Folders</span>
            </div>
          </div>
        </section>

        <div className="favorites-toolbar">
          <div className="favorites-toolbar-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search favorites, folders, notes or sources…"
              aria-label="Search favorite notes"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear favorite search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <section className="favorites-notes-section">
          <div className="favorites-notes-heading">
            <div>
              <h2>Saved notes</h2>
              <p>
                {search
                  ? `${filteredNotes.length} result${
                      filteredNotes.length === 1 ? "" : "s"
                    } matching "${search}"`
                  : "Everything you've marked as worth remembering."}
              </p>
            </div>
            <div className="favorites-note-count">
              <Heart size={12} fill="currentColor" />
              {filteredNotes.length}
            </div>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="favorites-empty">
              <div className="favorites-empty-icon">
                {search ? <Search size={22} /> : <Heart size={22} />}
              </div>
              <h3>
                {search
                  ? "Nothing matched your search"
                  : "No favorite notes yet"}
              </h3>
              <p>
                {search
                  ? "Try another keyword, folder name, or source."
                  : "When you find something worth returning to, mark the note as a favorite and it will appear here."}
              </p>
              {search ? (
                <button
                  type="button"
                  className="empty-action"
                  onClick={() => setSearch("")}
                >
                  Clear search
                  <X size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="empty-action"
                  onClick={goHome}
                >
                  Browse your folders
                  <ArrowLeft size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="favorites-note-list">
              {filteredNotes.map((note) => {
                const folder = folderMap.get(note.folderId);
                return (
                  <article className="favorites-note-card" key={note.id}>
                    <div className="favorites-note-top">
                      <div className="favorites-note-source">
                        <div className="favorites-note-icon">
                          <Heart size={14} fill="currentColor" />
                        </div>
                        <div className="favorites-note-source-info">
                          <button
                            type="button"
                            className="favorites-folder-link"
                            onClick={() => {
                              if (folder) openFolder(folder.id);
                            }}
                            disabled={!folder}
                            title={
                              folder
                                ? `Open ${folder.name}`
                                : "Folder unavailable"
                            }
                          >
                            <FolderOpen size={12} />
                            <span>{folder?.name || "Unknown folder"}</span>
                          </button>
                          <small>
                            {getSourceDomain(note.url) || "QuickNotes"}
                            {" · "}
                            {displayDate(note.createdAt || note.date)}
                          </small>
                        </div>
                      </div>

                      <div className="favorites-note-actions">
                        <button
                          type="button"
                          className="favorites-icon-button is-favorite"
                          onClick={() => void removeFavorite(note.id)}
                          title="Remove from favorites"
                          aria-label="Remove from favorites"
                        >
                          <Heart size={15} fill="currentColor" />
                        </button>
                      </div>
                    </div>

                    <div className="favorites-note-body">
                      {note.title && <h3>{note.title}</h3>}
                      <p className="favorites-note-text">{note.text}</p>
                      {note.url && (
                        <button
                          type="button"
                          className="source-preview"
                          onClick={() =>
                            window.open(
                              note.url,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                          title="Open source page"
                        >
                          <ExternalLink size={12} />
                          <span>{note.url}</span>
                        </button>
                      )}
                    </div>

                    <div className="favorites-note-footer">
                      <div className="favorites-note-meta">
                        <span>Saved to favorites</span>
                      </div>
                      <div className="favorites-note-buttons">
                        <button
                          type="button"
                          className="note-action"
                          onClick={() => void copyNote(note.text)}
                        >
                          <Copy size={13} />
                          Copy
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
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <div>
            <ShieldCheck size={13} />
            <span>Your favorites remain stored locally on this device.</span>
          </div>
          <button type="button" onClick={goHome}>
            Back to dashboard
          </button>
        </footer>
      </main>

      {deleteTarget && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-favorite-title"
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

            <h2 id="delete-favorite-title">Delete this note?</h2>
            <p>
              This permanently removes the note from QuickNotes. Removing a
              note here also removes it from its original folder.
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