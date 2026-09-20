/*
 * QuickNotes Background Service Worker
 *
 * Responsibilities:
 * - Save captured notes
 * - Read/write local extension storage
 * - Resolve folder IDs safely
 * - Maintain compatibility with older QuickNotes data
 * - Initialize non-destructive defaults
 *
 * Local-first.
 * No network requests.
 * No analytics.
 * No tracking.
 * No user account.
 */

"use strict";

/* -------------------------------------------------------------------------- */
/* Defaults                                                                   */
/* -------------------------------------------------------------------------- */

const STORAGE_DEFAULTS = {
    onboardingCompleted: false,
};

/* -------------------------------------------------------------------------- */
/* Chrome storage helpers                                                     */
/* -------------------------------------------------------------------------- */

function getStorage(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(
            keys,
            (result) => {
                if (chrome.runtime.lastError) {
                    reject(
                        new Error(
                            chrome.runtime.lastError.message
                        )
                    );
                    return;
                }

                resolve(result || {});
            }
        );
    });
}

function setStorage(values) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(
            values,
            () => {
                if (chrome.runtime.lastError) {
                    reject(
                        new Error(
                            chrome.runtime.lastError.message
                        )
                    );
                    return;
                }

                resolve();
            }
        );
    });
}

/* -------------------------------------------------------------------------- */
/* General helpers                                                            */
/* -------------------------------------------------------------------------- */

