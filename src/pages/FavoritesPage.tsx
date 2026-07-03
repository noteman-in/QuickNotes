import { useEffect, useState } from "react";

import {
    ArrowLeft,
    ExternalLink
} from "lucide-react";

interface Note {
    folder: string;
    text: string;
    url: string;
    title: string;
    date: string;
    favorite?: boolean;
}

export default function FavoritesPage() {

    const [notes, setNotes] =
        useState<Note[]>([]);

    const [search, setSearch] =
        useState("");

    useEffect(() => {

        chrome.storage.local.get(
            ["notes"],
            (result: { notes?: Note[] }) => {

                const favorites =
                    (result.notes || []).filter(
                        note =>
                            note.favorite
                    );

                setNotes(
                    favorites
                );
            }
        );

    }, []);

    const filtered =
        notes.filter(
            note =>
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
        );

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
                        Favorites
                    </h1>

                </div>

                <input
                    className="page-search"
                    placeholder="Search favorites..."
                    value={search}
                    onChange={(e) =>
                        setSearch(
                            e.target.value
                        )
                    }
                />

            </div>

            <div className="favorite-count">
                Notes: {filtered.length}
            </div>

            <br />

            {filtered.map(
                (note, index) => (

                    <div
                        className="note-card"
                        key={index}
                    >

                        <div className="note-row">

                            <div className="note-content">

                                <div className="note-text">
                                    {note.text}
                                </div>

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

                            </div>

                        </div>

                    </div>

                )
            )}

            {filtered.length === 0 && (

                <div className="empty-message">
                    No favorite notes.
                </div>

            )}

        </div>
    );
}