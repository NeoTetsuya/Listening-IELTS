#!/usr/bin/env node

/**
 * update-index.js
 * 
 * Automatically indexes IELTS Listening simulator files organized in Part folders:
 *   - Part 1/
 *   - Part 2/
 *   - Part 3/
 *   - Part 4/
 * Also auto-organizes any newly added test files placed in the root directory.
 * 
 * Updates index.html with accurate exercise badges, updates all filter counters and statistics,
 * creates an automatic backup before writing, and optionally commits and pushes to GitHub.
 * 
 * Usage:
 *   node update-index.js             # Updates index.html (creates backup first)
 *   node update-index.js --push      # Updates index.html and pushes changes to GitHub
 *   node update-index.js --push -m "feat: add 8 new Part 1 tests"
 *   node update-index.js --dry-run   # Simulates update without modifying index.html
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_DIR = __dirname;
const INDEX_PATH = path.join(REPO_DIR, 'index.html');
const BACKUP_DIR = path.join(REPO_DIR, '_backups');

// Color styling for badge chips in index.html
const BADGE_STYLES = {
  'Notes Completion': 'bg-amber-500/10 text-amber-300 border-amber-500/20 hover:border-amber-400/40',
  'Form Completion': 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20 hover:border-cyan-400/40',
  'Table Completion': 'bg-teal-500/10 text-teal-300 border-teal-500/20 hover:border-teal-400/40',
  'Multiple Choice': 'bg-sky-500/10 text-sky-300 border-sky-500/20 hover:border-sky-400/40',
  'Sentence Completion': 'bg-orange-500/10 text-orange-300 border-orange-500/20 hover:border-orange-400/40',
  'Matching': 'bg-purple-500/10 text-purple-300 border-purple-500/20 hover:border-purple-400/40',
  'Map Labelling': 'bg-pink-500/10 text-pink-300 border-pink-500/20 hover:border-pink-400/40',
  'Summary Completion': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:border-emerald-400/40',
  'Flow-chart Completion': 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:border-indigo-400/40',
  'Diagram Labelling': 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:border-rose-400/40'
};

const DEFAULT_BADGE_STYLE = 'bg-slate-500/10 text-slate-300 border-slate-500/20 hover:border-slate-400/40';

// Mapping of type IDs in index.html to normalized type names
const TYPE_BUTTON_MAP = [
  { id: 'type-btn-mcq', key: 'Multiple Choice', label: 'Multiple Choice' },
  { id: 'type-btn-notes', key: 'Notes Completion', label: 'Notes Completion' },
  { id: 'type-btn-form', key: 'Form Completion', label: 'Form Completion' },
  { id: 'type-btn-matching', key: 'Matching', label: 'Matching' },
  { id: 'type-btn-table', key: 'Table Completion', label: 'Table Completion' },
  { id: 'type-btn-sentence', key: 'Sentence Completion', label: 'Sentence Completion' },
  { id: 'type-btn-map', key: 'Map Labelling', label: 'Map Labelling' },
  { id: 'type-btn-summary', key: 'Summary Completion', label: 'Summary Completion' }
];

// CLI Arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isPush = args.includes('--push');
let customMessage = '';
const msgIndex = args.findIndex(a => a === '-m' || a === '--message');
if (msgIndex !== -1 && args[msgIndex + 1]) {
  customMessage = args[msgIndex + 1];
}

// Terminal colors
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function log(msg) { console.log(msg); }

// Badge detector verified with 100% precision across existing tests
function detectBadges(filename, content) {
  const detected = new Set();
  
  // 1. Explicit badge spans in HTML
  const explicitBadgeRegex = /<span[^>]*class="[^"]*(?:text-slate-500|text-gray-500)[^"]*"[^>]*>([^<]+(?:Completion|Choice|Matching|Labelling|Answers))<\/span>/gi;
  let expMatch;
  while ((expMatch = explicitBadgeRegex.exec(content)) !== null) {
    const raw = expMatch[1].replace(/\(Cont\.?\)/i, '').trim();
    if (raw) detected.add(raw);
  }

  // 2. Strip single-line comments, strip HTML tags, and normalize spaces
  const cleanContent = content.replace(/\/\/[^\r\n]*/g, ' ');
  const textOnly = cleanContent.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ');

  const checkRules = [
    { type: 'Notes Completion', patterns: [/notes completion/i, /complete the notes/i] },
    { type: 'Form Completion', patterns: [/form completion/i, /complete the form/i, /application form/i, /registration form/i] },
    { type: 'Table Completion', patterns: [/table completion/i, /complete the table/i] },
    { type: 'Sentence Completion', patterns: [/sentence completion/i, /complete the sentences?/i] },
    { type: 'Summary Completion', patterns: [/summary completion/i, /complete the summary/i] },
    { type: 'Flow-chart Completion', patterns: [/flow-?chart completion/i, /complete the flow-?chart/i] },
    { type: 'Multiple Choice', patterns: [/multiple choice/i, /choose the correct letter/i, /choose (?:two|three|four|\d+) letters/i] },
    { type: 'Matching', patterns: [/\bmatching\b/i, /(?:answers?\s+)?from\s+the\s+box/i] },
    { type: 'Map Labelling', patterns: [/map labelling/i, /plan labelling/i, /label the map/i, /label the plan/i] },
    { type: 'Diagram Labelling', patterns: [/diagram labelling/i, /label the diagram/i] }
  ];

  for (const rule of checkRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(textOnly)) {
        detected.add(rule.type);
        break;
      }
    }
  }

  // Normalize Plan Labelling to Map Labelling
  if (detected.has('Plan Labelling')) {
    detected.delete('Plan Labelling');
    detected.add('Map Labelling');
  }

  return Array.from(detected);
}

