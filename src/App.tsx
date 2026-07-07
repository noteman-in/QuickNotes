import { useEffect, useState } from "react";
import "./App.css";
import { FileText } from "lucide-react";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
(pdfMake as any).addVirtualFileSystem(pdfFonts);
import logo from "./assets/logo.png";
import {
  Heart,
  Folder as FolderIcon,
  FolderOpen,
  Trash2,
  PlusCircle
} from "lucide-react";
interface FolderItem {
  name: string;
  modifier: string;
  key: string;
}
interface Note {

  id: string;

  folder: string;

  text: string;

  url: string;

  title: string;

  date: string;

  favorite?: boolean;

}

export default function App() {
  const [folders, setFolders] =
    useState<FolderItem[]>([]);

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

  function deleteFolder(index: number) {

    const folderName = folders[index].name;

    const updatedFolders = folders.filter(
      (_, i) => i !== index
    );

    chrome.storage.local.get(
      ["notes"],
      (result: any) => {

        const updatedNotes =
          (result.notes || []).filter(
            (note: any) =>
              note.folder !== folderName
          );

        setFolders(updatedFolders);

        chrome.storage.local.set({
          folders: updatedFolders,
          notes: updatedNotes
        });

      }
    );

  }
  function exportPDF(folderName: string) {

    const folderNotes =
      notes.filter(
        note =>
          note.folder === folderName
      );

    if (folderNotes.length === 0) {

      alert("No notes found.");

      return;

    }

    const content: any[] = [

      {
        text: `QuickNotes - ${folderName}`,
        style: "header"
      }

    ];

    folderNotes.forEach((note, index) => {

      content.push(

        {
          text: `${index + 1}. ${note.title}`,
          style: "title"
        },

        {
          text: note.text,
          margin: [0, 5, 0, 10]
        },

        {
          text: `Source: ${note.url}`,
          color: "blue",
          margin: [0, 0, 0, 5]
        },

        {
          text: `Date: ${note.date}`,
          color: "gray",
          margin: [0, 0, 0, 20]
        }

      );

    });

    pdfMake.createPdf({

      content,

      styles: {

        header: {

          fontSize: 22,

          bold: true,

          margin: [0, 0, 0, 20]

        },

        title: {

          fontSize: 15,

          bold: true

        }

      }

    }).download(`${folderName}.pdf`);

  }

  return (
    <div className="app">

      <header className="navbar">

        <div className="navbar-left">

          <div className="brand">

            <img
              src={logo}
              alt="QuickNotes"
              className="brand-logo"
            />

            <div className="brand-text">

              <h1>QuickNotes</h1>

              <span>
                Capture • Organize • Revise
              </span>

            </div>

          </div>

        </div>

        <div className="navbar-right">

          <button
            className="favorite-button"
            onClick={() => {
              window.location.hash = "/favorites";
            }}
          >
            <Heart size={18} />
            Favorites
          </button>

        </div>

      </header>

      <main className="dashboard">

        {warning && (
          <div className="warning">
            {warning}
          </div>
        )}

        <section className="create-card">

          <div className="create-header">

            <h2>
              Create Folder
            </h2>

            <p>
              Every folder can have its own keyboard shortcut.
            </p>

          </div>

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

              <PlusCircle size={18} />

              Create Folder

            </button>

          </div>

        </section>

        <section className="folder-list">

          {folders.map(
            (folder, index) => (
              <div
                className="folder-card"
                key={index}
              >
                <div className="folder-row">

                  <div className="folder-title">

                    <FolderIcon
                      size={22}
                      strokeWidth={2.2}
                    />

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
                      exportPDF(folder.name)
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

        </section>

      </main>

    </div>
  );
}