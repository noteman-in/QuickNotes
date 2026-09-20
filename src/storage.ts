export type Modifier =
    | "Shift"
    | "Option"
    | "Ctrl"
    | "⌘"
    | "None";

export interface Folder {
    id: string;
    name: string;
    modifier: Modifier;
    key: string;
    createdAt: string;
    updatedAt: string;
    recovery?: boolean;
}

export interface Note {
    id: string;
    folderId: string;
    parentId: string | null;
    text: string;
    title: string;
    url: string;
    domain?: string;
    createdAt: string;
    updatedAt: string;
    date: string;
    favorite: boolean;
    legacyFolderName?: string;
    /* --- review fields --- */
    lastReviewedAt?: string;
    reviewCount?: number;
    archivedAt?: string;
}

export interface QuickNotesSettings {
    onboardingCompleted: boolean;
    notifications: boolean;
    autoOpenPopup: boolean;
    startWithSystem: boolean;
    /* --- review fields --- */
    reviewStreak?: number;
    lastReviewDate?: string;
}

export interface QuickNotesSession {
    active: boolean;
    folderId: string | null;
    noteId: string | null;
    highlights: number;
    status: string;
}

export interface QuickNotesStorage {
    folders: Folder[];
    notes: Note[];
    settings: QuickNotesSettings;
    quicknotesSession?: QuickNotesSession;
    migrationVersion: number;
}

export interface LegacyFolder {
    id?: string;
    name: string;
    modifier: string;
    key: string;
    createdAt?: string;
    updatedAt?: string;
    recovery?: boolean;
}

export interface LegacyNote {
    id: string;
    parentId?: string | null;
    folder?: string;
    folderId?: string;
    text: string;
    url: string;
    title: string;
    date?: string;
    createdAt?: string;
    updatedAt?: string;
    favorite?: boolean;
    domain?: string;
    [key: string]: unknown;
}

const MIGRATION_VERSION = 3;

const DEFAULT_SETTINGS: QuickNotesSettings = {
    onboardingCompleted: false,
    notifications: true,
    autoOpenPopup: false,
    startWithSystem: false,
    reviewStreak: 0,
    lastReviewDate: "",
};

/* -------------------------------------------------------------------------- */
/* Storage bridge                                                              */
/* -------------------------------------------------------------------------- */

const LOCAL_STORAGE_PREFIX = "quicknotes:";

function hasChromeStorage(): boolean {
    return (
        typeof chrome !== "undefined" &&
        Boolean(chrome.storage?.local)
    );
}

async function readLocal(
    keys: string[],
): Promise<Record<string, unknown>> {
    if (hasChromeStorage()) {
        return chrome.storage.local.get(keys);
    }

    return keys.reduce<Record<string, unknown>>(
        (result, key) => {
            try {
                const raw = window.localStorage.getItem(
                    `${LOCAL_STORAGE_PREFIX}${key}`,
                );

                if (raw !== null) {
                    result[key] = JSON.parse(raw);
                }
            } catch {
                // Treat unavailable or malformed preview values as empty.
            }

            return result;
        },
        {},
    );
}

async function writeLocal(
    values: Record<string, unknown>,
): Promise<void> {
    if (hasChromeStorage()) {
        await chrome.storage.local.set(values);
        return;
    }

    Object.entries(values).forEach(([key, value]) => {
        try {
            window.localStorage.setItem(
                `${LOCAL_STORAGE_PREFIX}${key}`,
                JSON.stringify(value),
            );
        } catch {
            // Storage can be disabled in a preview; callers remain non-fatal.
        }
    });
}

export function isExtensionStorageAvailable(): boolean {
    return hasChromeStorage();
}

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

function uuid(): string {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function nowIso(): string {
    return new Date().toISOString();
}

function normaliseName(value: unknown): string {
    return String(value ?? "")
        .trim()
        .toLowerCase();
}

function toIso(
    value: unknown,
    fallback: string,
): string {
    if (typeof value === "string" && value.trim()) {
        const parsed = new Date(value);

        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString();
        }
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        const parsed = new Date(value);

        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString();
        }
    }

    return fallback;
}