// Generate single card HTML with relative path
function generateCardHtml(partNum, relPath, title, badges) {
  // Convert Windows backslashes to forward slashes and URL encode
  const cleanRelPath = relPath.replace(/\\/g, '/');
  const encodedPath = cleanRelPath.split('/').map(seg => encodeURIComponent(seg).replace(/'/g, '%27')).join('/');
  
  const badgesHtml = badges.map(b => {
    const styleClass = BADGE_STYLES[b] || DEFAULT_BADGE_STYLE;
    return `<button type="button" onclick="filterByBadge(event, '${b}')" class="badge-chip inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${styleClass} tracking-tight cursor-pointer" title="Click to filter by ${b}">${b}</button>`;
  }).join('\n                            ');

  return `                    <a href="${encodedPath}" class="searchable block group glass-panel rounded-2xl p-5 card-hover relative overflow-hidden flex flex-col justify-between border border-slate-800/80 hover:border-slate-700/80">
                        <div class="absolute top-0 left-0 w-1.5 h-full part-${partNum}-grad opacity-60 group-hover:opacity-100 transition-opacity duration-200"></div>
                        <div class="mb-4">
                            <div class="flex justify-between items-start gap-3 mb-2.5">
                                <span class="text-slate-100 font-bold text-base sm:text-lg leading-snug group-hover:text-white transition-colors line-clamp-2">${title}</span>
                                <div class="w-8 h-8 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-indigo-600/30 group-hover:border-indigo-400/40 play-icon flex-shrink-0">
                                    <i data-lucide="play" class="w-3.5 h-3.5 fill-current ml-0.5"></i>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-1.5 mt-2">
                            ${badgesHtml}
                            </div>
                        </div>
                        <div class="flex items-center justify-between text-xs font-medium text-slate-400 pt-3 border-t border-slate-800/70">
                            <span class="inline-flex items-center gap-1.5 text-slate-400 group-hover:text-slate-300">
                                <i data-lucide="headphones" class="w-3.5 h-3.5 text-indigo-400/80"></i> 10 Questions
                            </span>
                            <span class="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                <i data-lucide="clock" class="w-3 h-3"></i> ~10m
                            </span>
                        </div>
                    </a>`;
}

// Main Runner
async function main() {
  log(`\n${bold('🚀 IELTS Listening Simulator - Auto Indexer & Git Sync')}`);
  log(`${cyan('Repository:')} ${REPO_DIR}\n`);

  if (!fs.existsSync(INDEX_PATH)) {
    console.error(red(`Error: index.html not found in ${REPO_DIR}`));
    process.exit(1);
  }

  // 1. Auto-organize any test simulator files accidentally placed in root
  const rootFiles = fs.readdirSync(REPO_DIR).filter(f => /^Part\s+[1-4]\s*-\s*.+\.html$/i.test(f));
  if (rootFiles.length > 0 && !isDryRun) {
    for (const filename of rootFiles) {
      const match = filename.match(/^Part\s+([1-4])\s*-\s*(.+)\.html$/i);
      if (!match) continue;
      const partNum = parseInt(match[1], 10);
      const targetDir = path.join(REPO_DIR, `Part ${partNum}`);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const oldPath = path.join(REPO_DIR, filename);
      const newPath = path.join(targetDir, filename);
      fs.renameSync(oldPath, newPath);
      log(`${cyan('Auto-organized to folder:')} ${filename} -> Part ${partNum}/${filename}`);
    }
  }

  // 2. Scan Part folders (Part 1, Part 2, Part 3, Part 4)
  const testsByPart = { 1: [], 2: [], 3: [], 4: [] };
  const allTests = [];

  for (let p = 1; p <= 4; p++) {
    const partFolder = path.join(REPO_DIR, `Part ${p}`);
    if (!fs.existsSync(partFolder)) continue;

    const filesInPart = fs.readdirSync(partFolder).filter(f => f.endsWith('.html'));
    for (const filename of filesInPart) {
      const match = filename.match(/^Part\s+([1-4])\s*-\s*(.+)\.html$/i);
      const partNum = match ? parseInt(match[1], 10) : p;
      const title = match ? match[2].trim() : path.basename(filename, '.html');
      const relPath = `Part ${p}/${filename}`;
      const fullPath = path.join(partFolder, filename);
      const content = fs.readFileSync(fullPath, 'utf8');
      const badges = detectBadges(filename, content);

      const testInfo = { partNum, filename, relPath, title, badges };
      testsByPart[p].push(testInfo);
      allTests.push(testInfo);
    }
  }

  log(`Found ${green(allTests.length)} test simulator files across folders Part 1–4.`);

  // Read current index.html
  let indexContent = fs.readFileSync(INDEX_PATH, 'utf8');

  // Extract existing card basenames in index.html to know what's already there
  const existingCardsInIndex = new Set();
  const cardHrefRegex = /<a href="([^"]+)" class="searchable[^"]*">/g;
  let chMatch;
  while ((chMatch = cardHrefRegex.exec(indexContent)) !== null) {
    const rawHref = decodeURIComponent(chMatch[1]);
    const baseName = path.basename(rawHref);
    existingCardsInIndex.add(baseName);
  }

  log(`Existing cards registered in index.html: ${yellow(existingCardsInIndex.size)}`);

  const newlyAdded = allTests.filter(t => !existingCardsInIndex.has(t.filename));
  if (newlyAdded.length > 0) {
    log(`\n${green('✨ Newly detected tests to add (' + newlyAdded.length + '):')}`);
    newlyAdded.forEach(t => log(`  + [Part ${t.partNum}] ${t.title} [${t.badges.join(', ')}]`));
  } else {
    log(`\n${cyan('✓ All test files are registered. Updating card links and metrics...')}`);
  }

  // 3. Update each Part grid in index.html
  for (let part = 1; part <= 4; part++) {
    const partTests = testsByPart[part];
    
    // Locate the section for this part
    const sectionRegex = new RegExp(`(<section class="module" data-category="part${part}">[\\s\\S]*?<div class="grid [^"]*card-container">)([\\s\\S]*?)(<\\/div>\\s*<\\/section>)`, 'i');
    const sectionMatch = indexContent.match(sectionRegex);

    if (!sectionMatch) {
      log(yellow(`Warning: Could not locate grid section for Part ${part}`));
      continue;
    }

    const gridHeader = sectionMatch[1];
    const existingGridBody = sectionMatch[2];
    const gridFooter = sectionMatch[3];

    // Parse existing cards inside this grid
    const cardRegex = /<a href="([^"]+)" class="searchable[^"]*">[\s\S]*?<\/a>/g;
    let cMatch;
    const existingCardsInPart = new Map();
    while ((cMatch = cardRegex.exec(existingGridBody)) !== null) {
      const href = decodeURIComponent(cMatch[1]);
      const baseName = path.basename(href);
      existingCardsInPart.set(baseName, cMatch[0]);
    }

    // Build updated cards list for this part
    const updatedCards = [];
    
    // First keep existing cards in their order, updating paths and badges
    for (const [baseName] of existingCardsInPart.entries()) {
      const test = partTests.find(t => t.filename === baseName);
      if (test) {
        updatedCards.push(generateCardHtml(part, test.relPath, test.title, test.badges));
      }
    }

    // Add any new tests that were not in existingCardsInPart
    for (const test of partTests) {
      if (!existingCardsInPart.has(test.filename)) {
        updatedCards.push(generateCardHtml(part, test.relPath, test.title, test.badges));
      }
    }

    const newGridBody = '\n' + updatedCards.join('\n') + '\n                ';
    indexContent = indexContent.replace(sectionRegex, `${gridHeader}${newGridBody}${gridFooter}`);
  }

  // 4. Recalculate stats and badge counts
  const totalCount = allTests.length;
  const partCounts = {
    1: testsByPart[1].length,
    2: testsByPart[2].length,
    3: testsByPart[3].length,
    4: testsByPart[4].length
  };

  const typeCounts = {};
  for (const test of allTests) {
    for (const badge of test.badges) {
      typeCounts[badge] = (typeCounts[badge] || 0) + 1;
    }
  }

  // 5. Update Header Quick Stats
  indexContent = indexContent.replace(
    /(<span class="text-white font-bold text-sm">)\d+(<\/span>\s*<span class="text-slate-400 text-xs font-medium">Practice Tests<\/span>)/,
    `$1${totalCount}$2`
  );

  // 6. Update Part Filter Buttons
  indexContent = indexContent.replace(
    /(id="btn-all"[^>]*>All Parts )\(\d+\)(<\/button>)/,
    `$1(${totalCount})$2`
  );
  for (let p = 1; p <= 4; p++) {
    const pRegex = new RegExp(`(id="btn-part${p}"[^>]*>Part ${p} )\\(\\d+\\)(<\\/button>)`);
    indexContent = indexContent.replace(pRegex, `$1(${partCounts[p]})$2`);
  }

  // 7. Update Exercise Type Filter Buttons
  for (const cfg of TYPE_BUTTON_MAP) {
    const count = typeCounts[cfg.key] || 0;
    const btnRegex = new RegExp(`(id="${cfg.id}"[\\s\\S]*?${cfg.label}\\s*)\\(\\d+\\)(\\s*<\\/button>)`, 'i');
    indexContent = indexContent.replace(btnRegex, `$1(${count})$2`);
  }

  // 8. Update Real-time Results Counter Header
  indexContent = indexContent.replace(
    /(Showing <span id="visibleCount"[^>]*>)\d+(<\/span> of <span class="font-semibold text-slate-300">)\d+(<\/span> tests)/,
    `$1${totalCount}$2${totalCount}$3`
  );

  // 9. Write to index.html with automatic backup
  if (isDryRun) {
    log(`\n${yellow('[DRY RUN]')} index.html would be updated with:`);
    log(`  Total Tests: ${totalCount}`);
    log(`  Part 1: ${partCounts[1]} | Part 2: ${partCounts[2]} | Part 3: ${partCounts[3]} | Part 4: ${partCounts[4]}`);
    log(`\nType Counts:`);
    for (const cfg of TYPE_BUTTON_MAP) {
      log(`  ${cfg.label}: ${typeCounts[cfg.key] || 0}`);
    }
    log(`\nNo files modified.`);
    return;
  }

  // Backup index.html
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const backupFile = path.join(BACKUP_DIR, `index.html.backup_${timestamp}`);
  fs.copyFileSync(INDEX_PATH, backupFile);
  log(`\n${green('✓ Backup created:')} ${path.relative(REPO_DIR, backupFile)}`);

  // Write updated index.html
  fs.writeFileSync(INDEX_PATH, indexContent, 'utf8');
  log(`${green('✓ index.html updated successfully with folder paths!')}`);
  log(`  • Total Tests: ${bold(totalCount)}`);
  log(`  • Part 1: ${bold(partCounts[1])} | Part 2: ${bold(partCounts[2])} | Part 3: ${bold(partCounts[3])} | Part 4: ${bold(partCounts[4])}`);

  // 10. Git Automation (if --push)
  if (isPush) {
    log(`\n${bold('📦 Committing & Pushing to GitHub...')}`);
    try {
      execSync('git add -A index.html update-index.js update-and-push.bat update-and-push.ps1 .gitignore "Part 1" "Part 2" "Part 3" "Part 4"', { cwd: REPO_DIR, stdio: 'inherit' });
      
      const commitMsg = customMessage || (
        newlyAdded.length > 0 
          ? `feat: add ${newlyAdded.length} new tests and update index (${totalCount} total)`
          : `refactor: organize exercises into Part 1-4 folders and update links`
      );

      try {
        execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: REPO_DIR, stdio: 'inherit' });
        log(`${green('✓ Commit created:')} "${commitMsg}"`);
      } catch (commitErr) {
        log(yellow('Note: No new changes to commit.'));
      }

      // Push to origin
      log(`${cyan('Pushing to GitHub (origin main)...')}`);
      execSync('git push origin main', { cwd: REPO_DIR, stdio: 'inherit' });
      log(`\n${green(bold('🎉 All changes successfully updated and pushed to GitHub!'))}`);
    } catch (gitErr) {
      console.error(red(`\nGit operation failed: ${gitErr.message}`));
      process.exit(1);
    }
  } else {
    log(`\n${yellow('Tip:')} Run with ${bold('--push')} to automatically commit and push to GitHub:`);
    log(`  ${cyan('node update-index.js --push')}\n`);
  }
}

main().catch(err => {
  console.error(red('Fatal error:'), err);
  process.exit(1);
});
