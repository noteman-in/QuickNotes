import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import "./App.css";
import FolderPage from "./pages/FolderPage";
import FavoritesPage from "./pages/FavoritesPage";
import Landing from "./pages/Landing";
import CommandPalette from "./components/CommandPalette";
import { useTheme } from "./hooks/useTheme";
import ReviewPage from "./pages/ReviewPage";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Flame,
  Folder as FolderIcon,
  FolderOpen,
  Heart,
  Lock,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Trash2,
  X,
} from "lucide-react";

import logo from "./assets/logo.png";

import {
  countDueNotes,
  createFolder,
  displayDate,
  folderShortcutKey,
  formatShortcut,
  getStorage,
  isExtensionStorageAvailable,
  saveFolders,
  saveNotes,
  saveSettings,
  type Folder,
  type Modifier,
  type Note,
  type QuickNotesSettings,
} from "./storage";

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

const MODIFIER_OPTIONS: Modifier[] = ["Shift", "Option"];
const COMMAND_KEYS = ["D", "G", "H", "J", "K", "M", "U"];
const CTRL_KEYS = ["D", "G", "H", "J", "K", "M", "U"];
const STANDARD_KEYS = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

type FolderSort = "recent" | "name" | "notes";

function getAvailableKeys(modifier: Modifier | ""): string[] {
  if (modifier === "⌘") return COMMAND_KEYS;
  if (modifier === "Ctrl") return CTRL_KEYS;
  return STANDARD_KEYS;
}

function openFolder(folderId: string): void {
  window.location.hash = `/folder/${encodeURIComponent(folderId)}`;
}
function openFavorites(): void {
  window.location.hash = "/favorites";
}

function getRoute(): {
  type: "dashboard" | "folder" | "favorites" | "review" | "welcome";
  folderId?: string;
} {
  const hash = window.location.hash;
  if (hash === "#/favorites") return { type: "favorites" };
  if (hash === "#/review") return { type: "review" };
  if (hash === "#/welcome") return { type: "welcome" };
  const match = hash.match(/^#\/folder\/(.+)$/);
  if (match) {
    try {
      return { type: "folder", folderId: decodeURIComponent(match[1]) };
    } catch {
      return { type: "folder", folderId: match[1] };
    }
  }
  return { type: "dashboard" };
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getRecentNotes(notes: Note[], limit = 6): Note[] {
  return [...notes]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || b.date).getTime() -
        new Date(a.updatedAt || a.createdAt || a.date).getTime(),
    )
    .slice(0, limit);
}

function getChildren(notes: Note[], parentId: string): Note[] {
  return notes.filter((note) => note.parentId === parentId);
}