function domainFromUrl(
    value: unknown,
): string | undefined {
    if (
        typeof value !== "string" ||
        !value.trim()
    ) {
        return undefined;
    }

    try {
        return new URL(value)
            .hostname
            .replace(/^www\./, "");
    } catch {
        return undefined;
    }
}

function isModifier(
    value: unknown,
): value is Modifier {
    return (
        value === "Shift" ||
        value === "Option" ||
        value === "Ctrl" ||
        value === "⌘" ||
        value === "None"
    );
}

function normaliseModifier(
    value: unknown,
): Modifier {
    if (isModifier(value)) {
        return value;
    }

    switch (value) {
        case "Command":
            return "⌘";

        case "Alt":
            return "Option";

        default:
            return "None";
    }
}

/* -------------------------------------------------------------------------- */
/* Recovery / migration helpers                                               */
/* -------------------------------------------------------------------------- */

function makeRecoveryFolder(
    name: string,
): Folder {
    const timestamp = nowIso();

    return {
        id: uuid(),
        name: `Recovered · ${name || "Unassigned"}`,
        modifier: "None",
        key: "",
        createdAt: timestamp,
        updatedAt: timestamp,
        recovery: true,
    };
}

function ensureUniqueFolderIds(
    rawFolders: LegacyFolder[],
): Folder[] {
    const usedIds = new Set<string>();
    const timestamp = nowIso();

    return rawFolders.map((raw) => {
        let id =
            typeof raw.id === "string" &&
                raw.id.trim()
                ? raw.id.trim()
                : uuid();

        while (usedIds.has(id)) {
            id = uuid();
        }

        usedIds.add(id);

        const createdAt = toIso(
            raw.createdAt,
            timestamp,
        );

        const updatedAt = toIso(
            raw.updatedAt,
            createdAt,
        );

        return {
            id,

            name:
                String(raw.name ?? "").trim() ||
                "Untitled",

            modifier:
                normaliseModifier(raw.modifier),

            key:
                String(raw.key ?? "")
                    .trim()
                    .toUpperCase(),

            createdAt,

            updatedAt,

            ...(raw.recovery
                ? { recovery: true }
                : {}),
        };
    });
}

