# Study Arcade Handoff

Project path:
`F:\OneDrive - The University of Texas-Rio Grande Valley\!!gbPROGRAMS\gbFlashard Game\web_term_invaders`

## Goal
Browser-based accessible study game with editable term/definition content loaded from a `.txt` file.

## Important Constraints
- Do not modify the old Python game files.
- This HTML/JS/CSS folder is the active project.

## Current State
- Project name updated to **Study Arcade**.
- Two game modes:
  - `Term Invaders`
  - `Banner Drive`
- Terms are loaded only from a user-selected `.txt` file:
  - Setup includes **Load Terms .txt**.
  - Start button is disabled until a valid terms file is loaded.
  - First topic is auto-selected after successful load.
- Embedded fallback was removed.
- Source indicator states:
  - No terms file loaded
  - Loaded file (`filename.txt`)
  - Load failed
- Added help icon (`?`) in Setup:
  - Opens a hardcoded, accessible help modal.
  - Includes quick-start instructions, terms format, controls, and scoring.
  - Modal closes via Close button, outside click, or `Esc`.
  - Focus is trapped while open.
  - If gameplay is active, game auto-pauses while modal is open and resumes on close.
- High contrast and reduced motion options remain.
- Top 3 scores and “Correctly Guessed This Game” panel remain.

## Key Files
- `index.html`
- `app.js`
- `styles.css`
- `terms.txt`
- `README.md`

## Removed File
- `defaultTermsEmbedded.js` (deleted intentionally)

## Naming Updates Applied
- UI/help/title and docs changed from “Lane Defense Command” to “Study Arcade”.
- Internal JS identifiers/storage keys updated:
  - `laneDefenseSettings` -> `studyArcadeSettings`
  - `laneDefenseScoreboard` -> `studyArcadeScoreboard`

## Manual Sanity Checks To Run
1. Open `index.html`.
2. Confirm Start Mission is disabled initially.
3. Click **Load Terms .txt** and choose `terms.txt`.
4. Confirm source indicator shows loaded file and Start Mission is enabled.
5. Open `?` help modal and verify:
   - `Esc` closes
   - outside click closes
   - game pauses/resumes if open during gameplay
6. Start each game mode and verify controls still work.

## GitHub Publishing Intent
Public repo name: `gbStudyArcade`.

Recommended next steps:
1. Initialize git in this folder (if not already).
2. Add remote for `gbStudyArcade`.
3. Commit and push.
4. Enable GitHub Pages from `main` branch root.
