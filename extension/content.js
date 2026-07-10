const isMac = navigator.platform.toUpperCase().includes("MAC");
let activeFolder = null;

let sessionStatus = "Building Note";
let sessionActive = false;
const PANEL_HIDE_DELAY = 800;
const SELECTION_DELAY = 50;
let currentNoteId = null;

let currentHighlightCount = 0;

let sessionPanel = null;
let panelCollapsed = false;
let reopenButton = null;


function updateSessionPanel() {

    if (!sessionPanel) {

        sessionPanel =
            document.createElement("div");

        sessionPanel.id =
            "quicknotes-session";

        sessionPanel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 260px;

    background: #111827;

    color: white;

    padding: 16px;

    border-radius: 16px;

    font-family: Arial;

    box-shadow: 0 12px 30px rgba(0,0,0,.25);

    z-index:2147483647;

    line-height:1.5;

    transition:
        transform .25s cubic-bezier(.22,.61,.36,1);


`;

        document.body.appendChild(
            sessionPanel
        );

    }

    sessionPanel.innerHTML = `
<div id="quicknotes-toggle"
    style="
        position:absolute;
        top:50%;
       right:-21px;
left:auto;
        transform:translateY(-50%);
        width:42px;
        height:42px;
        border-radius:50%;
        background:#111827;
        display:flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        box-shadow:0 8px 20px rgba(0,0,0,.28);
        border:2px solid #1f2937;
        user-select:none;
        transition:all .2s ease;
        font-size:18px;
        font-weight:bold;
    "
>
    ${panelCollapsed ? "❮" : "❯"}
</div>

<div style="font-weight:700;color:#22c55e;">
    ● QuickNotes Active
</div>

<div style="margin-top:10px;">
    Folder
    <b>${activeFolder?.name || ""}</b>
</div>

<div style="margin-top:10px;">
    Highlights
    <b>${currentHighlightCount}</b>
</div>

<div style="margin-top:10px;">
    Status
    <b style="color:#4ade80;">
        ${sessionStatus}
    </b>
</div>

<div style="
    margin-top:12px;
    font-size:13px;
    opacity:.8;
">
    ${isMac ? "⌘" : "Ctrl"} + Enter → New Note<br>
    Esc → Finish Session
</div>
`;
    const toggle =
        document.getElementById(
            "quicknotes-toggle"
        );

    toggle.onclick = () => {

        panelCollapsed = !panelCollapsed;
        if (panelCollapsed) {

            sessionPanel.style.transform =
                "translateX(calc(100% + 21px))";

            reopenButton.style.display = "flex";

        } else {

            sessionPanel.style.transform =
                "translateX(0)";

            reopenButton.style.display = "none";

        }

        toggle.innerHTML = "❯";

    };
    createReopenButton();
    // Restore panel position after rebuilding
    sessionPanel.style.transform =
        panelCollapsed
            ? "translateX(calc(100% + 21px))"
            : "translateX(0)";


}
function createReopenButton() {

    if (reopenButton)
        return;

    reopenButton =
        document.createElement("div");

    reopenButton.id =
        "quicknotes-reopen";

    reopenButton.innerHTML = `
<div
    style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        width:100%;
        padding:0 12px;
        box-sizing:border-box;
        font-weight:bold;
    "
>
    <span style="
        color:white;
        font-size:18px;
    ">
        ❮
    </span>

    <span
        id="quicknotes-count"
        style="
            color:#22c55e;
            font-size:15px;
        "
    >
        ${currentHighlightCount}
    </span>
</div>
`;

    reopenButton.style.cssText = `
        position:fixed;
        top:50%;
        right:24px;
        transform:translateY(-50%);
        width:74px;
        height:44px;

        display:none;

        align-items:center;
        justify-content:center;

        background:#111827;

        color:white;

        font-size:20px;

        font-weight:bold;

        border-radius:999px;

        border:3px solid #22c55e;

        cursor:pointer;

        box-shadow:
            0 8px 20px rgba(0,0,0,.25);

        z-index:2147483647;

        transition:all .25s ease;
    `;

    reopenButton.onclick = () => {

        panelCollapsed = false;
        sessionPanel.style.display = "block";

        sessionPanel.style.transform =
            "translateX(0)";

        reopenButton.style.display =
            "none";

        const toggle =
            document.getElementById(
                "quicknotes-toggle"
            );

        if (toggle) {

            toggle.innerHTML = "❯";

        }

    };

    document.body.appendChild(
        reopenButton
    );

}
function closeSession() {

    sessionActive = false;

    activeFolder = null;

    currentNoteId = null;

    currentHighlightCount = 0;

    sessionStatus = "Building Note";

    chrome.storage.local.remove(
        "quicknotesSession"
    );

    if (sessionPanel) {

        sessionPanel.remove();

        sessionPanel = null;

    }
    if (reopenButton) {

        reopenButton.remove();

        reopenButton = null;

    }
    panelCollapsed = false;

}
function saveSession() {

    chrome.storage.local.set({

        quicknotesSession: {

            active: sessionActive,

            folder:
                activeFolder
                    ? activeFolder.name
                    : null,

            noteId: currentNoteId,

            highlights: currentHighlightCount,

            status: sessionStatus

        }

    });

}


chrome.storage.local.get(
    ["quicknotesSession", "folders"],
    (result) => {

        const session =
            result.quicknotesSession;

        if (
            !session ||
            !session.active
        )
            return;

        sessionActive = true;

        currentNoteId =
            session.noteId;

        currentHighlightCount =
            session.highlights;

        sessionStatus =
            session.status;

        activeFolder =
            (result.folders || []).find(
                folder =>
                    folder.name ===
                    session.folder
            );

        if (activeFolder) {

            updateSessionPanel();

        }

    }
);

document.addEventListener(
    "keydown",
    (e) => {

        if (e.key === "Escape") {

            e.preventDefault();

            closeSession();

            return;

        }
        if (
            sessionActive &&
            (e.ctrlKey || e.metaKey) &&
            e.key === "Enter"
        ) {

            e.preventDefault();

            currentNoteId = null;

            currentHighlightCount = 0;
            const count =
                document.getElementById(
                    "quicknotes-count"
                );

            if (count) {

                count.textContent = "0";

            }

            sessionStatus = "Highlight New Note";

            saveSession();

            updateSessionPanel();

            return;

        }

        chrome.storage.local.get(
            ["folders"],
            (result) => {

                const folders =
                    result.folders || [];

                let key;

                if (
                    e.code.startsWith(
                        "Digit"
                    )
                ) {
                    key =
                        e.code.replace(
                            "Digit",
                            ""
                        );
                }
                else if (
                    e.code.startsWith(
                        "Key"
                    )
                ) {
                    key =
                        e.code.replace(
                            "Key",
                            ""
                        );
                }
                else {
                    key =
                        e.key.toUpperCase();
                }
                const matchedFolder =
                    folders.find(
                        (folder) => {

                            if (
                                folder.modifier === "Ctrl"
                            ) {
                                return (
                                    e.ctrlKey &&
                                    folder.key === key
                                );
                            }

                            if (
                                folder.modifier === "Shift"
                            ) {
                                return (
                                    e.shiftKey &&
                                    folder.key === key
                                );
                            }

                            if (
                                folder.modifier === "Option"
                            ) {
                                return (
                                    e.altKey &&
                                    folder.key === key
                                );
                            }

                            if (
                                folder.modifier === "⌘"
                            ) {
                                return (
                                    e.metaKey &&
                                    folder.key === key
                                );
                            }

                            return false;
                        }
                    );

                if (!matchedFolder) {
                    return;
                }

                activeFolder = matchedFolder;

                if (!sessionActive) {

                    sessionActive = true;

                    currentNoteId = null;

                    currentHighlightCount = 0;

                    sessionStatus = "Building Note";

                    saveSession();

                    updateSessionPanel();

                }

            }
        );
    },
    true
);
function showAddedStatus() {

    sessionStatus = "Added ✓";

    saveSession();

    updateSessionPanel();

    setTimeout(() => {

        if (
            sessionActive &&
            sessionStatus === "Added ✓"
        ) {

            sessionStatus = "Building Note";

            saveSession();

            updateSessionPanel();

        }

    }, PANEL_HIDE_DELAY);

}
function saveSelection(text) {


    chrome.storage.local.get(
        ["notes"],
        (result) => {

            const notes =
                result.notes || [];

            // --------------------------
            // FIRST HIGHLIGHT OF A NOTE
            // --------------------------

            if (!currentNoteId) {

                const newNote = {

                    id: crypto.randomUUID(),

                    parentId: null,

                    folder:
                        activeFolder.name,

                    text,

                    url:
                        location.href,

                    title:
                        document.title,

                    date:
                        new Date().toLocaleString(),

                    favorite:
                        false

                };

                notes.push(newNote);

                currentNoteId =
                    newNote.id;

                currentHighlightCount = 1;

                const count =
                    document.getElementById(
                        "quicknotes-count"
                    );

                if (count) {

                    count.textContent =
                        currentHighlightCount;

                }

                chrome.storage.local.set(
                    {
                        notes
                    },
                    () => {

                        showAddedStatus();

                    }
                );

                return;

            }

            // --------------------------
            // APPEND TO CURRENT NOTE
            // --------------------------

            const note =
                notes.find(
                    n =>
                        n.id ===
                        currentNoteId
                );

            if (!note)
                return;

            note.text = note.text.trimEnd();

            note.text += "\n\n" + text;

            currentHighlightCount++;

            const count =
                document.getElementById(
                    "quicknotes-count"
                );

            if (count) {

                count.textContent =
                    currentHighlightCount;

            }

            chrome.storage.local.set(
                {
                    notes
                },
                () => {

                    showAddedStatus();

                }
            );

        }
    );
}

document.addEventListener(
    "mouseup",
    () => {

        if (!activeFolder)
            return;

        setTimeout(() => {

            const text =
                window
                    .getSelection()
                    ?.toString()
                    .trim();

            if (!text)
                return;

            saveSelection(text);


        }, SELECTION_DELAY);

    }
);
document.addEventListener(
    "mousedown",
    (e) => {

        const toggle =
            document.getElementById(
                "quicknotes-toggle"
            );

        if (
            toggle &&
            toggle.contains(e.target)
        ) {
            return;
        }

        if (
            sessionPanel &&
            !panelCollapsed
        ) {

            panelCollapsed = true;

            sessionPanel.style.transform =
                "translateX(calc(100% + 21px))";
            reopenButton.style.display = "flex";

        }

    }
);