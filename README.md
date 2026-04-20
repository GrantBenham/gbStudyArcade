# Study Arcade

Study Arcade is a browser-based learning game for matching terms to definitions.

## Run

1. Open `index.html` in a browser.
2. When hosted (for example GitHub Pages or Brightspace SCORM), the bundled `terms.txt` auto-loads.
3. Optional: click **Load Terms .txt** to replace defaults with any compatible `.txt` file.
4. Select topics and click **Start Mission**.

No web server is required for local testing, but auto-loading `terms.txt` may not work under strict `file://` browser rules. In that case, use **Load Terms .txt**.

## Term File Format

Use this format:

```txt
// Study Arcade, copyright Dr. Grant Benham
# Topic Name
Term: Definition
Another term: Definition text
```

Rules:

- Topic lines must start with `#`.
- Each term line must contain a colon (`:`). The first colon splits term from definition.
- Instruction lines can start with `//` or `;` and are ignored by the parser.
- The required copyright line must be present somewhere in the file.

## Game Types

- `Term Invaders`
- `Banner Drive`
- `Memory Relay`
- `Mission Accessible`

## SCORM Builder

This folder includes a Windows GUI builder:

- `StudyArcadeScormBuilder.exe`

Use it to create Brightspace-ready SCORM 1.2 zip files:

1. Select project folder.
2. Choose a preset (`Demo`, `Biopsych`, `Health Psych`, or `Custom`).
3. Presets auto-fill terms source file, output zip name, activity title, and package identifier.
4. Optional: edit any field manually.
5. Build.

The selected terms file is always packaged as `terms.txt` inside the SCORM zip.

## Score Storage

Top scores are saved in browser local storage when available.