function migrateNotes(
    rawNotes: LegacyNote[],
    folders: Folder[],
): {
    notes: Note[];
    folders: Folder[];
    changed: boolean;
} {
    const workingFolders = [...folders];

    const foldersByName =
        new Map<string, Folder[]>();

    for (const folder of workingFolders) {
        const key = normaliseName(folder.name);

        const matches =
            foldersByName.get(key) ?? [];

        matches.push(folder);
        foldersByName.set(key, matches);
    }

    const recoveryByName =
        new Map<string, Folder>();

    const usedNoteIds =
        new Set<string>();

    let changed = false;

    const notes = rawNotes.map((raw) => {
        const createdAt = toIso(
            raw.createdAt ?? raw.date,
            nowIso(),
        );

        const updatedAt = toIso(
            raw.updatedAt ?? raw.date,
            createdAt,
        );

        let folderId =
            typeof raw.folderId === "string" &&
                raw.folderId.trim()
                ? raw.folderId.trim()
                : "";

        /*
         * First try the existing folderId.
         */
        if (
            folderId &&
            !workingFolders.some(
                (folder) => folder.id === folderId,
            )
        ) {
            folderId = "";
            changed = true;
        }

        /*
         * Older versions of QuickNotes stored the
         * folder name instead of folderId.
         */
        if (!folderId) {
            const legacyName =
                normaliseName(raw.folder);

            if (legacyName) {
                const matches =
                    foldersByName.get(legacyName) ?? [];

                if (matches.length === 1) {
                    folderId = matches[0].id;
                } else if (matches.length > 1) {
                    let recovery =
                        recoveryByName.get(
                            legacyName,
                        );

                    if (!recovery) {
                        recovery =
                            makeRecoveryFolder(
                                String(
                                    raw.folder ??
                                    "Unassigned",
                                ),
                            );

                        recoveryByName.set(
                            legacyName,
                            recovery,
                        );

                        workingFolders.push(
                            recovery,
                        );
                    }

                    folderId = recovery.id;
                }
            }
        }

        /*
         * Never silently discard notes which cannot
         * be matched to a real folder.
         */
        if (!folderId) {
            const recoveryKey =
                "__unassigned__";

            let recovery =
                recoveryByName.get(
                    recoveryKey,
                );

            if (!recovery) {
                recovery =
                    makeRecoveryFolder(
                        "Unassigned",
                    );

                recoveryByName.set(
                    recoveryKey,
                    recovery,
                );

                workingFolders.push(
                    recovery,
                );
            }

            folderId = recovery.id;
        }

        /*
         * Repair duplicate or missing note IDs.
         */
        let id =
            typeof raw.id === "string" &&
                raw.id.trim()
                ? raw.id.trim()
                : uuid();

        while (usedNoteIds.has(id)) {
            id = uuid();
        }

        usedNoteIds.add(id);

        const parentId =
            typeof raw.parentId === "string" &&
                raw.parentId.trim() &&
                raw.parentId !== id
                ? raw.parentId.trim()
                : null;

        const note: Note = {
            id,

            folderId,

            parentId,

            text:
                String(raw.text ?? ""),

            title:
                String(raw.title ?? "").trim() ||
                "Untitled note",

            url:
                String(raw.url ?? ""),

            domain:
                typeof raw.domain === "string" &&
                    raw.domain.trim()
                    ? raw.domain.trim()
                    : domainFromUrl(raw.url),

            createdAt,

            updatedAt,

            date:
                typeof raw.date === "string" &&
                    raw.date.trim()
                    ? raw.date
                    : new Date(
                        createdAt,
                    ).toLocaleString(),

            favorite:
                Boolean(raw.favorite),

            ...(typeof raw.folder === "string" &&
                raw.folder.trim()
                ? {
                    legacyFolderName:
                        raw.folder.trim(),
                }
                : {}),
        };

        if (
            !raw.folderId ||
            raw.folder !== undefined ||
            raw.createdAt === undefined ||
            raw.updatedAt === undefined ||
            raw.domain === undefined ||
            raw.favorite === undefined
        ) {
            changed = true;
        }

        return note;
    });

    /*
     * Validate parent relationships.
     *
     * Rules:
     *  - Parent must exist and live in the same folder.
     *  - A note may only have a single parent.
     *  - Nesting is limited to one level:
     *      top-level note -> child note
     *    Child notes cannot themselves have children,
     *    so any grandchild relationship is flattened.
     *  - Cycles are impossible once depth is capped,
     *    but we still guard against self-parenting.
     */
    const noteMap = new Map<string, Note>();

    for (const note of notes) {
        noteMap.set(note.id, note);
    }

    for (const note of notes) {
        if (!note.parentId) {
            continue;
        }

        // Self-parenting is invalid.
        if (note.parentId === note.id) {
            note.parentId = null;
            changed = true;
            continue;
        }

        const parent = noteMap.get(note.parentId);

        if (!parent || parent.folderId !== note.folderId) {
            note.parentId = null;
            changed = true;
            continue;
        }

        /*
         * Enforce single-level nesting.
         * If the chosen parent is itself a child, we
         * cannot nest under it — promote the note back
         * to top level instead of silently keeping an
         * invalid grandchild relationship.
         */
        if (parent.parentId) {
            note.parentId = null;
            changed = true;
        }
    }

    return {
        notes,
        folders: workingFolders,
        changed,
    };
}

/* -------------------------------------------------------------------------- */
/* Main storage API                                                           */
/* -------------------------------------------------------------------------- */

