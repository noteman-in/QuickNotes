document
  .getElementById("open")
  .addEventListener("click", () => {

    chrome.tabs.create({
      url: chrome.runtime.getURL(
        "dist/index.html"
      )
    });

    window.close();

  });

const preview =
  document.getElementById("previewText");

const folder =
  document.getElementById("previewFolder");

const date =
  document.getElementById("previewDate");

const deleteButton =
  document.getElementById("delete");

const openFolderButton =
  document.getElementById("openFolder");

let latestNote = null;

loadLatestNote();

function loadLatestNote() {

  chrome.storage.local.get(
    ["notes"],
    (result) => {

      const notes =
        result.notes || [];

      if (notes.length === 0) {

        latestNote = null;

        preview.textContent =
          "No recently saved note.";

        folder.textContent = "";

        date.textContent = "";

        deleteButton.disabled = true;
        openFolderButton.disabled = true;

        return;

      }

      latestNote = structuredClone(
        notes[notes.length - 1]
      );

      preview.textContent =
        latestNote.text;

      folder.textContent =
        "Folder • " +
        latestNote.folder;

      date.textContent =
        latestNote.date;

      deleteButton.disabled = false;
      openFolderButton.disabled = false;

    }

  );

}

openFolderButton.onclick = () => {

  if (!latestNote)
    return;

  chrome.tabs.create({

    url:
      chrome.runtime.getURL(
        "dist/index.html"
      ) +
      "#/folder/" +
      encodeURIComponent(
        latestNote.folder
      )

  });

  window.close();

};

deleteButton.onclick = () => {

  if (!latestNote)
    return;

  chrome.storage.local.get(
    ["notes"],
    (result) => {

      const notes =
        result.notes || [];

      const updatedNotes =
        notes.filter(
          note =>
            note.id !==
            latestNote.id
        );

      chrome.storage.local.set(
        {
          notes: updatedNotes
        },
        () => {

          latestNote = null;

          loadLatestNote();

        }
      );

    }

  );

};

chrome.storage.onChanged.addListener(

  (changes, area) => {

    if (
      area === "local" &&
      changes.notes
    ) {

      loadLatestNote();

    }

  }

);