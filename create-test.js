/**
 * IELTS Listening Simulator - Test Scaffolder & Generator
 * 
 * Interactively or via CLI flags generates a new standardized IELTS listening test simulator.
 * Automatically saves to the correct Part folder and updates index.html.
 * 
 * Usage:
 *   node create-test.js                                                 # Interactive prompt
 *   node create-test.js --part 1 --title "Library Membership"          # CLI flags
 *   node create-test.js -p 2 -t "Museum Guided Tour" --audio "https://..."
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const REPO_DIR = __dirname;
const { autoSortFiles } = require('./auto-sort.js');

// Terminal colors
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function log(msg) { console.log(msg); }

// Parse CLI arguments
const args = process.argv.slice(2);
function getArg(flag, shortFlag) {
  const idx = args.findIndex(a => a === flag || a === shortFlag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return null;
}

const cliPart = getArg('--part', '-p');
const cliTitle = getArg('--title', '-t');
const cliType = getArg('--type', '-q') || 'Notes Completion';
const cliAudio = getArg('--audio', '-a') || 'https://example.com/audio.mp3';

/**
 * Prompt user in terminal
 */
function prompt(query, defaultValue = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const displayQuery = defaultValue ? `${query} [${dim(defaultValue)}]: ` : `${query}: `;
    rl.question(displayQuery, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`;

/**
 * Generate full HTML boilerplate for an IELTS simulator
 */
function generateTestTemplate({ partNum, title, exerciseType, audioUrl }) {
  const partDescriptions = {
    1: 'A conversation set in an everyday social context between two people.',
    2: 'A monologue set in an everyday social context (e.g. local facilities or community arrangements).',
    3: 'A conversation between up to four people set in an educational or training context.',
    4: 'A monologue on an academic subject (e.g. a university lecture).'
  };

  const desc = partDescriptions[partNum] || partDescriptions[1];

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | IELTS Listening Practice Simulator</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    
    <style>
        :root { --app-font-size: 16px; }
        body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; overscroll-behavior: none; }
        .ielts-container { display: grid; grid-template-rows: auto 1fr auto; height: 100vh; overflow: hidden; }
        .content-panes { display: grid; grid-template-columns: 1fr 6px 1fr; overflow: hidden; }
        .pane { overflow-y: auto; padding: 1.75rem 2rem; font-size: var(--app-font-size); scroll-behavior: smooth; }
        #left-pane { background-color: #ffffff; }
        #right-pane { background-color: #f8fafc; }
        .splitter { background-color: #cbd5e1; cursor: col-resize; z-index: 10; transition: background-color 0.2s; }
        .splitter:hover, .splitter:active { background-color: #4f46e5; }
        .fill-in-blank {
            border: none; border-bottom: 2px dashed #94a3b8; background-color: #f1f5f9;
            padding: 3px 8px; font-weight: 600; color: #0f172a; min-width: 120px;
            max-width: 170px; text-align: center; border-radius: 4px 4px 0 0; margin: 0 4px; display: inline-block;
        }
        .fill-in-blank:focus { outline: none; border-bottom: 2px solid #4f46e5; background-color: #e0e7ff; }
        .correct-answer-text { border-bottom: 2px solid #16a34a !important; color: #15803d !important; background-color: #dcfce7 !important; }
        .incorrect-answer-text { border-bottom: 2px solid #dc2626 !important; color: #b91c1c !important; background-color: #fee2e2 !important; text-decoration: line-through; }
        .explanation-box { margin-top: 0.65rem; padding: 0.75rem 1rem; background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 0.5rem; font-size: 0.875rem; }
    </style>
</head>
<body class="text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
    <div class="ielts-container">
        <!-- Top Navigation Bar -->
        <header class="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-xs">
            <div class="flex items-center gap-3">
                <a href="../index.html" class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors">
                    ← Back to Tests
                </a>
                <span class="text-slate-300">|</span>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Part ${partNum}
                </span>
                <h1 class="font-bold text-slate-800 text-sm sm:text-base">${title}</h1>
            </div>

            <!-- Audio Player Bar -->
            <div class="flex items-center gap-4 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
                <button id="custom-play-btn" class="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer">
                    <svg id="play-icon" class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    <svg id="pause-icon" class="w-4 h-4 fill-current hidden" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
                <div class="flex items-center gap-2 text-xs font-mono text-slate-600">
                    <span id="current-time">0:00</span>
                    <div id="progress-container" class="w-32 sm:w-48 h-2 bg-slate-300 rounded-full cursor-pointer overflow-hidden">
                        <div id="progress-bar" class="h-full bg-indigo-600 w-0 transition-all"></div>
                    </div>
                    <span id="total-time">0:00</span>
                </div>
                <audio id="custom-audio-element" src="${audioUrl}" preload="metadata"></audio>
            </div>

            <!-- Action Controls -->
            <div class="flex items-center gap-2">
                <button id="transcript-btn" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer">
                    Transcript
                </button>
                <button id="decrease-font-btn" class="w-7 h-7 rounded border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer">A-</button>
                <button id="increase-font-btn" class="w-7 h-7 rounded border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer">A+</button>
            </div>
        </header>

        <!-- Split Panes -->
        <main class="content-panes">
            <!-- Left Pane: Questions 1–5 -->
            <section id="left-pane" class="pane">
                <div class="mb-4">
                    <span class="text-xs font-bold uppercase tracking-wider text-indigo-600">Part ${partNum} • ${exerciseType}</span>
                    <h2 class="text-xl font-bold text-slate-900 mt-1 mb-2">${title}</h2>
                    <p class="text-sm text-slate-600">${desc}</p>
                </div>

                <div class="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mb-6">
                    <span class="text-xs font-bold text-indigo-800 uppercase tracking-wide">Questions 1–5</span>
                    <p class="text-sm text-slate-700 mt-1">Complete the notes below. Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> for each answer.</p>
                </div>

                <div class="space-y-4">
                    <div class="p-3 bg-white border border-slate-200 rounded-lg">
                        <span class="font-semibold text-slate-800">1. Contact name:</span>
                        <strong class="text-indigo-600 mx-1">1</strong>
                        <input type="text" name="s0_q1" class="fill-in-blank" placeholder="Answer...">
                    </div>
                    <div class="p-3 bg-white border border-slate-200 rounded-lg">
                        <span class="font-semibold text-slate-800">2. Address of venue:</span>
                        <strong class="text-indigo-600 mx-1">2</strong>
                        <input type="text" name="s0_q2" class="fill-in-blank" placeholder="Answer...">
                    </div>
                    <div class="p-3 bg-white border border-slate-200 rounded-lg">
                        <span class="font-semibold text-slate-800">3. Preferred start date:</span>
                        <strong class="text-indigo-600 mx-1">3</strong>
                        <input type="text" name="s0_q3" class="fill-in-blank" placeholder="Answer...">
                    </div>
                    <div class="p-3 bg-white border border-slate-200 rounded-lg">
                        <span class="font-semibold text-slate-800">4. Estimated cost per person: £</span>
                        <strong class="text-indigo-600 mx-1">4</strong>
                        <input type="text" name="s0_q4" class="fill-in-blank" placeholder="Answer...">
                    </div>
                    <div class="p-3 bg-white border border-slate-200 rounded-lg">
                        <span class="font-semibold text-slate-800">5. Special requirements:</span>
                        <strong class="text-indigo-600 mx-1">5</strong>
                        <input type="text" name="s0_q5" class="fill-in-blank" placeholder="Answer...">
                    </div>
                </div>
            </section>

            <!-- Draggable Divider -->
            <div id="splitter" class="splitter"></div>

            <!-- Right Pane: Questions 6–10 -->
            <section id="right-pane" class="pane">
                <div class="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mb-6">
                    <span class="text-xs font-bold text-indigo-800 uppercase tracking-wide">Questions 6–10</span>
                    <p class="text-sm text-slate-700 mt-1">Complete the notes below. Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> for each answer.</p>
                </div>

                <div class="space-y-4">
                    <div class="p-3 bg-white border border-slate-200 rounded-lg">
                        <span class="font-semibold text-slate-800">6. Registration deadline:</span>
                        <strong class="text-indigo-600 mx-1">6</strong>
                        <input type="text" name="s0_q6" class="fill-in-blank" placeholder="Answer...">
                    </div>
                    <div class="p-3 bg-white border border-slate-200 rounded-lg">
                        <span class="font-semibold text-slate-800">7. Equipment provided:</span>
                        <strong class="text-indigo-600 mx-1">7</strong>
                        <input type="text" name="s0_q7" class="fill-in-blank" placeholder="Answer...">
                    </div>
                    <div class="p-3 bg-white border border-slate-200 rounded-lg">
                        <span class="font-semibold text-slate-800">8. Main meeting location:</span>
                        <strong class="text-indigo-600 mx-1">8</strong>
                        <input type="text" name="s0_q8" class="fill-in-blank" placeholder="Answer...">
                    </div>
                    <div class="p-3 bg-white border border-slate-200 rounded-lg">
                        <span class="font-semibold text-slate-800">9. Reference code:</span>
                        <strong class="text-indigo-600 mx-1">9</strong>
                        <input type="text" name="s0_q9" class="fill-in-blank" placeholder="Answer...">
                    </div>
                    <div class="p-3 bg-white border border-slate-200 rounded-lg">
                        <span class="font-semibold text-slate-800">10. Contact telephone number:</span>
                        <strong class="text-indigo-600 mx-1">10</strong>
                        <input type="text" name="s0_q10" class="fill-in-blank" placeholder="Answer...">
                    </div>
                </div>

                <!-- Check Answers Button -->
                <div class="mt-8 pt-6 border-t border-slate-200">
                    <button id="check-btn" onclick="checkAnswers()" class="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer">
                        Check Answers
                    </button>
                    <div id="score-display" class="hidden mt-4 p-4 rounded-xl text-center font-bold text-base"></div>
                </div>
            </section>
        </main>

        <!-- Footer -->
        <footer class="bg-white border-t border-slate-200 px-6 py-2.5 text-xs text-slate-500 flex justify-between">
            <span>© IELTS Master Practice Simulator</span>
            <span>10 Questions • ~10 Minutes</span>
        </footer>
    </div>

    <!-- Transcript Modal -->
    <div id="transcript-modal" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 class="font-bold text-slate-900 text-base">Audio Transcript</h3>
                <button onclick="document.getElementById('transcript-modal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">×</button>
            </div>
            <div class="p-6 overflow-y-auto text-sm text-slate-700 leading-relaxed space-y-3">
                <p><strong>Speaker 1:</strong> Hello, thank you for calling. How can I help you today?</p>
                <p><strong>Speaker 2:</strong> Hi, I'm calling to inquire about the details for the upcoming session...</p>
                <p class="text-slate-400 italic text-xs mt-4">[Add full tapescript here]</p>
            </div>
        </div>
    </div>

    <script>
        // Answer Key
        const answers = {
            s0_q1: "sample answer",
            s0_q2: "sample answer",
            s0_q3: "sample answer",
            s0_q4: "sample answer",
            s0_q5: "sample answer",
            s0_q6: "sample answer",
            s0_q7: "sample answer",
            s0_q8: "sample answer",
            s0_q9: "sample answer",
            s0_q10: "sample answer"
        };

        // Audio Player Controller
        const audio = document.getElementById('custom-audio-element');
        const playBtn = document.getElementById('custom-play-btn');
        const playIcon = document.getElementById('play-icon');
        const pauseIcon = document.getElementById('pause-icon');
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const currentTimeEl = document.getElementById('current-time');
        const totalTimeEl = document.getElementById('total-time');

        const formatTime = (s) => {
            if (isNaN(s)) return "0:00";
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return \`\${m}:\${sec < 10 ? '0' : ''}\${sec}\`;
        };

        if (audio) {
            audio.addEventListener('loadedmetadata', () => {
                totalTimeEl.textContent = formatTime(audio.duration);
            });
            playBtn.addEventListener('click', () => {
                if (audio.paused) {
                    audio.play();
                    playIcon.classList.add('hidden');
                    pauseIcon.classList.remove('hidden');
                } else {
                    audio.pause();
                    playIcon.classList.remove('hidden');
                    pauseIcon.classList.add('hidden');
                }
            });
            audio.addEventListener('timeupdate', () => {
                currentTimeEl.textContent = formatTime(audio.currentTime);
                const pct = (audio.currentTime / audio.duration) * 100;
                progressBar.style.width = \`\${pct}%\`;
            });
            progressContainer.addEventListener('click', (e) => {
                const rect = progressContainer.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                audio.currentTime = pos * audio.duration;
            });
        }

        // Font Size Controls
        let fontSize = 16;
        document.getElementById('increase-font-btn').addEventListener('click', () => {
            if (fontSize < 24) fontSize += 1;
            document.documentElement.style.setProperty('--app-font-size', \`\${fontSize}px\`);
        });
        document.getElementById('decrease-font-btn').addEventListener('click', () => {
            if (fontSize > 13) fontSize -= 1;
            document.documentElement.style.setProperty('--app-font-size', \`\${fontSize}px\`);
        });

        // Transcript Modal Toggle
        document.getElementById('transcript-btn').addEventListener('click', () => {
            document.getElementById('transcript-modal').classList.remove('hidden');
        });

        // Answer Checking
        function checkAnswers() {
            let score = 0;
            for (let i = 1; i <= 10; i++) {
                const key = \`s0_q\${i}\`;
                const input = document.querySelector(\`input[name="\${key}"]\`);
                if (!input) continue;

                const userVal = input.value.trim().toLowerCase();
                const validAnswers = (answers[key] || '').toLowerCase().split('|').map(a => a.trim());

                if (validAnswers.includes(userVal)) {
                    input.classList.add('correct-answer-text');
                    input.classList.remove('incorrect-answer-text');
                    score++;
                } else {
                    input.classList.add('incorrect-answer-text');
                    input.classList.remove('correct-answer-text');
                }
            }

            const scoreDisplay = document.getElementById('score-display');
            scoreDisplay.classList.remove('hidden');
            scoreDisplay.textContent = \`Your Score: \${score} / 10 (\${score >= 8 ? 'Band 8-9' : score >= 6 ? 'Band 6-7' : 'Needs Practice'})\`;
            scoreDisplay.className = score >= 7 
                ? 'mt-4 p-4 rounded-xl text-center font-bold bg-green-50 text-green-800 border border-green-200' 
                : 'mt-4 p-4 rounded-xl text-center font-bold bg-amber-50 text-amber-800 border border-amber-200';
        }
    </script>
</body>
</html>`;
}

async function main() {
  log(`\n${bold('⚡ IELTS Listening Simulator - Test Scaffolder & Generator')}`);
  log(`${cyan('Repository:')} ${REPO_DIR}\n`);

  let partNum = cliPart;
  let title = cliTitle;
  let exerciseType = cliType;
  let audioUrl = cliAudio;

  // Interactive mode if arguments are not fully provided
  if (!partNum || !title) {
    log('Please provide details for the new practice test:\n');

    if (!partNum) {
      const partInput = await prompt('Module Part (1, 2, 3, or 4)', '1');
      partNum = parseInt(partInput, 10) || 1;
    }

    if (!title) {
      title = await prompt('Test Title (e.g. City Library Tour)', 'New Practice Test');
    }

    exerciseType = await prompt('Exercise Type', exerciseType);
    audioUrl = await prompt('Audio File URL (optional)', audioUrl);
  }

  partNum = Math.min(Math.max(parseInt(partNum, 10), 1), 4);
  const cleanTitle = title.trim();
  const filename = `Part ${partNum} - ${cleanTitle}.html`;
  const targetDir = path.join(REPO_DIR, `Part ${partNum}`);
  const targetPath = path.join(targetDir, filename);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (fs.existsSync(targetPath)) {
    log(yellow(`\n⚠️ File already exists at: Part ${partNum}/${filename}`));
    const overwrite = await prompt('Do you want to overwrite it? (y/N)', 'n');
    if (overwrite.toLowerCase() !== 'y') {
      log(red('Cancelled. No files were written.'));
      return;
    }
  }

  // Generate File
  const htmlContent = generateTestTemplate({ partNum, title: cleanTitle, exerciseType, audioUrl });
  fs.writeFileSync(targetPath, htmlContent, 'utf8');

  log(`\n${green('✓ Successfully created test simulator:')}`);
  log(`  File: ${cyan(`Part ${partNum}/${filename}`)}`);

  // Run update-index automatically
  log(`\n${cyan('Updating index.html with the new test...')}`);
  try {
    execSync('node update-index.js', { cwd: REPO_DIR, stdio: 'inherit' });
    log(`\n${green('🎉 Test is scaffolded and live on index.html!')}`);
  } catch (err) {
    log(yellow('Could not automatically run update-index.js. Please run it manually.'));
  }
}

main().catch(console.error);
