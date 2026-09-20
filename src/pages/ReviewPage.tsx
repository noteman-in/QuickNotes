import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import {
  Archive,
  ArrowLeft,
  Check,
  ExternalLink,
  Flame,
  FolderOpen,
  Heart,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";

import {
  advanceReviewStreak,
  buildReviewQueue,
  countDueNotes,
  displayDate,
  getStorage,
  isExtensionStorageAvailable,
  saveNotes,
  saveSettings,
  type Folder,
  type Note,
  type QuickNotesSettings,
} from "../storage";
import { useTheme } from "../hooks/useTheme";

import "./ReviewPage.css";

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

export default function ReviewPage(): ReactElement {
  const [queue, setQueue] = useState<Note[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [settings, setSettings] = useState<QuickNotesSettings | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [toast, setToast] = useState("");
  const [finished, setFinished] = useState(false);

  const { resolved: themeResolved, toggle: toggleTheme } = useTheme();

  const folderMap = useMemo(() => {
    const map = new Map<string, Folder>();
    for (const f of folders) map.set(f.id, f);
    return map;
  }, [folders]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const storage = await getStorage();
      setFolders(storage.folders);
      setSettings(storage.settings);
      setDueCount(countDueNotes(storage.notes));

      const q = buildReviewQueue(storage.notes, 8);
      setQueue(q);
      setIndex(0);
      setFinished(q.length === 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isExtensionStorageAvailable()) return;
    const listener = (
      changes: Record<
        string,
        { newValue?: unknown; oldValue?: unknown }
      >,
      areaName: string,
    ) => {
      if (areaName !== "local") return;
      if (changes.folders) {
        setFolders((changes.folders.newValue as Folder[]) || []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const current = queue[index] || null;
  const progress = queue.length === 0 ? 0 : index / queue.length;

  const finalise = useCallback(
    async (finalSettings: QuickNotesSettings) => {
      const next = advanceReviewStreak(finalSettings);
      await saveSettings(next);
      setSettings(next);
    },
    [],
  );

  const keepInRotation = useCallback(async () => {
    if (!current) return;
    try {
      const storage = await getStorage();
      const now = new Date().toISOString();
      const updated = storage.notes.map((n) =>
        n.id === current.id
          ? {
              ...n,
              lastReviewedAt: now,
              reviewCount: (n.reviewCount ?? 0) + 1,
            }
          : n,
      );
      await saveNotes(updated);
      await finalise(storage.settings);
      showToast("Kept in rotation");

      if (index + 1 >= queue.length) {
        setFinished(true);
      } else {
        setIndex((i) => i + 1);
      }
    } catch {
      showToast("Could not update note.");
    }
  }, [current, index, queue.length, finalise, showToast]);

  const archive = useCallback(async () => {
    if (!current) return;
    try {
      const storage = await getStorage();
      const now = new Date().toISOString();
      const updated = storage.notes.map((n) =>
        n.id === current.id
          ? {
              ...n,
              archivedAt: now,
              lastReviewedAt: now,
              reviewCount: (n.reviewCount ?? 0) + 1,
            }
          : n,
      );
      await saveNotes(updated);
      await finalise(storage.settings);
      showToast("Archived");

      if (index + 1 >= queue.length) {
        setFinished(true);
      } else {
        setIndex((i) => i + 1);
      }
    } catch {
      showToast("Could not archive note.");
    }
  }, [current, index, queue.length, finalise, showToast]);

  const skip = useCallback(() => {
    if (index + 1 >= queue.length) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, queue.length]);

  // keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (!current || finished) return;

      if (e.key === " " || e.key === "ArrowRight" || e.key === "k") {
        e.preventDefault();
        void keepInRotation();
      } else if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        void archive();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        skip();
      } else if (e.key === "Escape") {
        goHome();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, finished, keepInRotation, archive, skip]);

  if (loading) {
    return (
      <div className="app review-page">
        <div className="folder-page-loading">
          <div className="folder-page-brand-icon">
            <RefreshCw size={18} />
          </div>
          <strong>Loading your review…</strong>
          <span>Picking notes worth revisiting.</span>
        </div>
      </div>
    );
  }

  const folder = current ? folderMap.get(current.folderId) : null;

  return (
    <div className="app review-page">
      <div className="review-stage">
        <header className="review-navbar">
          <div className="review-navbar-left">
            <button
              type="button"
              className="review-back"
              onClick={goHome}
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <ArrowLeft size={17} />
            </button>

            <div className="review-brand">
              <div className="review-brand-icon">
                <Sparkles size={15} />
              </div>
              <div className="review-brand-text">
                <h1>Daily Review</h1>
                <span>Resurface what you saved</span>
              </div>
            </div>
          </div>

          <div className="review-navbar-right">
            <div className="review-streak" title="Review streak">
              <Flame size={14} />
              <span>{settings?.reviewStreak ?? 0}</span>
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
          </div>
        </header>

        <main className="review-dashboard">
          {finished || !current ? (
            <div className="review-empty">
              <div className="review-empty-icon">
                <Check size={26} />
              </div>
              <h2>You're all caught up</h2>
              <p>
                {dueCount === 0
                  ? "Add more notes or come back tomorrow — new ones will surface automatically."
                  : "Everything due today has been reviewed. Nice work."}
              </p>
              <button
                type="button"
                className="review-cta"
                onClick={goHome}
              >
                Back to dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="review-progress-bar" aria-hidden="true">
                <span style={{ width: `${progress * 100}%` }} />
              </div>

              <div className="review-meta">
                <span>
                  Note {index + 1} of {queue.length}
                </span>
                <span className="review-meta-dot">·</span>
                <span>
                  {dueCount} due total
                </span>
              </div>

              <article className="review-card" key={current.id}>
                <div className="review-card-top">
                  <button
                    type="button"
                    className="review-folder-chip"
                    onClick={() => {
                      if (folder) {
                        window.location.hash = `/folder/${encodeURIComponent(
                          folder.id,
                        )}`;
                      }
                    }}
                    disabled={!folder}
                    title={folder ? `Open ${folder.name}` : "Folder unavailable"}
                  >
                    <FolderOpen size={12} />
                    <span>{folder?.name || "Unassigned"}</span>
                  </button>

                  <div className="review-card-meta">
                    {current.favorite && (
                      <span className="review-pill review-pill-fav">
                        <Heart size={11} fill="currentColor" />
                        Favorite
                      </span>
                    )}
                    {(current.reviewCount ?? 0) > 0 && (
                      <span className="review-pill">
                        Reviewed {current.reviewCount}×
                      </span>
                    )}
                  </div>
                </div>

                {current.title && (
                  <h2 className="review-card-title">
                    {current.title || "Untitled note"}
                  </h2>
                )}

                <p className="review-card-text">{current.text}</p>

                <div className="review-card-footer">
                  <span className="review-card-date">
                    {current.createdAt
                      ? displayDate(current.createdAt)
                      : current.date}
                  </span>

                  {current.url && (
                    <a
                      className="review-card-source"
                      href={current.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={12} />
                      <span>{getSourceDomain(current.url) || "Open source"}</span>
                    </a>
                  )}
                </div>
              </article>

              <div className="review-actions">
                <button
                  type="button"
                  className="review-action review-action-archive"
                  onClick={() => void archive()}
                  title="Archive — never show again"
                >
                  <Archive size={15} />
                  Archive
                  <kbd>A</kbd>
                </button>

                <button
                  type="button"
                  className="review-action review-action-skip"
                  onClick={skip}
                  title="Skip for now"
                >
                  <RefreshCw size={15} />
                  Skip
                  <kbd>S</kbd>
                </button>

                <button
                  type="button"
                  className="review-action review-action-keep"
                  onClick={() => void keepInRotation()}
                  title="Keep in rotation"
                >
                  <Check size={15} />
                  Keep in rotation
                  <kbd>Space</kbd>
                </button>
              </div>

              <div className="review-hint">
                <ShieldCheck size={12} />
                <span>
                  Archive hides a note from future reviews. Keep returns it
                  later.
                </span>
              </div>
            </>
          )}
        </main>
      </div>

      {toast && (
        <div className="status-message status-success" role="status">
          <Check size={14} />
          {toast}
        </div>
      )}
    </div>
  );
}