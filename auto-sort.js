/**
 * IELTS Listening Simulator - Standalone Auto Sorter
 * 
 * Automatically detects, standardizes, and sorts test simulator files into their
 * respective module folders (Part 1, Part 2, Part 3, Part 4).
 * 
 * Usage:
 *   node auto-sort.js            # Automatically sorts and standardizes all test files
 *   node auto-sort.js --dry-run  # Preview moves and renames without making changes
 */

const fs = require('fs');
const path = require('path');

const REPO_DIR = __dirname;

// CLI Flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Terminal color helpers
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function log(msg) { console.log(msg); }

/**
 * Detect IELTS Part number (1, 2, 3, or 4) from filename and file content.
 */
function detectPartNumber(filename, content = '') {
  // 1. Check filename
  const fnMatch = filename.match(/part\s*([1-4])/i) || filename.match(/section\s*([1-4])/i);
  if (fnMatch) return parseInt(fnMatch[1], 10);

  if (!content) return null;

  // 2. Check explicit Part badge or attributes in HTML content
  const badgeMatch = content.match(/Part\s*<span[^>]*>([1-4])<\/span>/i) 
    || content.match(/data-part=["']([1-4])["']/i)
    || content.match(/Part\s*([1-4])\b/i)
    || content.match(/Section\s*([1-4])\b/i);
  if (badgeMatch) return parseInt(badgeMatch[1], 10);

  // 3. Check official IELTS module definitions & context keywords
  if (/Social\s+Dialogue/i.test(content) || /everyday\s+social\s+context\s+between\s+two/i.test(content)) return 1;
  if (/Social\s+Monologue/i.test(content) || /local\s+facilities\s+or\s+community/i.test(content)) return 2;
  if (/Educational\s+Dialogue/i.test(content) || /conversation\s+between\s+up\s+to\s+four\s+people/i.test(content)) return 3;
  if (/Academic\s+Lecture/i.test(content) || /monologue\s+on\s+an\s+academic\s+subject/i.test(content)) return 4;

  return null;
}

/**
 * Clean and format test title to Title Case.
 */
function cleanTestTitle(filename, content = '') {
  let title = path.basename(filename, '.html');
  
  // Try extracting from <title> if meaningful and not generic
  if (content) {
    const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && !titleMatch[1].includes('Listening for IELTS')) {
      const rawTitle = titleMatch[1].split(' - ')[0].trim();
      if (rawTitle && rawTitle.length < 80 && !rawTitle.toLowerCase().includes('simulator')) {
        title = rawTitle;
      }
    }
  }

  // Strip Part X - prefix if present
  title = title.replace(/^Part\s*[1-4]\s*[-–—_:]\s*/i, '');
  title = title.replace(/^Section\s*[1-4]\s*[-–—_:]\s*/i, '');

  // Strip simulator/test suffixes
  title = title.replace(/[-_]listening[-_]simulator$/i, '');
  title = title.replace(/[-_]simulator$/i, '');
  title = title.replace(/[-_]test$/i, '');

  // Convert snake_case or kebab-case to words
  title = title.replace(/[_-]+/g, ' ').trim();

  // Convert to Title Case
  const minorWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of']);
  const words = title.split(/\s+/);
  const titleCased = words.map((w, idx) => {
    const lower = w.toLowerCase();
    if (idx > 0 && minorWords.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');

  return titleCased;
}

/**
 * Core Sorter Function:
 * Scans repo directory and organizes all test files into Part 1–4 folders.
 */
function autoSortFiles(options = {}) {
  const baseDir = options.repoDir || REPO_DIR;
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
  const ignoredFiles = new Set(['index.html', 'mockfile.html', 'admin.html']);

  let movedCount = 0;
  let normalizedCount = 0;

  // 1. Scan root directory for unorganized test files
  const rootFiles = fs.readdirSync(baseDir).filter(f => {
    if (!f.endsWith('.html')) return false;
    if (ignoredFiles.has(f.toLowerCase())) return false;
    if (f.startsWith('index.html.backup')) return false;
    return true;
  });

  if (rootFiles.length > 0) {
    log(cyan(`Found ${rootFiles.length} file(s) in root directory to evaluate...`));
    for (const filename of rootFiles) {
      const fullPath = path.join(baseDir, filename);
      const content = fs.readFileSync(fullPath, 'utf8');
      const partNum = detectPartNumber(filename, content);

      if (partNum) {
        const cleanTitle = cleanTestTitle(filename, content);
        const standardName = `Part ${partNum} - ${cleanTitle}.html`;
        const targetDir = path.join(baseDir, `Part ${partNum}`);
        if (!fs.existsSync(targetDir) && !dryRun) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        const targetPath = path.join(targetDir, standardName);

        if (!dryRun) {
          fs.renameSync(fullPath, targetPath);
        }
        log(`  ${green('✓')} Auto-sorted: ${filename} -> Part ${partNum}/${standardName}`);
        movedCount++;
      } else {
        log(`  ${yellow('⚠️')} Could not determine Part for root file: ${filename}`);
      }
    }
  }

  // 2. Scan existing Part folders (Part 1–4) to ensure standardized filenames and correct placement
  for (let p = 1; p <= 4; p++) {
    const partFolder = path.join(baseDir, `Part ${p}`);
    if (!fs.existsSync(partFolder)) continue;

    const files = fs.readdirSync(partFolder).filter(f => f.endsWith('.html'));
    for (const filename of files) {
      const fullPath = path.join(partFolder, filename);
      const content = fs.readFileSync(fullPath, 'utf8');
      const actualPart = detectPartNumber(filename, content) || p;

      // If file belongs to a different Part, move to proper folder
      if (actualPart !== p) {
        const cleanTitle = cleanTestTitle(filename, content);
        const standardName = `Part ${actualPart} - ${cleanTitle}.html`;
        const correctFolder = path.join(baseDir, `Part ${actualPart}`);
        if (!fs.existsSync(correctFolder) && !dryRun) {
          fs.mkdirSync(correctFolder, { recursive: true });
        }
        const targetPath = path.join(correctFolder, standardName);

        if (!dryRun) {
          fs.renameSync(fullPath, targetPath);
        }
        log(`  ${green('✓')} Re-sorted: Part ${p}/${filename} -> Part ${actualPart}/${standardName}`);
        movedCount++;
        continue;
      }

      // If filename needs normalization (e.g. missing "Part X - ")
      if (!filename.startsWith(`Part ${p} - `)) {
        const cleanTitle = cleanTestTitle(filename, content);
        const standardName = `Part ${p} - ${cleanTitle}.html`;
        const targetPath = path.join(partFolder, standardName);

        if (!dryRun && fullPath !== targetPath) {
          fs.renameSync(fullPath, targetPath);
        }
        log(`  ${green('✓')} Normalized: Part ${p}/${filename} -> ${standardName}`);
        normalizedCount++;
      }
    }
  }

  return { movedCount, normalizedCount };
}

// Standalone CLI Execution
if (require.main === module) {
  log(`\n${bold('⚡ IELTS Listening Simulator - Standalone Auto Sorter')}`);
  log(`${cyan('Target Directory:')} ${REPO_DIR}`);
  if (isDryRun) log(`${yellow('[DRY RUN MODE ENABLED - No files will be moved or renamed]')}\n`);
  else log('');

  const result = autoSortFiles();

  log(`\n${bold('--- Auto Sorter Summary ---')}`);
  log(`• Files Moved to Module Folders: ${green(result.movedCount)}`);
  log(`• Filenames Normalized: ${green(result.normalizedCount)}`);
  if (result.movedCount === 0 && result.normalizedCount === 0) {
    log(`✓ All files are already perfectly organized in Part 1–4 folders.`);
  }
  log('');
}

module.exports = {
  detectPartNumber,
  cleanTestTitle,
  autoSortFiles
};
