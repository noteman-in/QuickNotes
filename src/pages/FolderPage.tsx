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

    const [editing,
        setEditing] =
        useState<number | null>(null);

    const [editedText,
        setEditedText] =
        useState("");

    useEffect(() => {
        chrome.storage.local.get(
            ["notes"],
            (result: { notes?: Note[] }) => {

                const allNotes =
                    result.notes || [];

                const filtered =
                    allNotes
                        .filter(
                            (note) =>
                                note.folder
                                    .toLowerCase()
                                    .trim() ===
                                name
                                    ?.toLowerCase()
                                    .trim()
                        )
                        .reverse();

                setNotes(filtered);
            }
        );
    }, [name]);

    function showToast(
        message: string
    ) {
        const toast =
            document.createElement(
                "div"
            );

        toast.innerText = message;

        toast.style.position =
            "fixed";

        toast.style.bottom =
            "20px";

        toast.style.right =
            "20px";

        toast.style.background =
            "#222";

        toast.style.color =
            "white";

        toast.style.padding =
            "12px 18px";

        toast.style.borderRadius =
            "10px";

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
        text: string
    ) {
        navigator.clipboard.writeText(
            text
        );

        showToast(
            "Copied!"
        );
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

                const allNotes =
                    result.notes || [];

                const current =
                    filteredNotes[index];

                const updated =
                    allNotes.map(
                        (note) => {

                            if (
                                note.text ===
                                current.text &&
                                note.date ===
                                current.date
                            ) {
                                return {
                                    ...note,
                                    text:
                                        editedText
                                };
                            }

                            return note;
                        }
                    );

                chrome.storage.local.set(
                    {
                        notes:
                            updated
                    },
                    () => {

                        setNotes(
                            updated.filter(
                                (note) =>
                                    note.folder
                                        .toLowerCase()
                                        .trim() ===
                                    name
                                        ?.toLowerCase()
                                        .trim()
                            )
                        );

                        setEditing(
                            null
                        );

                        showToast(
                            "Updated!"
                        );
                    }
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

                const allNotes =
                    result.notes || [];

                const selected =
                    filteredNotes[index];

                const updated =
                    allNotes.filter(
                        (note) =>
                            !(
                                note.text ===
                                selected.text &&
                                note.date ===
                                selected.date
                            )
                    );

                chrome.storage.local.set(
                    {
                        notes:
                            updated
                    },
                    () => {

                        setNotes(
                            notes.filter(
                                (note) =>
                                    !(
                                        note.text ===
                                        selected.text &&
                                        note.date ===
                                        selected.date
                                    )
                            )
                        );

                        showToast(
                            "Deleted!"
                        );
                    }
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

                const allNotes =
                    result.notes || [];

                const selected =
                    filteredNotes[index];

                const updated =
                    allNotes.map(
                        (note) => {

                            if (
                                note.text ===
                                selected.text &&
                                note.date ===
                                selected.date
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
                        notes:
                            updated
                    },
                    () => {

                        const folderNotes =
                            updated.filter(
                                (note) =>
                                    note.folder
                                        .toLowerCase()
                                        .trim() ===
                                    name
                                        ?.toLowerCase()
                                        .trim()
                            );

                        setNotes(
                            folderNotes
                        );


                    }
                );
            }
        );
    }

    return (
        <div className="container">

            <div className="page-navbar">

                <div className="page-left">

                    <button
                        className="nav-button"
                        onClick={() => {
                            window.location.hash = "/";
                        }}
                    >
                        <ArrowLeft size={24} />
                    </button>

                    <h1 className="page-title">
                        {name}
                    </h1>

                </div>

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

            <div className="filter-row">

                <div className="note-count-title">
                    Notes:
                    {" "}
                    {filteredNotes.length}
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
            {filteredNotes.map(
                (note, index) => (

                    <div
                        className="note-card"
                        key={index}
                    >

                        <div className="note-row">

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
                                    className="source-btn"
                                    href={note.url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <ExternalLink size={16} />
                                    Source
                                </a>

                                <button
                                    className="copy-btn"
                                    onClick={() =>
                                        copyNote(
                                            note.text
                                        )
                                    }
                                >
                                    <Copy size={16} />
                                    Copy
                                </button>

                                {editing === index ? (

                                    <button
                                        className="edit-btn"
                                        onClick={() =>
                                            saveEdit(
                                                index
                                            )
                                        }
                                    >
                                        <Save size={16} />
                                        Save
                                    </button>

                                ) : (

                                    <button
                                        className="edit-btn"
                                        onClick={() =>
                                            startEdit(
                                                index
                                            )
                                        }
                                    >
                                        <Pencil size={16} />
                                        Edit
                                    </button>

                                )}

                                <button
                                    className="favorite-btn"
                                    onClick={() =>
                                        toggleFavorite(
                                            index
                                        )
                                    }
                                >
                                    <Star
                                        size={24}
                                        strokeWidth={2.5}
                                        fill={
                                            note.favorite
                                                ? "white"
                                                : "none"
                                        }
                                    />
                                </button>

                                <button
                                    className="delete-btn"
                                    onClick={() =>
                                        deleteNote(
                                            index
                                        )
                                    }
                                >
                                    <Trash2 size={16} />
                                    Delete
                                </button>

                            </div>

                        </div>

                    </div>

                )
            )}

            {filteredNotes.length === 0 && (
                <p
                    style={{
                        color: "white"
                    }}
                >
                    No notes found.
                </p>
            )}

        </div>
    );
}