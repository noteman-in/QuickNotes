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
    const [notes, setNotes] = useState<Note[]>([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadFavorites();

        const listener = (
            changes: any,
            area: string
        ) => {
            if (
                area === "local" &&
                changes.notes
            ) {
                loadFavorites();
            }
        };

        chrome.storage.onChanged.addListener(listener);

        return () => {
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    function loadFavorites() {
        chrome.storage.local.get(
            ["notes"],
            (result: { notes?: Note[] }) => {
                const favorites = (result.notes || []).filter(
                    (note) => note.favorite
                );

                setNotes(favorites);
            }
        );
    }

    const filtered = notes.filter(
        (note) =>
            note.text
                .toLowerCase()
                .includes(search.toLowerCase()) ||
            note.title
                .toLowerCase()
                .includes(search.toLowerCase())
    );

    return (
        <div className="app">

            <header className="navbar">

                <div className="navbar-left">

                    <button
                        className="nav-button"
                        onClick={() => {
                            window.location.hash = "/";
                        }}
                        title="Back"
                    >
                        <ArrowLeft size={22} />
                    </button>

                    <div className="brand-text">
                        <h1>Favorites</h1>
                        <span>Your favourite notes</span>
                    </div>

                </div>

                <div className="navbar-right">

                    <input
                        className="page-search"
                        placeholder="Search favorites..."
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)
                        }
                    />

                </div>

            </header>

            <main className="dashboard">

                <section className="create-card">

                    <div className="create-header">

                        <h2>Favorite Notes</h2>

                        <p>
                            {filtered.length} saved
                            {filtered.length === 1 ? " note" : " notes"}
                        </p>

                    </div>

                </section>

                <section className="folder-list">

                    {filtered.length === 0 ? (

                        <div className="empty-message">
                            No favorite notes yet.
                        </div>

                    ) : (

                        filtered.map((note, index) => (

                            <div
                                className="folder-card"
                                key={index}
                            >

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
                                        href={note.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="open-btn"
                                    >
                                        <ExternalLink size={16} />
                                        Source
                                    </a>


                                </div>

                            </div>

                        ))

                    )}

                </section>

            </main>

        </div>
    );
}