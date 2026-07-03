import { useEffect, useState } from "react";
import "./App.css";
import { jsPDF } from "jspdf";

import {
  Heart,
  FolderOpen,
  FileText,
  Trash2,
  PlusCircle
} from "lucide-react";
interface Folder {
  name: string;
  modifier: string;
  key: string;
}

interface Note {
  folder: string;
  text: string;
  url: string;
  title: string;
  date: string;
  favorite?: boolean;
}

export default function App() {
  const [folders, setFolders] =
    useState<Folder[]>([]);

  const [notes, setNotes] =
    useState<Note[]>([]);


  const [folderName, setFolderName] =
    useState("");

  const [modifier, setModifier] =
    useState("");

  const [keyValue, setKeyValue] =
    useState("");

  const [warning, setWarning] =
    useState("");

  const [loaded, setLoaded] =
    useState(false);

  useEffect(() => {
    chrome.storage.local.get(
      ["folders", "notes"],
      (result: any) => {
        setFolders(
          result.folders || []
        );

        setNotes(
          result.notes || []
        );

        setLoaded(true);
      }
    );
  }, []);

  useEffect(() => {
    const listener = (
      changes: any,
      area: string
    ) => {
      if (
        area === "local" &&
        changes.notes
      ) {
        setNotes(
          changes.notes.newValue || []
        );
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
  }, []);

  useEffect(() => {
    if (!loaded) return;

    chrome.storage.local.set({
      folders: folders
    });

    localStorage.setItem(
      "folders",
      JSON.stringify(folders)
    );
  }, [folders, loaded]);

  const commandKeys = [
    "D",
    "G",
    "H",
    "J",
    "K",
    "M",
    "U"
  ];

  const ctrlKeys = [
    "D",
    "G",
    "H",
    "J",
    "K",
    "M",
    "U"
  ];

  const shiftKeys = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z"
  ];

  const optionKeys = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z"
  ];

  let availableKeys: string[] =
    [];

  if (modifier === "⌘") {
    availableKeys =
      commandKeys;
  } else if (
    modifier === "Shift"
  ) {
    availableKeys =
      shiftKeys;
  } else if (
    modifier === "Option"
  ) {
    availableKeys =
      optionKeys;
  } else if (
    modifier === "Ctrl"
  ) {
    availableKeys =
      ctrlKeys;
  }

  function addFolder() {
    if (
      !folderName ||
      !modifier ||
      !keyValue
    ) {
      setWarning(
        "Please fill all fields."
      );

      setTimeout(() => {
        setWarning("");
      }, 2000);

      return;
    }

    const exists =
      folders.some(
        (folder) =>
          folder.modifier ===
          modifier &&
          folder.key ===
          keyValue
      );

    if (exists) {
      setWarning(
        "Shortcut already assigned."
      );

      setTimeout(() => {
        setWarning("");
      }, 2000);

      return;
    }

    const updated = [
      {
        name: folderName,
        modifier,
        key: keyValue
      },
      ...folders
    ];

    setFolders(updated);

    setFolderName("");
    setModifier("");
    setKeyValue("");
  }

  function deleteFolder(
    index: number
  ) {
    const updated =
      folders.filter(
        (_, i) =>
          i !== index
      );

    setFolders(updated);

    chrome.storage.local.set({
      folders: updated
    });
  }

  function exportPDF(
    folderName: string
  ) {
    const folderNotes =
      notes.filter(
        (note) =>
          note.folder ===
          folderName
      );

    if (
      folderNotes.length === 0
    ) {
      alert(
        "No notes found."
      );
      return;
    }

    const doc =
      new jsPDF();

    doc.setFontSize(22);

    doc.text(
      folderName,
      10,
      20
    );

    let y = 35;

    folderNotes.forEach(
      (note, index) => {
        doc.setFontSize(14);

        doc.text(
          `${index + 1}. ${note.title}`,
          10,
          y
        );

        y += 8;

        const lines =
          doc.splitTextToSize(
            note.text,
            180
          );

        doc.setFontSize(11);

        doc.text(
          lines,
          10,
          y
        );

        y +=
          lines.length * 6;

        doc.text(
          note.date,
          10,
          y
        );

        y += 15;

        if (y > 260) {
          doc.addPage();
          y = 20;
        }
      }
    );

    doc.save(
      `${folderName}.pdf`
    );
  }

  return (
    <div className="container">
      <div className="top-bar">

        <h1>QuickNotes</h1>

        <button
          className="nav-button"
          onClick={() => {
            window.location.hash =
              "/favorites";
          }}
        >
          <Heart size={24} />
        </button>
      </div>

      {warning && (
        <div className="warning">
          {warning}
        </div>
      )}

      <div className="folder-form">
        <input
          type="text"
          placeholder="Folder Name"
          value={folderName}
          onChange={(e) =>
            setFolderName(
              e.target.value
            )
          }
        />

        <select
          value={modifier}
          onChange={(e) => {
            setModifier(
              e.target.value
            );
            setKeyValue("");
          }}
        >
          <option value="">
            Modifier
          </option>

          <option value="⌘">
            ⌘ Command
          </option>

          <option value="Shift">
            Shift
          </option>

          <option value="Option">
            Option
          </option>

          <option value="Ctrl">
            Ctrl
          </option>
        </select>

        <select
          value={keyValue}
          onChange={(e) =>
            setKeyValue(
              e.target.value
            )
          }
        >
          <option value="">
            Key
          </option>

          {availableKeys.map(
            (k) => (
              <option
                key={k}
                value={k}
              >
                {k}
              </option>
            )
          )}
        </select>

        <button
          onClick={addFolder}
          disabled={
            !folderName ||
            !modifier ||
            !keyValue
          }
        >
          <PlusCircle size={20} />
          Add Folder
        </button>
      </div>

      {folders.map(
        (folder, index) => (
          <div
            className="folder-card"
            key={index}
          >
            <div className="folder-row">

              <div className="folder-title">
                {folder.name}
              </div>

              <div className="note-count" title='Add New Item'>
                {
                  notes.filter(
                    (note) =>
                      note.folder ===
                      folder.name
                  ).length
                }
              </div>

              <div className="shortcut">
                {folder.modifier}
                +
                {folder.key}
              </div>

              <button
                className="open-btn"
                onClick={() => {
                  window.location.hash =
                    `/folder/${folder.name}`;
                }}
              >
                <FolderOpen size={18} />
                Open
              </button>

              <button
                className="pdf-btn"
                onClick={() =>
                  exportPDF(
                    folder.name
                  )
                }
              >
                <FileText size={18} />
                PDF
              </button>

              <button
                className="delete-btn"
                onClick={() =>
                  deleteFolder(
                    index
                  )
                }
              >
                <Trash2 size={18} />
                Delete
              </button>

            </div>
          </div>
        )
      )}
    </div>
  );
}