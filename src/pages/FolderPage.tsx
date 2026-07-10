import { useParams } from "react-router-dom";
import React, { useEffect, useState } from "react";

import {
  ArrowLeft,
  Copy,
  Pencil,
  Trash2,
  Star,
  ExternalLink,
  Save,
  CornerDownRight
} from "lucide-react";

interface Note {

  id: string;

  folder: string;

  text: string;

  url: string;

  title: string;

  date: string;

  favorite?: boolean;

  parentId?: string | null;

}

export default function FolderPage() {


  const { name } = useParams();

  const [notes, setNotes] =
    useState<Note[]>([]);

  const [search, setSearch] =
    useState("");

  const [sort, setSort] =
    useState("newest");

  const [editing, setEditing] =
    useState<number | null>(null);

  const [editedText, setEditedText] =
    useState("");
  const [copiedIndex, setCopiedIndex] =
    useState<number | null>(null);
  const [savedIndex, setSavedIndex] =
    useState<number | null>(null);
  const [deletedIndex, setDeletedIndex] =
    useState<number | null>(null);
  const [showParentModal, setShowParentModal] =
    useState(false);

  const [selectedNote, setSelectedNote] =
    useState<Note | null>(null);

  const [parentSearch, setParentSearch] =
    useState("");

  const [selectedParentId, setSelectedParentId] =
    useState<string | null>(null);
  const [hierarchyWarning, setHierarchyWarning] =
    useState("");

  useEffect(() => {

    loadNotes();

    const listener = (
      changes: any,
      area: string
    ) => {

      if (
        area === "local" &&
        changes.notes
      ) {
        loadNotes();
      }

    };

    chrome.storage.onChanged.addListener(
      listener
    );

    return () => {
      chrome.storage.onChanged.removeListener(
        listener
      );
    };

  }, [name]);
  function loadNotes() {

    chrome.storage.local.get(
      ["notes"],
      (result: { notes?: Note[] }) => {

        const allNotes =
          result.notes || [];

        const ids = new Set(
          allNotes.map(note => note.id)
        );

        let repaired = false;

        const repairedNotes =
          allNotes.map(note => {

            if (
              note.parentId &&
              !ids.has(note.parentId)
            ) {

              repaired = true;

              return {

                ...note,

                parentId: null

              };

            }

            return note;

          });

        if (repaired) {

          chrome.storage.local.set({
            notes: repairedNotes
          });

        }

        const folderNotes =
          repairedNotes.filter(
            note =>
              note.folder
                .toLowerCase()
                .trim() ===
              name
                ?.toLowerCase()
                .trim()
          );

        setNotes(folderNotes);

      }
    );

  }

  const filteredNotes =
    [...notes]
      .filter(
        (note) =>
          note.text
            .toLowerCase()
            .includes(
              search.toLowerCase()
            ) ||
          note.title
            .toLowerCase()
            .includes(
              search.toLowerCase()
            )
      )
      .sort((a, b) => {

        if (
          sort ===
          "favorites"
        ) {

          return (
            Number(
              !!b.favorite
            ) -
            Number(
              !!a.favorite
            )
          );

        }

        const first =
          new Date(
            a.date
          ).getTime();

        const second =
          new Date(
            b.date
          ).getTime();

        if (
          sort ===
          "oldest"
        ) {

          return (
            first -
            second
          );

        }

        return (
          second -
          first
        );

      });
  function copyNote(
    text: string,
    index: number
  ) {

    navigator.clipboard.writeText(text);

    setCopiedIndex(index);

    setTimeout(() => {
      setCopiedIndex(null);
    }, 1200);

  }

  function startEdit(
    index: number
  ) {

    setEditing(index);

    setEditedText(
      filteredNotes[index]
        .text
    );

  }

  function saveEdit(
    index: number
  ) {

    chrome.storage.local.get(
      ["notes"],
      (result: { notes?: Note[] }) => {

        const updated =
          (result.notes || []).map(
            (note) => {

              if (
                note.id === filteredNotes[index].id
              ) {

                return {
                  ...note,
                  text: editedText
                };

              }

              return note;

            }
          );

        chrome.storage.local.set(
          {
            notes: updated
          },
          () => {

            loadNotes();

            setSavedIndex(index);

            setTimeout(() => {

              setSavedIndex(null);

              setEditing(null);

            }, 700);

          }
        );

      }
    );

  }

  function deleteNote(
    index: number
  ) {

    setDeletedIndex(index);

    setTimeout(() => {

      chrome.storage.local.get(
        ["notes"],
        (result: { notes?: Note[] }) => {

          const noteToDelete =
            filteredNotes[index];

          const updated =
            (result.notes || []).filter(
              note =>

                note.id !== noteToDelete.id &&

                note.parentId !== noteToDelete.id

            );

          chrome.storage.local.set(
            {
              notes: updated
            },
            () => {

              loadNotes();

              setDeletedIndex(null);

            }
          );

        }
      );

    }, 700);

  }

  function toggleFavorite(
    index: number
  ) {

    chrome.storage.local.get(
      ["notes"],
      (result: { notes?: Note[] }) => {

        const updated =
          (result.notes || []).map(
            (note) => {

              if (
                note.id === filteredNotes[index].id
              ) {

                return {
                  ...note,
                  favorite:
                    !note.favorite
                };

              }

              return note;

            }
          );

        chrome.storage.local.set(
          {
            notes: updated
          },
          loadNotes
        );

      }
    );

  }
  function getNoteIndex(
    id: string
  ) {

    return filteredNotes.findIndex(
      note => note.id === id
    );

  }
  function getChildren(
    parentId: string
  ) {

    return filteredNotes.filter(
      note =>
        note.parentId === parentId
    );

  }
  function getDescendantIds(parentId: string): Set<string> {

    const ids = new Set<string>();

    function dfs(id: string) {

      notes
        .filter(note => note.parentId === id)
        .forEach(child => {

          ids.add(child.id);

          dfs(child.id);

        });

    }

    dfs(parentId);

    return ids;

  }

  function renderCard(
    note: Note,
    index: number,
    child = false
  ) {

    return (
      <div
        className={
          child
            ? "folder-card child-card"
            : "folder-card"

        }

      >

        <div className="note-content">

          {editing === index ? (

            <textarea
              className="edit-box"
              value={editedText}
              onChange={(e) =>
                setEditedText(
                  e.target.value
                )
              }
            />

          ) : (

            <div className="note-text">
              {note.text}
            </div>

          )}

          <div className="note-title">
            {note.title}
          </div>

          <div className="note-date">
            {note.date}
          </div>

        </div>

        <div className="note-buttons">

          <a
            href={note.url}
            target="_blank"
            rel="noreferrer"
            className="open-btn"
          >
            <ExternalLink size={16} />
            Source
          </a>

          <button
            className="copy-btn"
            onClick={() =>
              copyNote(
                note.text,
                index
              )
            }
          >
            {copiedIndex === index ? (
              <>
                ✓ Copied
              </>
            ) : (
              <>
                <Copy size={16} />
                Copy
              </>
            )}
          </button>

          {editing === index ? (

            <button
              className="open-btn"
              onClick={() =>
                saveEdit(index)
              }
            >
              {savedIndex === index ? (
                <>
                  ✓ Saved
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save
                </>
              )}
            </button>

          ) : (

            <button
              className="open-btn"
              onClick={() =>
                startEdit(index)
              }
            >
              <Pencil size={16} />
              Edit
            </button>

          )}
          <button
            className="open-btn"
            onClick={() => {

              setSelectedNote(note);

              setSelectedParentId(null);

              setParentSearch("");

              setShowParentModal(true);

            }}
          >
            <CornerDownRight size={16} />
            {child ? "Move" : "Add Under"}
          </button>
          {child && (

            <button
              className="delete-btn"
              onClick={() => {

                chrome.storage.local.get(
                  ["notes"],
                  (result: any) => {

                    const updatedNotes =
                      (result.notes || []).map((n: Note) => {

                        if (n.id === note.id) {

                          return {

                            ...n,

                            parentId: null

                          };

                        }

                        return n;

                      });

                    chrome.storage.local.set(
                      {
                        notes: updatedNotes
                      },
                      () => {

                        loadNotes();

                      }
                    );

                  }
                );

              }}
            >

              Remove Parent

            </button>

          )}

          <button
            className="favorite-btn"
            onClick={() =>
              toggleFavorite(index)
            }
          >
            <Star
              size={16}
              fill={
                note.favorite
                  ? "currentColor"
                  : "none"
              }
            />
          </button>

          <button
            className="delete-btn"
            onClick={() =>
              deleteNote(index)
            }
          >
            {deletedIndex === index ? (
              <>
                ✓ Deleted
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete
              </>
            )}
          </button>

        </div>

      </div>

    );

  }
  const descendants =
    selectedNote
      ? getDescendantIds(selectedNote.id)
      : new Set<string>();

  return (
    <div className="app">

      <header className="navbar">

        <div className="navbar-left">

          <button
            className="back-button"
            onClick={() => {
              window.location.hash = "/";
            }}
          >
            <ArrowLeft size={18} />
          </button>

          <div className="brand-text">

            <h1>
              {name}
            </h1>

            <span>
              Manage your notes
            </span>

          </div>

        </div>

        <div className="navbar-right">

          <input
            className="page-search"
            placeholder="Search notes..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />

        </div>

      </header>

      <main className="dashboard">

        <section className="create-card">

          <div className="create-header">

            <h2>
              {name}
            </h2>

            <p>
              {filteredNotes.length}
              {filteredNotes.length === 1
                ? " saved note"
                : " saved notes"}
            </p>

          </div>

          <div className="sort-row">

            <div
              style={{
                color: "#6b7280",
                fontWeight: 600
              }}
            >
              Sort Notes
            </div>

            <select
              className="sort-box"
              value={sort}
              onChange={(e) =>
                setSort(
                  e.target.value
                )
              }
            >

              <option value="newest">
                Newest First
              </option>

              <option value="oldest">
                Oldest First
              </option>


            </select>

          </div>

        </section>

        <section className="folder-list">

          {filteredNotes.length === 0 ? (

            <div className="empty-message">
              No notes found.
            </div>

          ) : (

            filteredNotes
              .filter(note => !note.parentId)
              .map((note, index) => (

                <React.Fragment key={note.id}>
                  {renderCard(note, index)}

                  {getChildren(note.id).map((child) => (

                    <div
                      key={child.id}
                      className="child-wrapper"
                    >
                      {renderCard(
                        child,
                        getNoteIndex(child.id),
                        true
                      )}
                    </div>

                  ))}
                </React.Fragment>

              ))

          )}
        </section>

      </main>
      {hierarchyWarning && (

        <div className="hierarchy-warning">

          <div>

            <strong>
              ⚠ Hierarchy Rule
            </strong>

            <p>
              {hierarchyWarning}
            </p>

          </div>

          <button
            onClick={() =>
              setHierarchyWarning("")
            }
          >
            ✕
          </button>

        </div>

      )}
      {showParentModal && (

        <div className="modal-overlay">

          <div className="parent-modal">

            <h2>Add Under</h2>

            <p>
              Choose a parent note.
            </p>

            <input
              type="text"
              placeholder="Search..."
              value={parentSearch}
              onChange={(e) =>
                setParentSearch(e.target.value)}
            />

            <div className="parent-list">

              {notes
                .filter(note =>

                  note.id !== selectedNote?.id &&

                  note.folder === selectedNote?.folder &&

                  note.parentId === null &&

                  !descendants.has(note.id) &&

                  note.text
                    .toLowerCase()
                    .includes(
                      parentSearch.toLowerCase()
                    )
                )
                .map(note => (

                  <div
                    key={note.id}
                    className={`parent-item ${selectedParentId === note.id
                      ? "selected"
                      : ""
                      }`}
                    onClick={() =>
                      setSelectedParentId(note.id)}
                  >

                    {note.text.length > 80
                      ? note.text.slice(0, 80) + "..."
                      : note.text}

                  </div>

                ))}

            </div>

            <div className="modal-buttons">

              <button
                onClick={() =>
                  setShowParentModal(false)}
              >

                Cancel

              </button>

              <button
                onClick={() => {

                  if (
                    !selectedParentId ||
                    !selectedNote
                  )
                    return;

                  chrome.storage.local.get(
                    ["notes"],
                    (result: { notes?: Note[] }) => {
                      const allNotes = result.notes || [];

                      const hasChildren = allNotes.some(
                        note => note.parentId === selectedNote.id
                      );

                      if (hasChildren) {

                        setHierarchyWarning(
                          "This note already has child notes. Remove or detach them before making this note a child."
                        );

                        return;

                      }

                      const updatedNotes =
                        allNotes.map(note => {

                          if (
                            note.id === selectedNote.id
                          ) {

                            return {

                              ...note,

                              parentId: selectedParentId

                            };

                          }

                          return note;

                        });

                      chrome.storage.local.set(
                        {
                          notes: updatedNotes
                        },
                        () => {

                          loadNotes();

                          setShowParentModal(false);

                        }
                      );

                    }
                  );
                }}
              >

                Add Under

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}