async function exportFolderPDF(folder: Folder, notes: Note[]): Promise<void> {
  const folderNotes = notes.filter((note) => note.folderId === folder.id);
  if (folderNotes.length === 0) {
    window.alert("This folder has no notes to export yet.");
    return;
  }

  const content: any[] = [
    { text: `QuickNotes · ${folder.name}`, style: "header" },
    {
      text: `${folderNotes.length} ${folderNotes.length === 1 ? "note" : "notes"
        } · ${formatShortcut(folder)}`,
      style: "metadata",
    },
    { text: "", margin: [0, 0, 0, 8] },
  ];

  const parents = folderNotes.filter((n) => !n.parentId);
  const orphanChildren = folderNotes.filter(
    (n) => n.parentId && !folderNotes.some((p) => p.id === n.parentId),
  );

  let counter = 1;
  for (const parent of parents) {
    content.push(
      { text: `${counter}. ${parent.title || "Untitled note"}`, style: "title" },
      { text: parent.text, style: "body" },
    );
    if (parent.url) {
      content.push({ text: `Source: ${parent.url}`, style: "source" });
    }
    content.push({
      text: `Captured: ${parent.createdAt ? displayDate(parent.createdAt) : parent.date
        }`,
      style: "metadata",
    });

    for (const child of getChildren(folderNotes, parent.id)) {
      content.push(
        { text: "↳ Related note", style: "childLabel" },
        { text: child.text, style: "childBody" },
      );
      if (child.url) {
        content.push({ text: `Source: ${child.url}`, style: "childSource" });
      }
      content.push({
        text: `Captured: ${child.createdAt ? displayDate(child.createdAt) : child.date
          }`,
        style: "childMetadata",
      });
    }
    content.push({ text: "", margin: [0, 0, 0, 8] });
    counter += 1;
  }

  if (orphanChildren.length > 0) {
    content.push({ text: "Other notes", style: "title" });
    for (const note of orphanChildren) {
      content.push(
        { text: note.title || "Untitled note", style: "title" },
        { text: note.text, style: "body" },
      );
      if (note.url) {
        content.push({ text: `Source: ${note.url}`, style: "source" });
      }
      content.push({
        text: `Captured: ${note.createdAt ? displayDate(note.createdAt) : note.date
          }`,
        style: "metadata",
      });
    }
  }

  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = pdfMakeModule.default;
  (pdfMake as any).addVirtualFileSystem(pdfFontsModule.default);

  pdfMake
    .createPdf({
      pageMargins: [42, 46, 42, 46],
      content,
      styles: {
        header: { fontSize: 22, bold: true, margin: [0, 0, 0, 8] },
        title: { fontSize: 14, bold: true, margin: [0, 8, 0, 5] },
        body: { fontSize: 10, lineHeight: 1.45, margin: [0, 0, 0, 8] },
        source: { fontSize: 8, color: "#4f46e5", margin: [0, 0, 0, 4] },
        metadata: { fontSize: 8, color: "#6b7280", margin: [0, 0, 0, 10] },
        childLabel: {
          fontSize: 9,
          bold: true,
          color: "#4f46e5",
          margin: [22, 7, 0, 3],
        },
        childBody: { fontSize: 9, lineHeight: 1.4, margin: [32, 0, 0, 6] },
        childSource: { fontSize: 8, color: "#4f46e5", margin: [32, 0, 0, 3] },
        childMetadata: { fontSize: 8, color: "#6b7280", margin: [32, 0, 0, 8] },
      },
    })
    .download(`QuickNotes-${folder.name}.pdf`);
}

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [settings, setSettings] = useState<QuickNotesSettings>({
    onboardingCompleted: false,
    notifications: true,
    autoOpenPopup: false,
    startWithSystem: false,
  });
  const [loaded, setLoaded] = useState(false);
  const [route, setRoute] = useState(getRoute);

  const [folderName, setFolderName] = useState("");
  const [modifier, setModifier] = useState<Modifier | "">("");
  const [keyValue, setKeyValue] = useState("");
  const [warning, setWarning] = useState("");
  const [success, setSuccess] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [folderSort, setFolderSort] = useState<FolderSort>("recent");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  const { resolved: themeResolved, toggle: toggleTheme } = useTheme();

  const loadStorage = useCallback(async () => {
    const data = await getStorage();
    setFolders(data.folders);
    setNotes(data.notes);
    setSettings(data.settings);
    setLoaded(true);
    if (
      data.folders.length === 0 &&
      data.notes.length === 0 &&
      !data.settings.onboardingCompleted
    ) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    void loadStorage();
  }, [loadStorage]);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getRoute());
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
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
      if (changes.notes) {
        setNotes((changes.notes.newValue as Note[]) || []);
      }
      if (changes.settings) {
        setSettings(
          (changes.settings.newValue as QuickNotesSettings) || {
            onboardingCompleted: false,
            notifications: true,
            autoOpenPopup: false,
            startWithSystem: false,
          },
        );
      }
    };
    if (!isExtensionStorageAvailable()) return;
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    const closeMenu = () => setOpenMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      const mod = e.metaKey || e.ctrlKey;
      if (isK && mod) {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (e.key === "Escape" && commandOpen) {
        setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandOpen]);

  const availableKeys = useMemo(() => getAvailableKeys(modifier), [modifier]);

  const shortcutAlreadyExists = useMemo(() => {
    if (!modifier || !keyValue) return false;
    const candidate = `${modifier}:${keyValue.trim().toUpperCase()}`;
    return folders.some((f) => folderShortcutKey(f) === candidate);
  }, [folders, modifier, keyValue]);

  const noteCountByFolder = useMemo(() => {
    const map = new Map<string, number>();
    for (const note of notes) {
      map.set(note.folderId, (map.get(note.folderId) || 0) + 1);
    }
    return map;
  }, [notes]);

  const filteredFolders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = query
      ? folders.filter(
        (f) =>
          f.name.toLowerCase().includes(query) ||
          formatShortcut(f).toLowerCase().includes(query),
      )
      : [...folders];

    list.sort((a, b) => {
      if (folderSort === "name") return a.name.localeCompare(b.name);
      if (folderSort === "notes") {
        return (
          (noteCountByFolder.get(b.id) || 0) -
          (noteCountByFolder.get(a.id) || 0)
        );
      }
      return (
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
      );
    });

    return list;
  }, [folders, searchQuery, folderSort, noteCountByFolder]);

  const recentNotes = useMemo(() => getRecentNotes(notes, 6), [notes]);
  const dueCount = useMemo(() => countDueNotes(notes), [notes]);
  const favoriteCount = useMemo(
    () => notes.filter((n) => n.favorite).length,
    [notes],
  );

  function showWarning(message: string) {
    setWarning(message);
    window.setTimeout(() => setWarning(""), 2600);
  }
  function showSuccess(message: string) {
    setSuccess(message);
    window.setTimeout(() => setSuccess(""), 2600);
  }

  async function addFolder() {
    const cleanName = folderName.trim();
    const cleanKey = keyValue.trim().toUpperCase();
    if (!cleanName || !modifier || !cleanKey) {
      showWarning("Add a folder name, modifier, and key.");
      return;
    }
    if (!availableKeys.includes(cleanKey)) {
      showWarning("That key is not available with the selected modifier.");
      return;
    }
    if (shortcutAlreadyExists) {
      showWarning("That shortcut is already assigned to another folder.");
      return;
    }
    const newFolder = createFolder(cleanName, modifier, cleanKey);
    const updatedFolders = [newFolder, ...folders];
    await saveFolders(updatedFolders);
    setFolders(updatedFolders);
    setFolderName("");
    setModifier("");
    setKeyValue("");
    showSuccess(
      `${cleanName} is ready. Press ${formatShortcut(
        newFolder,
      )} on any webpage to capture notes.`,
    );
  }

  async function confirmDeleteFolder() {
    if (!deleteTarget) return;
    const folderId = deleteTarget.id;
    const updatedFolders = folders.filter((f) => f.id !== folderId);
    const updatedNotes = notes.filter((n) => n.folderId !== folderId);
    await saveFolders(updatedFolders);
    await saveNotes(updatedNotes);
    setFolders(updatedFolders);
    setNotes(updatedNotes);
    const count = notes.filter((n) => n.folderId === folderId).length;
    setDeleteTarget(null);
    showSuccess(
      `"${deleteTarget.name}" and its ${count} ${count === 1 ? "note" : "notes"
      } were deleted.`,
    );
  }

  async function completeOnboarding() {
    const updatedSettings: QuickNotesSettings = {
      ...settings,
      onboardingCompleted: true,
    };
    await saveSettings(updatedSettings);
    setSettings(updatedSettings);
    setShowOnboarding(false);
    setOnboardingStep(0);
  }

  function replayOnboarding() {
    setOnboardingStep(0);
    setShowOnboarding(true);
  }

  const onboardingSteps = [
    {
      icon: Sparkles,
      eyebrow: "Welcome to QuickNotes",
      title: "Capture what matters. Keep it yours.",
      description:
        "Save useful information from anywhere on the web and organize it instantly. Your notes stay on this device.",
    },
    {
      icon: FileText,
      eyebrow: "Step 1",
      title: "Create a shortcut for your workspace.",
      description:
        "Give a folder a keyboard shortcut such as Option + 1. Then use that shortcut whenever you find something worth keeping.",
    },
    {
      icon: FileText,
      eyebrow: "Step 2",
      title: "Highlight. Save. Continue reading.",
      description:
        "Select text on any webpage and QuickNotes captures it without forcing you to leave the page or interrupt your reading flow.",
    },
    {
      icon: ShieldCheck,
      eyebrow: "Step 3",
      title: "Everything stays local.",
      description:
        "There is no account, cloud database, analytics, or tracking. QuickNotes is designed around private, local knowledge capture.",
    },
  ];

  const currentOnboarding = onboardingSteps[onboardingStep];
  const OnboardingIcon = currentOnboarding.icon;

  if (!loaded) {
    return (
      <div className="app loading-screen">
        <div className="loading-card">
          <img src={logo} alt="QuickNotes" className="brand-logo" />
          <div>
            <strong>QuickNotes</strong>
            <span>Preparing your workspace…</span>
          </div>
        </div>
      </div>
    );
  }
  if (route.type === "welcome") {
    return (
      <Landing
        onGetStarted={() => {
          window.location.hash = "";
          void completeOnboarding();
        }}
      />
    );
  }
  if (route.type === "review") {
    return <ReviewPage />;
  }
  if (route.type === "favorites") {
    return <FavoritesPage />;
  }
  if (route.type === "folder" && route.folderId) {
    return <FolderPage folderId={route.folderId} />;
  }



  return (
    <div className="app dashboard-app">
      <header className="navbar">
        <div className="navbar-left">
          <button
            className="brand"
            type="button"
            onClick={() => {
              window.location.hash = "";
            }}
            aria-label="Go to QuickNotes dashboard"
          >
            <img src={logo} alt="" className="brand-logo" />
            <div className="brand-text">
              <h1>QuickNotes</h1>
              <span>Capture · Organize · Revise</span>
            </div>
          </button>
        </div>

        <button
          className="global-search"
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label="Search (Command K)"
        >
          <Search size={15} />
          <span className="global-search-placeholder">
            Search folders or notes…
          </span>
          <kbd>⌘K</kbd>
        </button>

        <div className="navbar-right">
          <button
            className="review-button"
            type="button"
            onClick={() => {
              window.location.hash = "/review";
            }}
            title="Daily review"
          >
            <Flame size={15} />
            Review
            {dueCount > 0 && (
              <span className="nav-count nav-count-warn">{dueCount}</span>
            )}
          </button>
          {(settings.reviewStreak ?? 0) > 0 && (
            <button
              type="button"
              className="navbar-streak"
              onClick={() => {
                window.location.hash = "/review";
              }}
              title={`${settings.reviewStreak}-day review streak`}
            >
              <Flame size={14} />
              <span>{settings.reviewStreak}</span>
            </button>
          )}

          <button
            className="theme-toggle"
            type="button"
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
            className="favorite-button"
            type="button"
            onClick={openFavorites}
          >
            <Heart size={15} />
            Favorites
            {favoriteCount > 0 && (
              <span className="nav-count">{favoriteCount}</span>
            )}
          </button>

                    <button
            className="help-button"
            type="button"
            onClick={() => {
              window.location.hash = "/welcome";
            }}
            aria-label="How QuickNotes works"
            title="How QuickNotes works"
          >
            ?
          </button>
        </div>
      </header>

      <main className="dashboard">
        {(warning || success) && (
          <div
            className={`status-message ${warning ? "status-warning" : "status-success"
              }`}
            role="status"
          >
            {warning ? <X size={16} /> : <Check size={16} />}
            <span>{warning || success}</span>
            <button
              type="button"
              onClick={() => {
                setWarning("");
                setSuccess("");
              }}
              aria-label="Dismiss message"
            >
              <X size={15} />
            </button>
          </div>
        )}

         <section className="dashboard-hero">
          <div className="hero-copy">
            <h2>Dashboard</h2>
            <p>Your knowledge, organized.</p>
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-icon">
                <FileText size={16} />
              </span>
              <div className="stat-body">
                <strong>{notes.length}</strong>
                <span>{notes.length === 1 ? "note" : "notes"}</span>
              </div>
            </div>
            <div className="stat-item">
              <span className="stat-icon">
                <FolderIcon size={16} />
              </span>
              <div className="stat-body">
                <strong>{folders.length}</strong>
                <span>{folders.length === 1 ? "folder" : "folders"}</span>
              </div>
            </div>
            <div className="stat-item">
              <span className="stat-icon">
                <Star size={16} />
              </span>
              <div className="stat-body">
                <strong>{favoriteCount}</strong>
                <span>favorites</span>
              </div>
            </div>
            <div className="stat-item">
              <span className="stat-icon stat-icon-warn">
                <Flame size={16} />
              </span>
              <div className="stat-body">
                <strong>{dueCount}</strong>
                <span>due for review</span>
              </div>
            </div>
          </div>
        </section>

        <section className="create-card">
          <div className="create-header">
            <div>
              <h2>Create a folder</h2>
              <p>
                Give a subject, project, or research area its own shortcut.
              </p>
            </div>
            <div className="privacy-chip">
              <ShieldCheck size={13} />
              Stored locally
            </div>
          </div>

          <div className="folder-form">
            <label className="form-field">
              <span>Folder name</span>
              <input
                type="text"
                placeholder="e.g. UPSC"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addFolder();
                }}
                maxLength={80}
              />
            </label>

            <label className="form-field">
              <span>Modifier</span>
              <select
                value={modifier}
                onChange={(e) => {
                  setModifier(e.target.value as Modifier | "");
                  setKeyValue("");
                }}
              >
                <option value="">Select</option>
                {MODIFIER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Key</span>
              <select
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                disabled={!modifier}
              >
                <option value="">Select</option>
                {availableKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="create-folder-button"
              type="button"
              onClick={() => void addFolder()}
              disabled={
                !folderName.trim() ||
                !modifier ||
                !keyValue ||
                shortcutAlreadyExists
              }
            >
              <Plus size={16} />
              Create folder
            </button>
          </div>

          {shortcutAlreadyExists && (
            <div className="inline-error">
              <X size={14} />
              That shortcut is already assigned. Choose another one.
            </div>
          )}
        </section>

        <section className="workspace-section">
          <div className="section-heading">
            <div>
              <h2>Folders</h2>
              <p>Every workspace you've created lives here.</p>
            </div>

            {folders.length > 0 && (
              <div className="folder-tools">
                <div className="folder-search">
                  <Search size={14} />
                  <input
                    type="search"
                    placeholder="Search folders"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <label className="folder-sort">
                  <BarChart3 size={13} />
                  <select
                    value={folderSort}
                    onChange={(e) =>
                      setFolderSort(e.target.value as FolderSort)
                    }
                  >
                    <option value="recent">Recent</option>
                    <option value="name">Name</option>
                    <option value="notes">Notes</option>
                  </select>
                </label>
              </div>
            )}
          </div>

          {filteredFolders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <FolderIcon size={22} />
              </div>
              <h3>
                {folders.length === 0
                  ? "Your first workspace starts here"
                  : "No folders found"}
              </h3>
              <p>
                {folders.length === 0
                  ? "Create a folder above for a subject, project, or anything you want to remember."
                  : "Try a different folder name."}
              </p>
              {folders.length === 0 && (
                <button
                  type="button"
                  className="empty-action"
                  onClick={() =>
                    document
                      .querySelector<HTMLInputElement>(".folder-form input")
                      ?.focus()
                  }
                >
                  Create your first folder
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="folder-grid">
              {filteredFolders.map((folder) => {
                const folderNotes = notes.filter(
                  (note) => note.folderId === folder.id,
                );
                const latestNote = [...folderNotes].sort(
                  (a, b) =>
                    new Date(b.updatedAt || b.createdAt || b.date).getTime() -
                    new Date(a.updatedAt || a.createdAt || a.date).getTime(),
                )[0];

                return (
                  <article className="folder-card" key={folder.id}>
                    <div className="folder-card-top">
                      <div className="folder-icon">
                        <FolderIcon size={18} />
                      </div>
                      <button
                        className="folder-menu-button"
                        type="button"
                        aria-label={`Actions for ${folder.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenu((current) =>
                            current === folder.id ? null : folder.id,
                          );
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {openMenu === folder.id && (
                        <div
                          className="folder-menu"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenu(null);
                              openFolder(folder.id);
                            }}
                          >
                            <FolderOpen size={14} />
                            Open folder
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenu(null);
                              void exportFolderPDF(folder, notes);
                            }}
                          >
                            <FileText size={14} />
                            Export PDF
                          </button>
                          <button
                            type="button"
                            className="danger-menu-item"
                            onClick={() => {
                              setOpenMenu(null);
                              setDeleteTarget(folder);
                            }}
                          >
                            <Trash2 size={14} />
                            Delete folder
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="folder-card-main"
                      onClick={() => openFolder(folder.id)}
                    >
                      <h3>{folder.name}</h3>
                      <div className="folder-card-meta">
                        <span>
                          {folderNotes.length}{" "}
                          {folderNotes.length === 1 ? "note" : "notes"}
                        </span>
                        <span>{formatShortcut(folder)}</span>
                      </div>

                      {latestNote && (
                        <div className="folder-preview">
                          <span>Latest</span>
                          <p>
                            {latestNote.text.slice(0, 105)}
                            {latestNote.text.length > 105 ? "…" : ""}
                          </p>
                        </div>
                      )}

                      {folder.updatedAt && (
                        <div className="folder-updated">
                          <Clock3 size={12} />
                          Updated {displayDate(folder.updatedAt)}
                        </div>
                      )}
                    </button>

                    <div className="folder-card-actions">
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => openFolder(folder.id)}
                      >
                        <FolderOpen size={14} />
                        Open
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void exportFolderPDF(folder, notes)}
                      >
                        <FileText size={14} />
                        PDF
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="recent-section">
          <div className="section-heading">
            <div>
              <h2>Recently captured</h2>
              <p>Jump back into something you saved recently.</p>
            </div>
          </div>

          {recentNotes.length === 0 ? (
            <div className="recent-empty">
              <div className="recent-empty-icon">
                <FileText size={18} />
              </div>
              <div>
                <strong>Your recent notes will appear here.</strong>
                <span>
                  Open a webpage, highlight something useful, and use your
                  QuickNotes shortcut.
                </span>
              </div>
            </div>
          ) : (
            <div className="recent-list">
              {recentNotes.map((note) => {
                const folder = folders.find(
                  (item) => item.id === note.folderId,
                );
                return (
                  <button
                    key={note.id}
                    type="button"
                    className="recent-note"
                    onClick={() => {
                      if (folder) openFolder(folder.id);
                    }}
                  >
                    <div className="recent-note-icon">
                      <FileText size={15} />
                    </div>
                    <div className="recent-note-content">
                      <strong>{note.title || "Untitled note"}</strong>
                      <p>
                        {note.text.slice(0, 150)}
                        {note.text.length > 150 ? "…" : ""}
                      </p>
                      <span>
                        {folder?.name || "Unassigned"}
                        {" · "}
                        {getDomain(note.url) || "Local note"}
                      </span>
                    </div>
                    <ChevronRight size={15} />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <div>
            <ShieldCheck size={13} />
            <span>Your notes stay on this device.</span>
          </div>
          <button type="button" onClick={replayOnboarding}>
            How QuickNotes works
          </button>
        </footer>
      </main>

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        folders={folders}
        notes={notes}
        onOpenFolder={openFolder}
        onOpenFavorites={openFavorites}
        onCreateFolder={() =>
          document.querySelector<HTMLInputElement>(".folder-form input")?.focus()
        }
      />

      {showOnboarding && (
        <div
          className="onboarding-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
        >
          <div className="onboarding-shell">
            <button
              type="button"
              className="onboarding-close"
              onClick={() => void completeOnboarding()}
              aria-label="Close onboarding"
            >
              <X size={18} />
            </button>

            <div className="onboarding-brand">
              <img src={logo} alt="" className="brand-logo" />
              <strong>QuickNotes</strong>
              <span>
                {onboardingStep + 1}/{onboardingSteps.length}
              </span>
            </div>

            <div className="onboarding-visual">
              <div className="onboarding-icon">
                <OnboardingIcon size={26} />
              </div>

              {onboardingStep === 0 && (
                <div className="onboarding-demo">
                  <div className="demo-toolbar">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="demo-lines">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="demo-save">
                    <Check size={13} />
                    Saved locally
                  </div>
                </div>
              )}

              {onboardingStep === 1 && (
                <div className="shortcut-demo">
                  <span>Your shortcut</span>
                  <div>
                    <kbd>Option</kbd>
                    <b>+</b>
                    <kbd>1</kbd>
                  </div>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="capture-demo">
                  <div className="demo-lines">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="capture-pill">
                    <Check size={13} />
                    Note saved
                  </div>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="privacy-demo">
                  <Lock size={26} />
                  <strong>Local by design</strong>
                  <span>No account · No cloud · No tracking</span>
                </div>
              )}
            </div>

            <div className="onboarding-copy">
              <div className="onboarding-eyebrow">
                {currentOnboarding.eyebrow}
              </div>
              <h2 id="onboarding-title">{currentOnboarding.title}</h2>
              <p>{currentOnboarding.description}</p>
            </div>

            <div className="onboarding-progress">
              {onboardingSteps.map((_, index) => (
                <span
                  key={index}
                  className={index === onboardingStep ? "active" : ""}
                />
              ))}
            </div>

            <div className="onboarding-actions">
              {onboardingStep > 0 ? (
                <button
                  type="button"
                  className="onboarding-back"
                  onClick={() =>
                    setOnboardingStep((current) => Math.max(0, current - 1))
                  }
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  className="onboarding-skip"
                  onClick={() => void completeOnboarding()}
                >
                  Skip
                </button>
              )}

              <button
                type="button"
                className="onboarding-next"
                onClick={() => {
                  if (onboardingStep < onboardingSteps.length - 1) {
                    setOnboardingStep((current) => current + 1);
                  } else {
                    void completeOnboarding();
                  }
                }}
              >
                {onboardingStep < onboardingSteps.length - 1
                  ? "Continue"
                  : "Start capturing"}
                <ArrowRight size={15} />
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
          aria-labelledby="delete-folder-title"
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

            <h2 id="delete-folder-title">Delete "{deleteTarget.name}"?</h2>

            <p>
              This will permanently delete this folder and{" "}
              <strong>
                {notes.filter((n) => n.folderId === deleteTarget.id).length}{" "}
                associated{" "}
                {notes.filter((n) => n.folderId === deleteTarget.id).length === 1
                  ? "note"
                  : "notes"}
              </strong>
              . Other folders, including folders with the same name, will
              remain untouched.
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
                onClick={() => void confirmDeleteFolder()}
              >
                <Trash2 size={14} />
                Delete folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}