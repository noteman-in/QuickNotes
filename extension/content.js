let activeFolder = null;

function showToast(folder) {

    const oldToast =
        document.getElementById(
            "quicknotes-toast"
        );

    if (oldToast) {
        oldToast.remove();
    }

    const toast =
        document.createElement("div");

    toast.id =
        "quicknotes-toast";

    toast.innerText =
        `Saved to ${folder}`;

    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #111;
        color: white;
        padding: 14px 20px;
        border-radius: 12px;
        font-size: 15px;
        font-family: Arial;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        z-index: 2147483647;
        pointer-events: none;
    `;

    document.body.appendChild(
        toast
    );

    setTimeout(() => {
        toast.remove();
    }, 1200);
}

console.log("QuickNotes loaded");

document.addEventListener(
    "keydown",
    (e) => {

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

                activeFolder =
                    folders.find(
                        (folder) => {

                            if (
                                folder.modifier ===
                                "Ctrl"
                            ) {
                                return (
                                    e.ctrlKey &&
                                    folder.key === key
                                );
                            }

                            if (
                                folder.modifier ===
                                "Shift"
                            ) {
                                return (
                                    e.shiftKey &&
                                    folder.key === key
                                );
                            }

                            if (
                                folder.modifier ===
                                "Option"
                            ) {
                                return (
                                    e.altKey &&
                                    folder.key === key
                                );
                            }

                            if (
                                folder.modifier ===
                                "⌘"
                            ) {
                                return (
                                    e.metaKey &&
                                    folder.key === key
                                );
                            }

                            return false;
                        }
                    );

                console.log(
                    "ACTIVE:",
                    activeFolder
                );
            }
        );
    },
    true
);

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

            console.log(
                "TEXT:",
                text
            );

            if (!text)
                return;

            chrome.storage.local.get(
                ["notes"],
                (result) => {

                    const notes =
                        result.notes || [];

                    notes.push({

                        id:
                            Date.now(),

                        folder:
                            activeFolder.name,

                        text:

                            text,

                        url:
                            location.href,

                        title:
                            document.title,

                        date:
                            new Date()
                                .toLocaleString(),

                        favorite:
                            false
                    });

                    chrome.storage.local.set(
                        {
                            notes
                        },
                        () => {

                            console.log(
                                "Saved to:",
                                activeFolder.name
                            );

                            showToast(
                                activeFolder.name
                            );

                            activeFolder =
                                null;
                        }
                    );
                }
            );

        }, 50);
    }
);