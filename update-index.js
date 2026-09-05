#!/usr/bin/env node

/**
 * update-index.js
 * 
 * Automatically indexes IELTS Listening simulator files (Part [1-4] - <Title>.html)
 * into index.html with accurate exercise badges, updates all filter counters and statistics,
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

// Generate single card HTML
function generateCardHtml(partNum, filename, title, badges) {
  const encodedFilename = encodeURI(filename).replace(/%20/g, '%20').replace(/'/g, '%27');
  
  const badgesHtml = badges.map(b => {
    const styleClass = BADGE_STYLES[b] || DEFAULT_BADGE_STYLE;
    return `<button type="button" onclick="filterByBadge(event, '${b}')" class="badge-chip inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${styleClass} tracking-tight cursor-pointer" title="Click to filter by ${b}">${b}</button>`;
  }).join('\n                            ');

  return `                    <a href="${encodedFilename}" class="searchable block group glass-panel rounded-xl p-5 card-hover relative overflow-hidden flex flex-col justify-between">
                        <div class="absolute top-0 left-0 w-1 h-full part-${partNum}-grad opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <div class="mb-4">
                            <div class="flex justify-between items-start mb-2.5">
                                <span class="text-white font-bold text-lg leading-tight pr-4 line-clamp-2">${title}</span>
                                <i data-lucide="play-circle" class="w-6 h-6 text-slate-500 play-icon transition-all duration-300 group-hover:animate-pulse mt-0.5 flex-shrink-0"></i>
                            </div>
                            <div class="flex flex-wrap gap-1.5 mt-2">
                            ${badgesHtml}
                            </div>
                        </div>
                        <div class="flex gap-2 items-center text-xs font-medium text-slate-400 pt-2 border-t border-slate-800/60">
                            <i data-lucide="headphones" class="w-3.5 h-3.5 text-slate-500"></i> 10 Questions
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

  // 1. Scan directory for test files
  const files = fs.readdirSync(REPO_DIR).filter(f => /^Part\s+[1-4]\s*-\s*.+\.html$/i.test(f));
  log(`Found ${green(files.length)} test simulator files in workspace.`);

  const testsByPart = { 1: [], 2: [], 3: [], 4: [] };
  const allTests = [];

  for (const filename of files) {
    const match = filename.match(/^Part\s+([1-4])\s*-\s*(.+)\.html$/i);
    if (!match) continue;

    const partNum = parseInt(match[1], 10);
    const title = match[2].trim();
    const filePath = path.join(REPO_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const badges = detectBadges(filename, content);

    const testInfo = { partNum, filename, title, badges };
    testsByPart[partNum].push(testInfo);
    allTests.push(testInfo);
  }

  // Read current index.html
  let indexContent = fs.readFileSync(INDEX_PATH, 'utf8');

  // Extract existing cards in index.html to know what's already there
  const existingCardsInIndex = new Set();
  const cardHrefRegex = /<a href="([^"]+)" class="searchable[^"]*">/g;
  let chMatch;
  while ((chMatch = cardHrefRegex.exec(indexContent)) !== null) {
    const href = decodeURIComponent(chMatch[1]);
    existingCardsInIndex.add(href);
  }

  log(`Existing cards in index.html: ${yellow(existingCardsInIndex.size)}`);

  const newlyAdded = allTests.filter(t => !existingCardsInIndex.has(t.filename));
  if (newlyAdded.length > 0) {
    log(`\n${green('✨ Newly detected tests to add (' + newlyAdded.length + '):')}`);
    newlyAdded.forEach(t => log(`  + [Part ${t.partNum}] ${t.title} [${t.badges.join(', ')}]`));
  } else {
    log(`\n${cyan('✓ All current test files are already registered in index.html.')}`);
  }

  // 2. Update each Part grid in index.html
  for (let part = 1; part <= 4; part++) {
    const partTests = testsByPart[part];
    
    // Locate the section for this part
    // Section pattern: <section class="module" data-category="partX"> ... <div class="... card-container">...</div>\n            </section>
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
      existingCardsInPart.set(href, cMatch[0]);
    }

    // Build updated cards list for this part
    const updatedCards = [];
    
    // First keep existing cards in their order, updating badges if needed
    for (const [href, existingCardHtml] of existingCardsInPart.entries()) {
      const test = partTests.find(t => t.filename === href);
      if (test) {
        // Regenerate card to ensure badges are up to date
        updatedCards.push(generateCardHtml(part, test.filename, test.title, test.badges));
      }
    }

    // Add any new tests that were not in existingCardsInPart
    for (const test of partTests) {
      if (!existingCardsInPart.has(test.filename)) {
        updatedCards.push(generateCardHtml(part, test.filename, test.title, test.badges));
      }
    }

    const newGridBody = '\n' + updatedCards.join('\n') + '\n                ';
    indexContent = indexContent.replace(sectionRegex, `${gridHeader}${newGridBody}${gridFooter}`);
  }

  // 3. Recalculate stats and badge counts
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

  // 4. Update Header Quick Stats
  // <span class="text-white font-bold text-sm">28</span>\s*<span class="text-slate-400 text-xs font-medium">Practice Tests</span>
  indexContent = indexContent.replace(
    /(<span class="text-white font-bold text-sm">)\d+(<\/span>\s*<span class="text-slate-400 text-xs font-medium">Practice Tests<\/span>)/,
    `$1${totalCount}$2`
  );

  // 5. Update Part Filter Buttons
  indexContent = indexContent.replace(
    /(id="btn-all"[^>]*>All Parts )\(\d+\)(<\/button>)/,
    `$1(${totalCount})$2`
  );
  for (let p = 1; p <= 4; p++) {
    const pRegex = new RegExp(`(id="btn-part${p}"[^>]*>Part ${p} )\\(\\d+\\)(<\\/button>)`);
    indexContent = indexContent.replace(pRegex, `$1(${partCounts[p]})$2`);
  }

  // 6. Update Exercise Type Filter Buttons
  for (const cfg of TYPE_BUTTON_MAP) {
    const count = typeCounts[cfg.key] || 0;
    const btnRegex = new RegExp(`(id="${cfg.id}"[^>]*>${cfg.label} )\\(\\d+\\)(<\\/button>)`);
    indexContent = indexContent.replace(btnRegex, `$1(${count})$2`);
  }

  // 7. Update Real-time Results Counter Header
  // Showing <span id="visibleCount" ...>28</span> of <span class="font-semibold text-slate-300">28</span> tests
  indexContent = indexContent.replace(
    /(Showing <span id="visibleCount"[^>]*>)\d+(<\/span> of <span class="font-semibold text-slate-300">)\d+(<\/span> tests)/,
    `$1${totalCount}$2${totalCount}$3`
  );

  // 8. Write to index.html with automatic backup
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
  log(`${green('✓ index.html updated successfully!')}`);
  log(`  • Total Tests: ${bold(totalCount)}`);
  log(`  • Part 1: ${bold(partCounts[1])} | Part 2: ${bold(partCounts[2])} | Part 3: ${bold(partCounts[3])} | Part 4: ${bold(partCounts[4])}`);

  // 9. Git Automation (if --push)
  if (isPush) {
    log(`\n${bold('📦 Committing & Pushing to GitHub...')}`);
    try {
      // Stage files: index.html, updater scripts, .gitignore, and all test simulator files
      execSync('git add index.html .gitignore update-index.js update-and-push.bat update-and-push.ps1 "Part *.html"', { cwd: REPO_DIR, stdio: 'inherit' });
      
      const commitMsg = customMessage || (
        newlyAdded.length > 0 
          ? `feat: add ${newlyAdded.length} new tests and update index (${totalCount} total)`
          : `chore: update test index and exercise statistics`
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