export async function migrateStorage(): Promise<QuickNotesStorage> {
    const raw =
        await readLocal([
            "folders",
            "notes",
            "settings",
            "quicknotesSession",
            "migrationVersion",
        ]);

    const rawFolders =
        Array.isArray(raw.folders)
            ? (raw.folders as LegacyFolder[])
            : [];

    const rawNotes =
        Array.isArray(raw.notes)
            ? (raw.notes as LegacyNote[])
            : [];

    const folders =
        ensureUniqueFolderIds(
            rawFolders,
        );

    const migrated =
        migrateNotes(
            rawNotes,
            folders,
        );

    const settings: QuickNotesSettings = {
        ...DEFAULT_SETTINGS,

        ...(raw.settings &&
            typeof raw.settings === "object"
            ? (raw.settings as Partial<QuickNotesSettings>)
            : {}),
    };

    const session =
        raw.quicknotesSession &&
            typeof raw.quicknotesSession === "object"
            ? (raw.quicknotesSession as QuickNotesSession)
            : undefined;

    const migrationVersion =
        Number(
            raw.migrationVersion ?? 0,
        );

    const foldersNeedRepair =
        rawFolders.some(
            (folder) =>
                typeof folder.id !== "string" ||
                typeof folder.createdAt !== "string" ||
                typeof folder.updatedAt !== "string",
        );

    const notesNeedRepair =
        rawNotes.some(
            (note) =>
                typeof note.folderId !== "string" ||
                typeof note.createdAt !== "string" ||
                typeof note.updatedAt !== "string",
        );

    const needsWrite =
        migrationVersion < MIGRATION_VERSION ||
        migrated.changed ||
        raw.settings === undefined ||
        foldersNeedRepair ||
        notesNeedRepair;

    const storage: QuickNotesStorage = {
        folders: migrated.folders,

        notes: migrated.notes,

        settings,

        ...(session
            ? {
                quicknotesSession:
                    session,
            }
            : {}),

        migrationVersion:
            MIGRATION_VERSION,
    };

    if (needsWrite) {
        await writeLocal({
            folders: storage.folders,
            notes: storage.notes,
            settings: storage.settings,
            quicknotesSession:
                storage.quicknotesSession,
            migrationVersion:
                storage.migrationVersion,
        });
    }

    return storage;
}

export async function getStorage(): Promise<QuickNotesStorage> {
    return migrateStorage();
}

/* -------------------------------------------------------------------------- */
/* Persistence                                                                */
/* -------------------------------------------------------------------------- */

export async function saveFolders(
    folders: Folder[],
): Promise<void> {
    await writeLocal({
        folders,
    });
}

export async function saveNotes(
    notes: Note[],
): Promise<void> {
    await writeLocal({
        notes,
    });
}

export async function saveSettings(
    settings: QuickNotesSettings,
): Promise<void> {
    await writeLocal({
        settings,
    });
}

/* -------------------------------------------------------------------------- */
/* Factory helpers                                                            */
/* -------------------------------------------------------------------------- */

export function createFolder(
    name: string,
    modifier: Modifier,
    key: string,
): Folder {
    const timestamp = nowIso();

    return {
        id: uuid(),

        name:
            name.trim(),

        modifier,

        key:
            key
                .trim()
                .toUpperCase(),

        createdAt:
            timestamp,

        updatedAt:
            timestamp,
    };
}

export function createNote(input: {
    folderId: string;
    text: string;
    title: string;
    url: string;
    parentId?: string | null;
}): Note {
    const timestamp = nowIso();

    return {
        id: uuid(),

        folderId:
            input.folderId,

        parentId:
            input.parentId ?? null,

        text:
            input.text.trim(),

        title:
            input.title.trim() ||
            "Untitled note",

        url:
            input.url,

        domain:
            domainFromUrl(input.url),

        createdAt:
            timestamp,

        updatedAt:
            timestamp,

        date:
            new Date(
                timestamp,
            ).toLocaleString(),

        favorite: false,
    };
}

