# 🎧 IELTS Master Listening — Interactive Practice Simulator (Parts 1–4)

An authentic, interactive IELTS listening test preparation platform featuring **36 full practice simulators** across all 4 parts of the IELTS Listening exam. Built with embedded audio players, instant scoring, interactive question-type filtering, full tapescripts, and an automated repository pipeline.

🌐 **Live Practice Hub**: [https://neotetsuya.github.io/Listening-IELTS/](https://neotetsuya.github.io/Listening-IELTS/)

---

## 🌟 Key Features

### 1. Comprehensive Exam Coverage (36 Practice Tests)
- **Part 1 — Everyday Social Dialogues (19 Tests)**:
  Form completion, notes completion, table completion, and multiple choice in everyday social contexts.
- **Part 2 — Social Monologues (6 Tests)**:
  Local facilities, community arrangements, guided audio tours, map/plan labelling, and matching.
- **Part 3 — Educational & Academic Discussions (5 Tests)**:
  Study group tutorials, project assignment discussions, sentence completion, and multiple-speaker tracking.
- **Part 4 — Academic Monologues & Lectures (6 Tests)**:
  University-level lectures on scientific and cultural topics, flowchart completion, and structured note-taking.

### 2. Modern Design Engineering & Tactile Micro-Interactions
- **Custom Bézier Easing Curves**: Snappy animations using tuned easing tokens (`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-drawer`, `--ease-spring`).
- **Tactile Active Press Feedback**: Physical `:active { transform: scale(0.96) }` feedback on buttons and cards.
- **Obsidian Dot-Matrix Canvas**: Deep `#020617` background with a subtle 24px grid pattern and ambient glowing mesh orbs.
- **Interactive Floating Toast**: Emil Kowalski / Sonner-inspired pill toast for instant user feedback.
- **Accessibility**: Comprehensive `@media (prefers-reduced-motion: reduce)` support.

### 3. Practice & Exploration Tools
- **🎲 Quick Practice (Random Test Picker)**: One-click "Surprise Me" hero CTA that randomly selects a test, smooth-scrolls and flashes the target card, and launches the simulator.
- **⚡ Keyboard Shortcuts**: Press `/` anywhere to focus search; press `Esc` to clear search.
- **🎯 Dynamic Filtering**:
  - Filter by Part (All Parts, Part 1, Part 2, Part 3, Part 4) with part-specific accent glows.
  - Filter by 8 Exercise Types with a smooth drag-to-scroll chip slider and frosted glass navigation arrows.
  - Real-time search by test title or question format.

### 4. Auto-Sorter & Organization System
- **Interactive UI Sorter**: On-the-fly client-side sorting by `Name (A → Z)` *(Default)*, `Name (Z → A)`, or `Question Type`.
- **Standalone File Auto-Sorter (`auto-sort.js` & `auto-sort.bat`)**:
  - Automatically identifies tests placed in the repository root (even if unorganized or snake_case).
  - Detects the IELTS module (`Part 1–4`) by analyzing filenames and inner HTML context.
  - Normalizes titles to proper Title Case (e.g., `art_gallery_tour_listening_simulator.html` → `Part 1 - Art Gallery Tour.html`).
  - Moves files directly into their respective module folders.
- **Grid Auto-Alphabetizer**: Automatically arranges all cards inside `index.html` in clean alphabetical order (A–Z).

---

## 📂 Repository Structure

```
Listening-IELTS/
├── Part 1/                  # 19 Everyday Social Dialogue Simulators
│   ├── Part 1 - Advice on Family Visit.html
│   ├── Part 1 - Birmingham Exhibition.html
│   └── ...
├── Part 2/                  # 6 Social Monologue Simulators
│   ├── Part 2 - Earn And Learn Company.html
│   ├── Part 2 - Healthy Hearing Medical Clinic.html
│   └── ...
├── Part 3/                  # 5 Academic Discussion Simulators
│   ├── Part 3 - Football Research.html
│   ├── Part 3 - Professor Morgan's Lecture.html
│   └── ...
├── Part 4/                  # 6 Academic Lecture Simulators
│   ├── Part 4 - Advertising Effect.html
│   ├── Part 4 - Chimpanzee Behaviours.html
│   └── ...
├── _backups/                # Automatic pre-modification safety backups
├── index.html               # Master Interactive Simulator Hub & Directory
├── auto-sort.js             # Standalone file detection & folder auto-sorter
├── auto-sort.bat            # Windows 1-click shortcut for auto-sorting
├── update-index.js          # Auto-indexer, card generator, and GitHub sync
├── update-and-push.bat      # Windows 1-click update & git push script
├── update-and-push.ps1      # PowerShell sync automation script
└── README.md                # Repository Documentation
```

---

## 🚀 Workflow & Automation Scripts

### 1. Automatically Sort Loose Files
If you add new test files to the repository root or subfolders, simply run:
```bash
node auto-sort.js
```
*Or double-click `auto-sort.bat` on Windows.*
> **Tip**: Run `node auto-sort.js --dry-run` to preview moves and renames without making changes.

### 2. Automatically Update `index.html` & Sync to GitHub
To scan all Part folders, update card links, synchronize metrics, sort the grid alphabetically, and push to GitHub in one step:
```bash
node update-index.js --push -m "feat: add new practice tests"
```
*Or double-click `update-and-push.bat` on Windows.*

---

## 💻 Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/NeoTetsuya/Listening-IELTS.git
   cd Listening-IELTS
   ```
2. Open `index.html` in any modern web browser.
3. No build step or node package installations required — pure modern HTML5, Tailwind CSS CDN, and Lucide icons.