function createId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}-${Math.random()
        .toString(36)
        .slice(2)}`;
}

function now() {
    return new Date().toISOString();
}

function cleanString(value) {
    return typeof value === "string"
        ? value.trim()
        : "";
}

function normaliseName(value) {
    return cleanString(value).toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Folder resolution                                                          */
/* -------------------------------------------------------------------------- */

function findFolderById(
    folders,
    folderId
) {
    const id = cleanString(
        folderId
    );

    if (!id || !Array.isArray(folders)) {
        return null;
    }

    return (
        folders.find(
            (folder) =>
                folder &&
                folder.id === id
        ) || null
    );
}

function findFolderByName(
    folders,
    folderName
) {
    const name =
        normaliseName(folderName);

    if (
        !name ||
        !Array.isArray(folders)
    ) {
        return null;
    }

    return (
        folders.find(
            (folder) =>
                folder &&
                normaliseName(
                    folder.name
                ) === name
        ) || null
    );
}

function resolveFolder(
    folders,
    requestedFolderId,
    requestedFolderName
) {
    /*
     * Prefer the canonical folder ID.
     */
    const folderById =
        findFolderById(
            folders,
            requestedFolderId
        );

    if (folderById) {
        return {
            id: folderById.id,
            name: folderById.name,
        };
    }

    /*
     * Fall back to the old folder-name
     * representation used by earlier versions.
     */
    const folderByName =
        findFolderByName(
            folders,
            requestedFolderName
        );

    if (folderByName) {
        return {
            id: folderByName.id,
            name: folderByName.name,
        };
    }

    /*
     * Preserve the historical General fallback.
     */
    const generalFolder =
        findFolderByName(
            folders,
            "General"
        );

    if (generalFolder) {
        return {
            id: generalFolder.id,
            name: generalFolder.name,
        };
    }

    /*
     * If General does not exist, don't invent
     * a folder ID. The note remains recoverable
     * through its legacy folder name.
     */
    return {
        id: null,
        name: "General",
    };
}

/* -------------------------------------------------------------------------- */
/* Note creation                                                              */
/* -------------------------------------------------------------------------- */

function createNote(message, sender, folder) {
    const timestamp = now();

    const text =
        cleanString(message.text);

    const url =
        cleanString(message.url) ||
        cleanString(
            sender?.tab?.url
        );

    const title =
        cleanString(message.title) ||
        cleanString(
            sender?.tab?.title
        );

    return {
        id: createId(),

        parentId: null,

        /*
         * Canonical folder identity.
         */
        folderId:
            folder.id,

        /*
         * Legacy folder field.
         *
         * Keeping this makes old versions of
         * QuickNotes compatible with new notes.
         */
        folder:
            folder.name,

        text,

        url,

        title,

        date: timestamp,

        createdAt:
            timestamp,

        updatedAt:
            timestamp,

        favorite: false,
    };
}

/* -------------------------------------------------------------------------- */
/* Save note                                                                  */
/* -------------------------------------------------------------------------- */

async function saveNote(
    message,
    sender
) {
    if (
        !message ||
        typeof message.text !== "string" ||
        !message.text.trim()
    ) {
        return {
            success: false,
            error:
                "Note text is empty.",
        };
    }

    const result =
        await getStorage([
            "notes",
            "folders",
        ]);

    const notes =
        Array.isArray(result.notes)
            ? result.notes
            : [];

    const folders =
        Array.isArray(result.folders)
            ? result.folders
            : [];

    const folder =
        resolveFolder(
            folders,
            message.folderId,
            message.folder
        );

    const note =
        createNote(
            message,
            sender,
            folder
        );

    notes.push(note);

    await setStorage({
        notes,
    });

    return {
        success: true,
        note,
    };
}

/* -------------------------------------------------------------------------- */
/* Installation / update                                                      */
/* -------------------------------------------------------------------------- */

chrome.runtime.onInstalled.addListener(
    async () => {
        try {
            const existing =
                await getStorage([
                    "onboardingCompleted",
                ]);

            const values = {};

            if (
                typeof existing.onboardingCompleted !==
                "boolean"
            ) {
                values.onboardingCompleted =
                    STORAGE_DEFAULTS.onboardingCompleted;
            }

            if (
                Object.keys(values)
                    .length > 0
            ) {
                await setStorage(
                    values
                );
            }
        } catch (error) {
            console.error(
                "QuickNotes initialization failed:",
                error
            );
        }
    }
);

/* -------------------------------------------------------------------------- */
/* Runtime messages                                                           */
/* -------------------------------------------------------------------------- */

chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {
        if (
            !message ||
            typeof message.action !==
                "string"
        ) {
            return false;
        }

        /* ------------------------------------------------------------------ */
        /* Save captured text                                                 */
        /* ------------------------------------------------------------------ */

        if (
            message.action ===
            "saveText"
        ) {
            saveNote(
                message,
                sender
            )
                .then(
                    (result) => {
                        sendResponse(
                            result
                        );
                    }
                )
                .catch(
                    (error) => {
                        console.error(
                            "QuickNotes save error:",
                            error
                        );

                        sendResponse({
                            success:
                                false,
                            error:
                                error?.message ||
                                "Could not save note.",
                        });
                    }
                );

            /*
             * The response is asynchronous.
             */
            return true;
        }

        /* ------------------------------------------------------------------ */
        /* Read storage                                                        */
        /* ------------------------------------------------------------------ */

        if (
            message.action ===
            "getStorage"
        ) {
            const keys =
                Array.isArray(
                    message.keys
                )
                    ? message.keys
                    : [];

            getStorage(keys)
                .then(
                    (data) => {
                        sendResponse({
                            success:
                                true,
                            data,
                        });
                    }
                )
                .catch(
                    (error) => {
                        console.error(
                            "QuickNotes storage read error:",
                            error
                        );

                        sendResponse({
                            success:
                                false,
                            error:
                                error?.message ||
                                "Could not read storage.",
                        });
                    }
                );

            return true;
        }

        /* ------------------------------------------------------------------ */
        /* Write storage                                                       */
        /* ------------------------------------------------------------------ */

        if (
            message.action ===
            "setStorage"
        ) {
            const values =
                message.values;

            if (
                !values ||
                typeof values !==
                    "object" ||
                Array.isArray(values)
            ) {
                sendResponse({
                    success: false,
                    error:
                        "Invalid storage values.",
                });

                return false;
            }

            setStorage(values)
                .then(() => {
                    sendResponse({
                        success: true,
                    });
                })
                .catch(
                    (error) => {
                        console.error(
                            "QuickNotes storage write error:",
                            error
                        );

                        sendResponse({
                            success:
                                false,
                            error:
                                error?.message ||
                                "Could not write storage.",
                        });
                    }
                );

            return true;
        }

        /*
         * Unknown message.
         *
         * Returning false tells Chrome that this
         * listener is not handling it.
         */
        return false;
    }
);