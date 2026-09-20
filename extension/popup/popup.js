/*
 * QuickNotes Popup
 *
 * Responsibilities:
 * - Show the latest saved note
 * - Resolve folders through folderId
 * - Support legacy folder names
 * - Open the dashboard
 * - Open the note's folder
 * - Delete the latest note
 * - Stay synchronized with Chrome storage
 *
 * Local-only. No network requests.
 */

"use strict";

/* -------------------------------------------------------------------------- */
/* DOM                                                                        */
/* -------------------------------------------------------------------------- */

const openButton =
  document.getElementById("open");

const preview =
  document.getElementById(
    "previewText"
  );

const folder =
  document.getElementById(
    "previewFolder"
  );

const date =
  document.getElementById(
    "previewDate"
  );

const deleteButton =
  document.getElementById("delete");

const openFolderButton =
  document.getElementById(
    "openFolder"
  );

let latestNote = null;
let latestFolder = null;

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

function getDashboardUrl(
  hash = ""
) {
  return (
    chrome.runtime.getURL(
      "dist/index.html"
    ) + hash
  );
}

function openDashboard() {
  chrome.tabs.create(
    {
      url: getDashboardUrl(),
    },
    () => {
      if (
        chrome.runtime.lastError
      ) {
        console.error(
          "QuickNotes dashboard error:",
          chrome.runtime.lastError
        );
      }

      window.close();
    }
  );
}

