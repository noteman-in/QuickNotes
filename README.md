

QuickNotes

QuickNotes is a productivity-focused Chrome extension that allows users to save selected text from any website using customizable keyboard shortcuts.

While reading articles, research papers, blogs, documentation, or study material, users often waste time copying and organizing information manually. QuickNotes eliminates this process.

Users simply:

1. Press a shortcut.


2. Select text.


3. Release the mouse.



The selected text is automatically saved inside a predefined folder.


---

The Problem

Students, researchers, developers, and professionals read hundreds of pages every day. Important information gets lost between browser tabs, screenshots, copy-paste operations, and multiple note-taking applications.

Traditional note-taking interrupts the reading experience.


---

The Solution

QuickNotes makes note-taking instantaneous.

Assign shortcuts such as:

Shift + 1 → History

Shift + 2 → Geography

Shift + 3 → Economy

Shift + 4 → Research


Select text from any website and it is automatically organized into the correct folder.


---

Features

Keyboard shortcut based note saving.

Custom folders.

Search notes instantly.

Favorites page.

Edit notes.

Copy notes.

Source links.

PDF export.

Dark modern interface.



---

Target Users

Students

UPSC aspirants

Researchers

Developers

Writers

Professionals

Readers



---

Future Goals

Cloud synchronization.

Cross-device support.

Tags and labels.

Chrome Web Store release.

Firefox support.



---

Project Vision

QuickNotes aims to make knowledge capture frictionless by reducing note-taking to a single shortcut and a text selection.



# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
