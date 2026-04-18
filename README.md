# Study Arcade (HTML)

`Study Arcade` is an accessible browser game that keeps the same educational goal as `term_invaders.py`: identify the correct term from a displayed definition under arcade pressure.

Startup defaults are intentionally learner-friendly:

- High contrast enabled
- Game Type set to Term Invaders
- 2 choices per round
- Speed set to Normal
- Only the first topic preselected after term file load

## Run

1. Open `index.html` in a web browser.
2. Click **Load Terms .txt** and choose the provided `terms.txt` (or your own compatible file).
3. Select topics and click **Start Mission**.
4. Use the `?` help icon in Setup anytime for built-in instructions.

No server is required.

## Term File Format

Use the provided `terms.txt` as your starter file, or create your own.

Use this format:

```txt
# Topic Name
Term: Definition
Term with colon support: Definition may include: additional colons
```

Rules:

- Topic lines must start with `#`.
- Each term line must use the first `:` to split term and definition.
- Blank lines are allowed.

## Use Other Class Content

Create or edit a compatible `.txt` file and load it with **Load Terms .txt**.

## Score Storage

- Top 3 scores are saved in browser local storage when available.
- Use the **Clear Scores** button to reset them.
- If local storage is blocked by browser privacy settings, scores still work during the current open session but will not persist after closing.

## Mission Tally

- The right panel includes a running list of terms correctly guessed in the current mission.
- The list resets when a new mission starts.

## Accessibility Features

- Full keyboard gameplay:
- `Term Invaders`: on-screen Left/Right + Fire controls, plus `1`-`3`, arrows, `Enter`/`Space`, `P`, `K`
- `Banner Drive`: smooth left/right with arrow keys, plus `P` and `K`
- Visible focus outlines and large controls
- Reduced motion toggle
- High contrast toggle
- Status announcements for assistive technology via ARIA live regions
- Adjustable speed and choices-per-round to reduce time-pressure barriers

## Scoring and Integrity

- Correct hit: `+100` points
- Wrong hit: point reduction, city integrity unchanged
- Missed shot in an empty lane: small point reduction
- City integrity decreases only when a round reaches the city line

## Round Flow

- Each wave shows `2` or `3` terms at once.
- The game shows one definition at a time for one of the terms currently in that wave.
- When you correctly hit a term, only that term is removed, and the next definition is selected from the remaining on-screen terms.
- A new wave starts only after all terms in the current wave are correctly cleared or if any term breaches the city line.
- Unresolved terms are returned to the pool for later waves.

## Game Types

- `Term Invaders` (default): choose a lane and fire at the matching term.
- `Banner Drive`: steer a car smoothly left/right and pass under the correct banner as sets scroll downward.