function openFolderPage(
  folderId
) {
  if (!folderId) {
    return;
  }

  const encodedId =
    encodeURIComponent(
      folderId
    );

  chrome.tabs.create(
    {
      url: getDashboardUrl(
        `#/folder/${encodedId}`
      ),
    },
    () => {
      if (
        chrome.runtime.lastError
      ) {
        console.error(
          "QuickNotes folder navigation error:",
          chrome.runtime.lastError
        );
      }

      window.close();
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Folder helpers                                                             */
/* -------------------------------------------------------------------------- */

function getFolderById(
  folders,
  folderId
) {
  if (
    !Array.isArray(folders) ||
    !folderId
  ) {
    return null;
  }

  return (
    folders.find(
      (item) =>
        item &&
        item.id === folderId
    ) || null
  );
}

function getFolderByName(
  folders,
  name
) {
  if (
    !Array.isArray(folders) ||
    typeof name !== "string" ||
    !name.trim()
  ) {
    return null;
  }

  const normalized =
    name.trim().toLowerCase();

  return (
    folders.find(
      (item) =>
        item &&
        typeof item.name ===
          "string" &&
        item.name
          .trim()
          .toLowerCase() ===
          normalized
    ) || null
  );
}

function resolveNoteFolder(
  note,
  folders
) {
  if (!note) {
    return null;
  }

  const folderById =
    getFolderById(
      folders,
      note.folderId
    );

  if (folderById) {
    return folderById;
  }

  return getFolderByName(
    folders,
    note.folder
  );
}

/* -------------------------------------------------------------------------- */
/* Date / note helpers                                                        */
/* -------------------------------------------------------------------------- */

function getNoteTimestamp(
  note
) {
  if (!note) {
    return 0;
  }

  const value =
    note.createdAt ||
    note.updatedAt ||
    note.date;

  const timestamp =
    new Date(value || 0).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

function formatDate(value) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return "--";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(parsed);
}

/* -------------------------------------------------------------------------- */
/* UI state                                                                   */
/* -------------------------------------------------------------------------- */

function setEmptyState() {
  latestNote = null;
  latestFolder = null;

  if (preview) {
    preview.textContent =
      "No recently saved note.";
  }

  if (folder) {
    folder.textContent =
      "No Folder";
  }

  if (date) {
    date.textContent = "--";
  }

  if (deleteButton) {
    deleteButton.disabled = true;
  }

  if (openFolderButton) {
    openFolderButton.disabled = true;
  }
}

function setLoadingState() {
  if (preview) {
    preview.textContent =
      "Loading your latest note…";
  }

  if (folder) {
    folder.textContent =
      "Loading folder…";
  }

  if (date) {
    date.textContent = "--";
  }

  if (deleteButton) {
    deleteButton.disabled = true;
  }

  if (openFolderButton) {
    openFolderButton.disabled = true;
  }
}

function setPreview(
  note,
  noteFolder
) {
  latestNote = note;
  latestFolder =
    noteFolder;

  if (preview) {
    preview.textContent =
      note?.text ||
      "No note content.";
  }

  if (folder) {
    folder.textContent =
      noteFolder
        ? `Folder • ${noteFolder.name}`
        : "Folder • Unassigned";
  }

  if (date) {
    date.textContent =
      formatDate(
        note?.createdAt ||
          note?.date
      );
  }

  if (deleteButton) {
    deleteButton.disabled =
      false;
  }

  if (openFolderButton) {
    openFolderButton.disabled =
      !noteFolder?.id;
  }
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

function getStorage(
  callback
) {
  chrome.storage.local.get(
    [
      "notes",
      "folders",
    ],
    (result) => {
      if (
        chrome.runtime.lastError
      ) {
        console.error(
          "QuickNotes storage error:",
          chrome.runtime.lastError
        );

        callback(
          null,
          chrome.runtime.lastError
        );

        return;
      }

      callback(
        {
          notes:
            Array.isArray(
              result.notes
            )
              ? result.notes
              : [],

          folders:
            Array.isArray(
              result.folders
            )
              ? result.folders
              : [],
        },
        null
      );
    }
  );
}

function findLatestNote(
  notes
) {
  if (
    !Array.isArray(notes) ||
    notes.length === 0
  ) {
    return null;
  }

  return [...notes].sort(
    (first, second) =>
      getNoteTimestamp(
        second
      ) -
      getNoteTimestamp(
        first
      )
  )[0];
}

/* -------------------------------------------------------------------------- */
/* Load latest note                                                           */
/* -------------------------------------------------------------------------- */

function loadLatestNote() {
  setLoadingState();

  getStorage(
    (storage, error) => {
      if (error || !storage) {
        setEmptyState();
        return;
      }

      const latestNote =
        findLatestNote(
          storage.notes
        );

      if (!latestNote) {
        setEmptyState();
        return;
      }

      const latestFolder =
        resolveNoteFolder(
          latestNote,
          storage.folders
        );

      setPreview(
        latestNote,
        latestFolder
      );
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

function deleteLatestNote() {
  if (!latestNote?.id) {
    return;
  }

  if (deleteButton) {
    deleteButton.disabled =
      true;
  }

  chrome.storage.local.get(
    ["notes"],
    (result) => {
      if (
        chrome.runtime.lastError
      ) {
        console.error(
          "QuickNotes note read error:",
          chrome.runtime.lastError
        );

        if (deleteButton) {
          deleteButton.disabled =
            false;
        }

        return;
      }

      const notes =
        Array.isArray(
          result.notes
        )
          ? result.notes
          : [];

      const targetId =
        latestNote.id;

      const updatedNotes =
        notes.filter(
          (note) =>
            note?.id !== targetId
        );

      chrome.storage.local.set(
        {
          notes: updatedNotes,
        },
        () => {
          if (
            chrome.runtime.lastError
          ) {
            console.error(
              "QuickNotes note delete error:",
              chrome.runtime.lastError
            );

            if (deleteButton) {
              deleteButton.disabled =
                false;
            }

            return;
          }

          latestNote = null;
          latestFolder = null;

          loadLatestNote();
        }
      );
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Event listeners                                                            */
/* -------------------------------------------------------------------------- */

if (openButton) {
  openButton.addEventListener(
    "click",
    openDashboard
  );
}

if (openFolderButton) {
  openFolderButton.addEventListener(
    "click",
    () => {
      if (
        !latestNote ||
        !latestFolder?.id
      ) {
        return;
      }

      openFolderPage(
        latestFolder.id
      );
    }
  );
}

if (deleteButton) {
  deleteButton.addEventListener(
    "click",
    deleteLatestNote
  );
}

/* -------------------------------------------------------------------------- */
/* Live storage synchronization                                               */
/* -------------------------------------------------------------------------- */

function handleStorageChange(
  changes,
  areaName
) {
  if (
    areaName !== "local"
  ) {
    return;
  }

  if (
    changes.notes ||
    changes.folders
  ) {
    loadLatestNote();
  }
}

chrome.storage.onChanged.addListener(
  handleStorageChange
);

/* -------------------------------------------------------------------------- */
/* Initial state                                                              */
/* -------------------------------------------------------------------------- */

setEmptyState();
loadLatestNote();