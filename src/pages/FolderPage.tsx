import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  ArrowLeft,
  Copy,
  Pencil,
  Trash2,
  Star,
  ExternalLink,
  Save
} from "lucide-react";

interface Note {
  folder: string;
  text: string;
  url: string;
  title: string;
  date: string;
  favorite?: boolean;
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

        const folderNotes =
          (result.notes || [])
            .filter(
              (note) =>
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

  function showToast(
    message: string
  ) {

    const toast =
      document.createElement(
        "div"
      );

    toast.innerText =
      message;

    toast.style.position =
      "fixed";

    toast.style.bottom =
      "24px";

    toast.style.right =
      "24px";

    toast.style.background =
      "#111827";

    toast.style.color =
      "white";

    toast.style.padding =
      "12px 18px";

    toast.style.borderRadius =
      "12px";

    toast.style.fontWeight =
      "600";

    toast.style.zIndex =
      "99999";

    document.body.appendChild(
      toast
    );

    setTimeout(() => {
      toast.remove();
    }, 1200);

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
                note.text ===
                filteredNotes[index].text &&
                note.date ===
                filteredNotes[index].date
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
          loadNotes
        );

        setEditing(null);

        showToast(
          "Saved!"
        );

      }
    );

  }

  function deleteNote(
    index: number
  ) {

    chrome.storage.local.get(
      ["notes"],
      (result: { notes?: Note[] }) => {

        const updated =
          (result.notes || []).filter(
            (note) =>
              !(
                note.text ===
                filteredNotes[index].text &&
                note.date ===
                filteredNotes[index].date
              )
          );

        chrome.storage.local.set(
          {
            notes: updated
          },
          loadNotes
        );

        showToast(
          "Deleted!"
        );

      }
    );

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
                note.text ===
                filteredNotes[index].text &&
                note.date ===
                filteredNotes[index].date
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

            filteredNotes.map(
              (note, index) => (
                <div
                  className="folder-card"
                  key={index}
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
                        <Save size={16} />
                        Save
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
                      <Trash2 size={16} />
                      Delete
                    </button>

                  </div>

                </div>

              )
            )

          )}
        </section>

      </main>

    </div>
  );
}