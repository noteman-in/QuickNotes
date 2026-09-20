(() => {
    "use strict";

    /*
     * ============================================================
     * QUICKNOTES CONTENT SCRIPT
     * ============================================================
     *
     * Handles:
     * - Folder keyboard shortcuts
     * - Highlight capture
     * - Multi-highlight notes
     * - New-note shortcut
     * - Session persistence
     * - Session restoration
     * - Floating QuickNotes panel
     *
     * All data remains inside chrome.storage.local.
     * ============================================================
     */

    /* ------------------------------------------------------------
     * PREVENT DOUBLE INITIALIZATION
     * ------------------------------------------------------------ */

    if (window.__QUICKNOTES_CONTENT_INITIALIZED__) {
        return;
    }

    window.__QUICKNOTES_CONTENT_INITIALIZED__ = true;

    /* ------------------------------------------------------------
     * PLATFORM
     * ------------------------------------------------------------ */

    const isMac =
        /Mac|iPhone|iPad|iPod/i.test(
            navigator.platform ||
            navigator.userAgent ||
            ""
        );

    const primaryModifierLabel =
        isMac ? "⌘" : "Ctrl";

    /* ------------------------------------------------------------
     * CONSTANTS
     * ------------------------------------------------------------ */

    const PANEL_WIDTH = 306;
    const PANEL_RIGHT = 20;
    const PANEL_BOTTOM = 20;

    const SELECTION_DELAY = 55;
    const DUPLICATE_WINDOW = 400;
    const STATUS_RESET_DELAY = 1700;

    const Z_INDEX = "2147483647";

    /* ------------------------------------------------------------
     * SESSION STATE
     * ------------------------------------------------------------ */

    let activeFolder = null;
    let sessionActive = false;

    let currentNoteId = null;
    let currentHighlightCount = 0;

    let sessionStatus = "Ready to capture";

    let panelCollapsed = false;

    /* ------------------------------------------------------------
     * DOM STATE
     * ------------------------------------------------------------ */

    let sessionPanel = null;
    let reopenButton = null;

    /* ------------------------------------------------------------
     * INTERNAL STATE
     * ------------------------------------------------------------ */

    let foldersCache = [];

    let selectionTimer = null;
    let statusTimer = null;

    let lastSavedSelection = "";
    let lastSavedSelectionTime = 0;

    let restoringSession = false;

    /* ============================================================
     * STORAGE
     * ============================================================ */

    function getStorage(keys) {
        return new Promise(
            (resolve, reject) => {
                chrome.storage.local.get(
                    keys,
                    (result) => {
                        if (
                            chrome.runtime.lastError
                        ) {
                            reject(
                                new Error(
                                    chrome.runtime.lastError.message
                                )
                            );

                            return;
                        }

                        resolve(
                            result || {}
                        );
                    }
                );
            }
        );
    }

    function setStorage(values) {
        return new Promise(
            (resolve, reject) => {
                chrome.storage.local.set(
                    values,
                    () => {
                        if (
                            chrome.runtime.lastError
                        ) {
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
            }
        );
    }

    function removeStorage(keys) {
        return new Promise(
            (resolve, reject) => {
                chrome.storage.local.remove(
                    keys,
                    () => {
                        if (
                            chrome.runtime.lastError
                        ) {
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
            }
        );
    }

    /* ============================================================
     * GENERAL HELPERS
     * ============================================================ */

    function createId() {
        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID ===
                "function"
        ) {
            return crypto.randomUUID();
        }

        return (
            Date.now().toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .slice(2) +
            "-" +
            Math.random()
                .toString(36)
                .slice(2)
        );
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function cleanString(value) {
        return typeof value === "string"
            ? value.trim()
            : "";
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function isEditableElement(element) {
        if (
            !(element instanceof HTMLElement)
        ) {
            return false;
        }

        return (
            element.isContentEditable ||
            element.tagName === "INPUT" ||
            element.tagName === "TEXTAREA" ||
            element.tagName === "SELECT"
        );
    }

    /* ============================================================
     * FOLDERS
     * ============================================================ */

    async function loadFolders() {
        try {
            const result =
                await getStorage([
                    "folders",
                ]);

            foldersCache =
                Array.isArray(
                    result.folders
                )
                    ? result.folders
                    : [];

            return foldersCache;
        } catch (error) {
            console.error(
                "QuickNotes: could not load folders.",
                error
            );

            foldersCache = [];

            return [];
        }
    }

    function getFolderById(id) {
        if (!id) {
            return null;
        }

        return (
            foldersCache.find(
                (folder) =>
                    folder &&
                    String(folder.id) ===
                        String(id)
            ) || null
        );
    }

    /*
     * IMPORTANT:
     *
     * Folder identity is always based on ID.
     * Names are display values only.
     */

    /* ============================================================
     * STORAGE CHANGE LISTENER
     * ============================================================ */

    chrome.storage.onChanged.addListener(
        (changes, areaName) => {
            if (
                areaName !== "local"
            ) {
                return;
            }

            if (!changes.folders) {
                return;
            }

            const nextFolders =
                changes.folders.newValue;

            foldersCache =
                Array.isArray(
                    nextFolders
                )
                    ? nextFolders
                    : [];

            if (
                activeFolder?.id
            ) {
                const refreshed =
                    getFolderById(
                        activeFolder.id
                    );

                if (refreshed) {
                    activeFolder =
                        refreshed;

                    if (
                        sessionActive
                    ) {
                        renderPanel();
                    }
                }
            }
        }
    );

    /* ============================================================
     * SELECTION
     * ============================================================ */

    function getSelectedText() {
        const selection =
            window.getSelection();

        if (!selection) {
            return "";
        }

        return selection
            .toString()
            .trim();
    }

    function isQuickNotesElement(
        element
    ) {
        if (!element) {
            return false;
        }

        if (
            element.id ===
            "quicknotes-session"
        ) {
            return true;
        }

        if (
            element.id ===
            "quicknotes-reopen"
        ) {
            return true;
        }

        if (
            typeof element.closest ===
            "function"
        ) {
            return Boolean(
                element.closest(
                    "#quicknotes-session, #quicknotes-reopen"
                )
            );
        }

        return false;
    }

    /* ============================================================
     * PANEL STYLES
     * ============================================================ */

    function panelStyles() {
        return `
            position:fixed;
            right:${PANEL_RIGHT}px;
            bottom:${PANEL_BOTTOM}px;
            width:${PANEL_WIDTH}px;
            max-width:calc(100vw - 40px);

            box-sizing:border-box;

            color:#ffffff;

            background:
                linear-gradient(
                    145deg,
                    rgba(27,29,42,.98),
                    rgba(16,18,29,.98)
                );

            border:
                1px solid rgba(255,255,255,.11);

            border-radius:20px;

            padding:18px;

            font-family:
                Inter,
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Roboto,
                Arial,
                sans-serif;

            line-height:1.45;

            box-shadow:
                0 22px 65px rgba(0,0,0,.28),
                0 4px 16px rgba(0,0,0,.12);

            z-index:${Z_INDEX};

            user-select:none;

            backdrop-filter:blur(20px);
            -webkit-backdrop-filter:blur(20px);

            transition:
                transform .28s cubic-bezier(.22,1,.36,1),
                opacity .2s ease,
                box-shadow .2s ease;

            animation:
                quicknotes-panel-in .32s cubic-bezier(.22,1,.36,1);
        `;
    }

    function injectAnimationStyles() {
        if (
            document.getElementById(
                "quicknotes-animation-styles"
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "quicknotes-animation-styles";

        style.textContent = `
            @keyframes quicknotes-panel-in {
                from {
                    opacity:0;
                    transform:translateY(14px) scale(.97);
                }

                to {
                    opacity:1;
                    transform:translateY(0) scale(1);
                }
            }

            @keyframes quicknotes-pulse {
                0%,100% {
                    box-shadow:
                        0 0 0 0
                        rgba(52,211,153,.20);
                }

                50% {
                    box-shadow:
                        0 0 0 6px
                        rgba(52,211,153,0);
                }
            }

            @keyframes quicknotes-success {
                0% {
                    transform:scale(.94);
                    opacity:.65;
                }

                100% {
                    transform:scale(1);
                    opacity:1;
                }
            }

            #quicknotes-session *,
            #quicknotes-reopen * {
                box-sizing:border-box;
            }

            #quicknotes-session button,
            #quicknotes-reopen {
                -webkit-tap-highlight-color:transparent;
            }

            @media (prefers-reduced-motion:reduce) {
                #quicknotes-session,
                #quicknotes-reopen {
                    animation:none !important;
                    transition:none !important;
                }
            }
        `;

        (
            document.head ||
            document.documentElement
        ).appendChild(style);
    }

    /* ============================================================
     * PANEL
     * ============================================================ */

    function createSessionPanel() {
        if (sessionPanel) {
            return;
        }

        if (!document.body) {
            return;
        }

        injectAnimationStyles();

        sessionPanel =
            document.createElement(
                "aside"
            );

        sessionPanel.id =
            "quicknotes-session";

        sessionPanel.setAttribute(
            "data-quicknotes-ui",
            "true"
        );

        sessionPanel.style.cssText =
            panelStyles();

        document.body.appendChild(
            sessionPanel
        );

        renderPanel();
    }

    function renderPanel() {
        if (!sessionActive) {
            return;
        }

        if (!sessionPanel) {
            createSessionPanel();
            return;
        }

        const folderName =
            activeFolder?.name ||
            "Unknown folder";

        const safeFolder =
            escapeHtml(
                folderName
            );

        const safeStatus =
            escapeHtml(
                sessionStatus
            );

        const statusIsSuccess =
            sessionStatus ===
            "Added ✓";

        sessionPanel.innerHTML = `
            <div
                style="
                    position:relative;
                "
            >
                <button
                    id="quicknotes-toggle"
                    type="button"
                    aria-label="${
                        panelCollapsed
                            ? "Open QuickNotes panel"
                            : "Collapse QuickNotes panel"
                    }"
                    style="
                        position:absolute;
                        top:0;
                        right:0;

                        width:30px;
                        height:30px;

                        display:flex;
                        align-items:center;
                        justify-content:center;

                        border:1px solid rgba(255,255,255,.10);
                        border-radius:9px;

                        background:rgba(255,255,255,.06);
                        color:rgba(255,255,255,.78);

                        cursor:pointer;

                        font-size:14px;
                        line-height:1;

                        transition:
                            background .16s ease,
                            color .16s ease,
                            transform .16s ease;

                        padding:0;
                    "
                >
                    ${panelCollapsed ? "❮" : "❯"}
                </button>

                <div
                    style="
                        display:flex;
                        align-items:center;
                        gap:9px;

                        padding-right:38px;
                    "
                >
                    <span
                        style="
                            width:9px;
                            height:9px;

                            flex:none;

                            border-radius:50%;

                            background:#34d399;

                            box-shadow:
                                0 0 0 5px
                                rgba(52,211,153,.10);

                            animation:
                                quicknotes-pulse 2.2s ease-in-out infinite;
                        "
                    ></span>

                    <div>
                        <div
                            style="
                                color:#ffffff;
                                font-size:13px;
                                font-weight:800;
                                letter-spacing:-.1px;
                            "
                        >
                            QuickNotes
                        </div>

                        <div
                            style="
                                margin-top:1px;
                                color:rgba(255,255,255,.52);
                                font-size:10px;
                                font-weight:600;
                            "
                        >
                            Capture session active
                        </div>
                    </div>
                </div>

                <div
                    style="
                        margin-top:17px;
                    "
                >
                    <div
                        style="
                            color:rgba(255,255,255,.43);
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:.9px;
                            text-transform:uppercase;
                        "
                    >
                        Current folder
                    </div>

                    <div
                        title="${safeFolder}"
                        style="
                            margin-top:5px;

                            color:#ffffff;

                            font-size:15px;
                            font-weight:750;

                            white-space:nowrap;
                            overflow:hidden;
                            text-overflow:ellipsis;
                        "
                    >
                        ${safeFolder}
                    </div>
                </div>

                <div
                    style="
                        display:grid;
                        grid-template-columns:1fr 1fr;
                        gap:8px;

                        margin-top:15px;
                    "
                >
                    <div
                        style="
                            padding:11px;

                            border:1px solid rgba(255,255,255,.07);
                            border-radius:12px;

                            background:rgba(255,255,255,.045);
                        "
                    >
                        <div
                            style="
                                color:rgba(255,255,255,.42);
                                font-size:9px;
                                font-weight:750;
                                letter-spacing:.45px;
                                text-transform:uppercase;
                            "
                        >
                            Highlights
                        </div>

                        <div
                            id="quicknotes-panel-count"
                            style="
                                margin-top:4px;

                                color:#ffffff;

                                font-size:21px;
                                line-height:1;
                                font-weight:800;
                            "
                        >
                            ${currentHighlightCount}
                        </div>
                    </div>

                    <div
                        style="
                            padding:11px;

                            border:1px solid rgba(255,255,255,.07);
                            border-radius:12px;

                            background:rgba(255,255,255,.045);
                        "
                    >
                        <div
                            style="
                                color:rgba(255,255,255,.42);
                                font-size:9px;
                                font-weight:750;
                                letter-spacing:.45px;
                                text-transform:uppercase;
                            "
                        >
                            Status
                        </div>

                        <div
                            id="quicknotes-panel-status"
                            style="
                                margin-top:5px;

                                color:${
                                    statusIsSuccess
                                        ? "#6ee7b7"
                                        : "#c7c9ff"
                                };

                                font-size:11px;
                                line-height:1.25;
                                font-weight:750;

                                ${
                                    statusIsSuccess
                                        ? "animation:quicknotes-success .2s ease;"
                                        : ""
                                }
                            "
                        >
                            ${safeStatus}
                        </div>
                    </div>
                </div>

                <div
                    style="
                        margin-top:15px;
                        padding-top:13px;

                        border-top:
                            1px solid
                            rgba(255,255,255,.07);

                        color:rgba(255,255,255,.48);

                        font-size:10px;
                        line-height:1.8;
                    "
                >
                    <div>
                        <strong
                            style="
                                color:rgba(255,255,255,.86);
                                font-weight:750;
                            "
                        >
                            ${primaryModifierLabel} + Enter
                        </strong>
                        &nbsp; New note
                    </div>

                    <div>
                        <strong
                            style="
                                color:rgba(255,255,255,.86);
                                font-weight:750;
                            "
                        >
                            Esc
                        </strong>
                        &nbsp; Finish session
                    </div>

                    <div>
                        <strong
                            style="
                                color:rgba(255,255,255,.86);
                                font-weight:750;
                            "
                        >
                            Highlight
                        </strong>
                        &nbsp; Add to note
                    </div>
                </div>
            </div>
        `;

        const toggle =
            document.getElementById(
                "quicknotes-toggle"
            );

        if (toggle) {
            toggle.addEventListener(
                "mouseenter",
                () => {
                    toggle.style.background =
                        "rgba(255,255,255,.12)";

                    toggle.style.color =
                        "#ffffff";

                    toggle.style.transform =
                        "translateY(-1px)";
                }
            );

            toggle.addEventListener(
                "mouseleave",
                () => {
                    toggle.style.background =
                        "rgba(255,255,255,.06)";

                    toggle.style.color =
                        "rgba(255,255,255,.78)";

                    toggle.style.transform =
                        "translateY(0)";
                }
            );

            toggle.addEventListener(
                "click",
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    togglePanel();
                }
            );
        }

        updatePanelTransform();

        updateReopenButton();
    }

    function updatePanelTransform() {
        if (!sessionPanel) {
            return;
        }

        sessionPanel.style.transform =
            panelCollapsed
                ? "translateX(calc(100% + 28px))"
                : "translateX(0)";
    }

    function togglePanel() {
        if (!sessionPanel) {
            return;
        }

        panelCollapsed =
            !panelCollapsed;

        updatePanelTransform();

        updateReopenButton();
    }

    /* ============================================================
     * REOPEN BUTTON
     * ============================================================ */

    function createReopenButton() {
        if (reopenButton) {
            updateReopenButton();
            return;
        }

        if (!document.body) {
            return;
        }

        reopenButton =
            document.createElement(
                "button"
            );

        reopenButton.id =
            "quicknotes-reopen";

        reopenButton.type = "button";

        reopenButton.setAttribute(
            "aria-label",
            "Open QuickNotes session"
        );

        reopenButton.setAttribute(
            "data-quicknotes-ui",
            "true"
        );

        reopenButton.style.cssText = `
            position:fixed;
            right:18px;
            top:50%;

            transform:
                translateY(-50%)
                translateX(0);

            width:68px;
            height:42px;

            display:none;
            align-items:center;
            justify-content:center;
            gap:9px;

            border:1px solid rgba(255,255,255,.12);
            border-radius:999px;

            background:
                linear-gradient(
                    145deg,
                    #1b1d2a,
                    #10121d
                );

            color:#ffffff;

            cursor:pointer;

            box-shadow:
                0 14px 38px rgba(0,0,0,.25);

            z-index:${Z_INDEX};

            font-family:
                Inter,
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                sans-serif;

            transition:
                transform .18s ease,
                box-shadow .18s ease,
                border-color .18s ease;

            padding:0;
        `;

        reopenButton.innerHTML = `
            <span
                style="
                    font-size:13px;
                    color:rgba(255,255,255,.72);
                "
            >
                ❮
            </span>

            <span
                id="quicknotes-count"
                style="
                    color:#8b8cf0;
                    font-size:12px;
                    font-weight:800;
                "
            >
                ${currentHighlightCount}
            </span>
        `;

        reopenButton.addEventListener(
            "mouseenter",
            () => {
                if (!reopenButton) {
                    return;
                }

                reopenButton.style.transform =
                    "translateY(-50%) translateX(-2px)";

                reopenButton.style.boxShadow =
                    "0 18px 44px rgba(0,0,0,.32)";

                reopenButton.style.borderColor =
                    "rgba(139,140,240,.35)";
            }
        );

        reopenButton.addEventListener(
            "mouseleave",
            () => {
                if (!reopenButton) {
                    return;
                }

                reopenButton.style.transform =
                    "translateY(-50%) translateX(0)";

                reopenButton.style.boxShadow =
                    "0 14px 38px rgba(0,0,0,.25)";

                reopenButton.style.borderColor =
                    "rgba(255,255,255,.12)";
            }
        );

        reopenButton.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                panelCollapsed = false;

                updatePanelTransform();

                updateReopenButton();
            }
        );

        document.body.appendChild(
            reopenButton
        );

        updateReopenButton();
    }

    function updateReopenButton() {
        if (!reopenButton) {
            if (sessionActive) {
                createReopenButton();
            }

            return;
        }

        const count =
            reopenButton.querySelector(
                "#quicknotes-count"
            );

        if (count) {
            count.textContent =
                String(
                    currentHighlightCount
                );
        }

        reopenButton.style.display =
            sessionActive &&
            panelCollapsed
                ? "flex"
                : "none";
    }

    /* ============================================================
     * SESSION STORAGE
     * ============================================================ */

    async function saveSession() {
        if (!sessionActive) {
            return;
        }

        try {
            await setStorage({
                quicknotesSession: {
                    active: true,

                    folderId:
                        activeFolder?.id ||
                        null,

                    noteId:
                        currentNoteId,

                    highlights:
                        currentHighlightCount,

                    status:
                        sessionStatus,
                },
            });
        } catch (error) {
            console.error(
                "QuickNotes: unable to save session.",
                error
            );
        }
    }

    async function closeSession() {
        sessionActive = false;

        activeFolder = null;

        currentNoteId = null;

        currentHighlightCount = 0;

        sessionStatus =
            "Ready to capture";

        panelCollapsed = false;

        lastSavedSelection = "";

        lastSavedSelectionTime = 0;

        if (selectionTimer) {
            clearTimeout(
                selectionTimer
            );

            selectionTimer = null;
        }

        if (statusTimer) {
            clearTimeout(
                statusTimer
            );

            statusTimer = null;
        }

        try {
            await removeStorage(
                "quicknotesSession"
            );
        } catch (error) {
            console.error(
                "QuickNotes: unable to clear session.",
                error
            );
        }

        removePanel();
    }

    async function restoreSession() {
        if (restoringSession) {
            return;
        }

        restoringSession = true;

        try {
            await loadFolders();

            const result =
                await getStorage([
                    "quicknotesSession",
                ]);

            const session =
                result.quicknotesSession;

            if (
                !session ||
                !session.active ||
                !session.folderId
            ) {
                return;
            }

            const folder =
                getFolderById(
                    session.folderId
                );

            if (!folder) {
                await removeStorage(
                    "quicknotesSession"
                );

                return;
            }

            activeFolder =
                folder;

            sessionActive = true;

            currentNoteId =
                session.noteId ||
                null;

            currentHighlightCount =
                Number.isFinite(
                    Number(
                        session.highlights
                    )
                )
                    ? Number(
                        session.highlights
                    )
                    : 0;

            sessionStatus =
                typeof session.status ===
                "string"
                    ? session.status
                    : "Building Note";

            panelCollapsed = false;

            createSessionPanel();

            renderPanel();
        } catch (error) {
            console.error(
                "QuickNotes: session restoration failed.",
                error
            );
        } finally {
            restoringSession = false;
        }
    }

    /* ============================================================
     * STATUS
     * ============================================================ */

    function showAddedStatus() {
        sessionStatus =
            "Added ✓";

        renderPanel();

        void saveSession();

        if (statusTimer) {
            clearTimeout(
                statusTimer
            );
        }

        statusTimer =
            window.setTimeout(
                () => {
                    if (
                        !sessionActive
                    ) {
                        return;
                    }

                    sessionStatus =
                        "Ready to capture";

                    renderPanel();

                    void saveSession();
                },
                STATUS_RESET_DELAY
            );
    }

    function showSaveError() {
        sessionStatus =
            "Save failed";

        renderPanel();

        if (statusTimer) {
            clearTimeout(
                statusTimer
            );
        }

        statusTimer =
            window.setTimeout(
                () => {
                    if (
                        !sessionActive
                    ) {
                        return;
                    }

                    sessionStatus =
                        "Ready to capture";

                    renderPanel();

                    void saveSession();
                },
                STATUS_RESET_DELAY
            );
    }

    /* ============================================================
     * HIGHLIGHT COUNT
     * ============================================================ */

    function updateHighlightCount() {
        if (!sessionActive) {
            return;
        }

        const panelCount =
            document.getElementById(
                "quicknotes-panel-count"
            );

        if (panelCount) {
            panelCount.textContent =
                String(
                    currentHighlightCount
                );
        }

        const reopenCount =
            document.getElementById(
                "quicknotes-count"
            );

        if (reopenCount) {
            reopenCount.textContent =
                String(
                    currentHighlightCount
                );
        }

        updateReopenButton();
    }

    /* ============================================================
     * START NEW NOTE
     * ============================================================ */

    async function startNewNote() {
        if (!sessionActive) {
            return;
        }

        currentNoteId = null;

        currentHighlightCount = 0;

        sessionStatus =
            "Highlight new note";

        updateHighlightCount();

        renderPanel();

        await saveSession();
    }

    /* ============================================================
     * SAVE SELECTION
     * ============================================================ */

    async function saveSelection(
        text
    ) {
        if (!sessionActive) {
            return;
        }

        if (!activeFolder?.id) {
            return;
        }

        const cleanText =
            cleanString(text);

        if (!cleanText) {
            return;
        }

        /*
         * Prevent duplicate mouseup events.
         */

        const currentTime =
            Date.now();

        if (
            cleanText ===
                lastSavedSelection &&
            currentTime -
                lastSavedSelectionTime <
                DUPLICATE_WINDOW
        ) {
            return;
        }

        lastSavedSelection =
            cleanText;

        lastSavedSelectionTime =
            currentTime;

        try {
            const result =
                await getStorage([
                    "notes",
                ]);

            const notes =
                Array.isArray(
                    result.notes
                )
                    ? result.notes
                    : [];

            /*
             * ----------------------------------------------------
             * CREATE NEW NOTE
             * ----------------------------------------------------
             */

            if (!currentNoteId) {
                const timestamp =
                    nowIso();

                const note = {
                    id: createId(),

                    parentId: null,

                    folderId:
                        activeFolder.id,

                    /*
                     * Legacy compatibility.
                     */
                    folder:
                        activeFolder.name,

                    text: cleanText,

                    url:
                        window.location.href,

                    title:
                        document.title ||
                        "",

                    date:
                        new Date().toLocaleString(),

                    createdAt:
                        timestamp,

                    updatedAt:
                        timestamp,

                    favorite: false,
                };

                notes.push(note);

                currentNoteId =
                    note.id;

                currentHighlightCount =
                    1;

                await setStorage({
                    notes,
                });

                updateHighlightCount();

                showAddedStatus();

                return;
            }

            /*
             * ----------------------------------------------------
             * APPEND TO EXISTING NOTE
             * ----------------------------------------------------
             */

            const note =
                notes.find(
                    (item) =>
                        item &&
                        item.id ===
                            currentNoteId
                );

            /*
             * If another part of the extension
             * deleted the current note, create
             * a fresh note instead.
             */

            if (!note) {
                currentNoteId = null;

                await saveSelection(
                    cleanText
                );

                return;
            }

            const existingText =
                cleanString(
                    note.text
                );

            note.text = existingText
                ? `${existingText}\n\n${cleanText}`
                : cleanText;

            note.updatedAt =
                nowIso();

            /*
             * Repair legacy fields if needed.
             */

            if (
                !note.folderId
            ) {
                note.folderId =
                    activeFolder.id;
            }

            if (
                !note.folder
            ) {
                note.folder =
                    activeFolder.name;
            }

            if (
                !note.createdAt
            ) {
                note.createdAt =
                    nowIso();
            }

            if (
                typeof note.favorite !==
                "boolean"
            ) {
                note.favorite = false;
            }

            currentHighlightCount +=
                1;

            await setStorage({
                notes,
            });

            updateHighlightCount();

            showAddedStatus();
        } catch (error) {
            console.error(
                "QuickNotes: unable to save selection.",
                error
            );

            showSaveError();
        }
    }

    /* ============================================================
     * SHORTCUTS
     * ============================================================ */

    function getShortcutKey(event) {
        const code =
            String(
                event.code || ""
            );

        if (
            code.startsWith(
                "Digit"
            )
        ) {
            return code.replace(
                "Digit",
                ""
            );
        }

        if (
            code.startsWith(
                "Key"
            )
        ) {
            return code.replace(
                "Key",
                ""
            );
        }

        if (
            code.startsWith(
                "Numpad"
            )
        ) {
            return code.replace(
                "Numpad",
                ""
            );
        }

        return String(
            event.key || ""
        ).toUpperCase();
    }

    function matchesFolderShortcut(
        folder,
        event,
        key
    ) {
        if (!folder) {
            return false;
        }

        const folderKey =
            String(
                folder.key || ""
            ).toUpperCase();

        if (
            !folderKey ||
            folderKey !==
                String(
                    key
                ).toUpperCase()
        ) {
            return false;
        }

        const modifier =
            String(
                folder.modifier ||
                "None"
            );

        /*
         * Make sure the shortcut does not
         * accidentally match a stronger
         * combination.
         */

        if (
            modifier === "Ctrl"
        ) {
            return (
                event.ctrlKey &&
                !event.metaKey
            );
        }

        if (
            modifier === "Shift"
        ) {
            return (
                event.shiftKey &&
                !event.ctrlKey &&
                !event.metaKey
            );
        }

        if (
            modifier === "Option" ||
            modifier === "Alt"
        ) {
            return (
                event.altKey &&
                !event.metaKey
            );
        }

        if (
            modifier === "⌘" ||
            modifier === "Command" ||
            modifier === "Meta"
        ) {
            return (
                event.metaKey &&
                !event.ctrlKey
            );
        }

        return (
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            !event.shiftKey
        );
    }

    function findMatchingFolder(
        event
    ) {
        const key =
            getShortcutKey(event);

        if (!key) {
            return null;
        }

        return (
            foldersCache.find(
                (folder) =>
                    matchesFolderShortcut(
                        folder,
                        event,
                        key
                    )
            ) || null
        );
    }

    /* ============================================================
     * START SESSION
     * ============================================================ */

    async function startSession(
        folder
    ) {
        if (!folder?.id) {
            return;
        }

        activeFolder =
            folder;

        sessionActive = true;

        currentNoteId = null;

        currentHighlightCount = 0;

        sessionStatus =
            "Ready to capture";

        panelCollapsed = false;

        createSessionPanel();

        renderPanel();

        await saveSession();
    }

    /* ============================================================
     * KEYBOARD
     * ============================================================ */

    async function handleKeydown(
        event
    ) {
        /*
         * Escape finishes an active session.
         */

        if (
            event.key ===
            "Escape"
        ) {
            if (sessionActive) {
                event.preventDefault();
                event.stopPropagation();

                await closeSession();
            }

            return;
        }

        /*
         * New note:
         *
         * Mac:
         *   Command + Enter
         *
         * Windows/Linux:
         *   Ctrl + Enter
         */

        const newNoteShortcut =
            sessionActive &&
            event.key === "Enter" &&
            (
                (
                    isMac &&
                    event.metaKey &&
                    !event.ctrlKey
                ) ||
                (
                    !isMac &&
                    event.ctrlKey &&
                    !event.metaKey
                )
            );

        if (
            newNoteShortcut
        ) {
            event.preventDefault();
            event.stopPropagation();

            await startNewNote();

            return;
        }

        /*
         * Never hijack shortcuts while the
         * user is typing.
         */

        if (
            isEditableElement(
                event.target
            )
        ) {
            return;
        }

        const matchedFolder =
            findMatchingFolder(
                event
            );

        if (!matchedFolder) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        /*
         * Pressing the active folder shortcut
         * again does not reset the note.
         */

        if (
            sessionActive &&
            activeFolder?.id &&
            String(
                activeFolder.id
            ) ===
                String(
                    matchedFolder.id
                )
        ) {
            return;
        }

        await startSession(
            matchedFolder
        );
    }

    /* ============================================================
     * MOUSEUP
     * ============================================================ */

    function handleMouseup(
        event
    ) {
        if (!sessionActive) {
            return;
        }

        if (
            isQuickNotesElement(
                event.target
            )
        ) {
            return;
        }

        if (selectionTimer) {
            clearTimeout(
                selectionTimer
            );
        }

        selectionTimer =
            window.setTimeout(
                () => {
                    selectionTimer = null;

                    const selectedText =
                        getSelectedText();

                    if (
                        !selectedText
                    ) {
                        return;
                    }

                    void saveSelection(
                        selectedText
                    );
                },
                SELECTION_DELAY
            );
    }

    /* ============================================================
     * MOUSEDOWN
     * ============================================================ */

    function handleMousedown(
        event
    ) {
        if (!sessionActive) {
            return;
        }

        if (
            isQuickNotesElement(
                event.target
            )
        ) {
            return;
        }

        /*
         * Don't collapse the panel merely because
         * the user clicks inside an editable area.
         */

        if (
            isEditableElement(
                event.target
            )
        ) {
            return;
        }

        if (
            panelCollapsed
        ) {
            return;
        }

        /*
         * Only collapse when the user interacts
         * with the webpage itself.
         */

        panelCollapsed = true;

        updatePanelTransform();

        updateReopenButton();
    }

    /* ============================================================
     * MESSAGE API
     * ============================================================ */

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

            /*
             * Return selected text.
             */

            if (
                message.action ===
                "getSelectedText"
            ) {
                sendResponse({
                    success: true,

                    text:
                        getSelectedText(),

                    url:
                        window.location.href,

                    title:
                        document.title ||
                        "",
                });

                return false;
            }

            /*
             * Save current selection.
             */

            if (
                message.action ===
                "saveCurrentSelection"
            ) {
                const text =
                    getSelectedText();

                if (!text) {
                    sendResponse({
                        success: false,

                        error:
                            "No text is currently selected.",
                    });

                    return false;
                }

                if (
                    !sessionActive
                ) {
                    sendResponse({
                        success: false,

                        error:
                            "No QuickNotes session is active.",
                    });

                    return false;
                }

                saveSelection(text)
                    .then(() => {
                        sendResponse({
                            success: true,
                        });
                    })
                    .catch(
                        (error) => {
                            sendResponse({
                                success: false,

                                error:
                                    error?.message ||
                                    "Could not save selection.",
                            });
                        }
                    );

                return true;
            }

            /*
             * Close current session.
             */

            if (
                message.action ===
                "closeSession"
            ) {
                closeSession()
                    .then(() => {
                        sendResponse({
                            success: true,
                        });
                    })
                    .catch(
                        (error) => {
                            sendResponse({
                                success: false,

                                error:
                                    error?.message ||
                                    "Could not close session.",
                            });
                        }
                    );

                return true;
            }

            /*
             * Start a new note inside
             * the current session.
             */

            if (
                message.action ===
                "newNote"
            ) {
                startNewNote()
                    .then(() => {
                        sendResponse({
                            success: true,
                        });
                    })
                    .catch(
                        (error) => {
                            sendResponse({
                                success: false,

                                error:
                                    error?.message ||
                                    "Could not start new note.",
                            });
                        }
                    );

                return true;
            }

            return false;
        }
    );

    /* ============================================================
     * CLEANUP
     * ============================================================ */

    function removePanel() {
        if (sessionPanel) {
            sessionPanel.remove();
            sessionPanel = null;
        }

        if (reopenButton) {
            reopenButton.remove();
            reopenButton = null;
        }
    }

    function cleanup() {
        if (selectionTimer) {
            clearTimeout(
                selectionTimer
            );

            selectionTimer = null;
        }

        if (statusTimer) {
            clearTimeout(
                statusTimer
            );

            statusTimer = null;
        }

        removePanel();
    }

    /* ============================================================
     * VISIBILITY
     * ============================================================ */

    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                document.visibilityState ===
                "visible"
            ) {
                if (sessionActive) {
                    renderPanel();
                }
            }
        },
        {
            passive: true,
        }
    );

    /* ============================================================
     * PAGEHIDE
     * ============================================================ */

    window.addEventListener(
        "pagehide",
        () => {
            if (selectionTimer) {
                clearTimeout(
                    selectionTimer
                );

                selectionTimer = null;
            }
        },
        {
            passive: true,
        }
    );

    /* ============================================================
     * EVENT LISTENERS
     * ============================================================ */

    document.addEventListener(
        "keydown",
        (event) => {
            void handleKeydown(
                event
            );
        },
        true
    );

    document.addEventListener(
        "mouseup",
        handleMouseup,
        {
            passive: true,
        }
    );

    document.addEventListener(
        "mousedown",
        handleMousedown,
        {
            passive: true,
        }
    );

    /* ============================================================
     * INITIALIZATION
     * ============================================================ */

    async function initialize() {
        await loadFolders();

        await restoreSession();
    }

    initialize().catch(
        (error) => {
            console.error(
                "QuickNotes initialization failed.",
                error
            );

            cleanup();
        }
    );
})();