/* -------------------------------------------------------------------------- */
/* Display / shortcut helpers                                                 */
/* -------------------------------------------------------------------------- */

export function formatShortcut(
    folder: Folder,
): string {
    if (
        folder.modifier === "None"
    ) {
        return "Recovery only";
    }

    return `${folder.modifier} + ${folder.key}`;
}

export function folderShortcutKey(
    folder: Pick<
        Folder,
        "modifier" | "key"
    >,
): string {
    return `${folder.modifier}:${folder.key
        .trim()
        .toUpperCase()}`;
}

export function displayDate(
    value: string,
): string {
    const parsed =
        new Date(value);

    if (
        Number.isNaN(
            parsed.getTime(),
        )
    ) {
        return value;
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            dateStyle: "medium",
            timeStyle: "short",
        },
    ).format(parsed);
}
/* -------------------------------------------------------------------------- */
/* Review helpers                                                             */
/* -------------------------------------------------------------------------- */

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * A note is eligible for review if it exists and hasn't been archived.
 * We don't include notes created less than a day ago — they're too fresh.
 */
export function isReviewEligible(note: Note, now = Date.now()): boolean {
    if (note.archivedAt) return false;
    const reference = note.lastReviewedAt || note.createdAt || note.date;
    const t = new Date(reference).getTime();
    if (Number.isNaN(t)) return false;
    return (now - t) / DAY_MS >= 1;
}

/**
 * Simple spaced-repetition scoring.
 *
 *   score = daysSinceReview × (favorite ? 1.5 : 1) / (reviewCount + 1)^0.8
 *
 * - Older notes score higher
 * - Favorites get a boost
 * - Frequently-reviewed notes decay
 */
export function getReviewScore(note: Note, now = Date.now()): number {
    const reference = note.lastReviewedAt || note.createdAt || note.date;
    const t = new Date(reference).getTime();
    if (Number.isNaN(t)) return 0;

    const days = Math.max(1, (now - t) / DAY_MS);
    const reviewCount = note.reviewCount ?? 0;

    let score = days;
    if (note.favorite) score *= 1.5;
    score /= Math.pow(reviewCount + 1, 0.8);
    return score;
}

/**
 * Build a review queue from a set of notes.
 * Notes are ranked by score, most "due" first.
 */
export function buildReviewQueue(
    notes: Note[],
    size = 8,
    now = Date.now(),
): Note[] {
    return notes
        .filter((n) => isReviewEligible(n, now))
        .map((n) => ({ note: n, score: getReviewScore(n, now) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, size)
        .map((item) => item.note);
}

export function countDueNotes(notes: Note[], now = Date.now()): number {
    return notes.filter((n) => isReviewEligible(n, now)).length;
}

/**
 * Advance the streak based on today's date vs. the last review date.
 * Returns the updated settings object — the caller persists it.
 */
export function advanceReviewStreak(
    settings: QuickNotesSettings,
): QuickNotesSettings {
    const today = new Date().toISOString().slice(0, 10);
    const last = settings.lastReviewDate || "";
    const current = settings.reviewStreak ?? 0;

    if (last === today) return settings;

    const yesterday = new Date(Date.now() - DAY_MS)
        .toISOString()
        .slice(0, 10);

    const nextStreak = last === yesterday ? current + 1 : 1;

    return {
        ...settings,
        reviewStreak: nextStreak,
        lastReviewDate: today,
    };
}
/* -------------------------------------------------------------------------- */
/* Chrome storage typing                                                      */
/* -------------------------------------------------------------------------- */

declare const chrome: {
    storage: {
        local: {
            get(
                keys?:
                    | string[]
                    | Record<string, unknown>,
            ): Promise<
                Record<string, any>
            >;

            set(
                items: Record<
                    string,
                    unknown
                >,
            ): Promise<void>;
        };
    };
};