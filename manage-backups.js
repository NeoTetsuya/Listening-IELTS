/**
 * IELTS Listening Simulator - Backup Manager & Restore Tool
 * 
 * Lists, prunes, and restores backups created in _backups/.
 * 
 * Usage:
 *   node manage-backups.js             # List all stored backups
 *   node manage-backups.js --prune     # Keep latest 5 backups of each type, remove older ones
 *   node manage-backups.js --keep 3    # Keep latest 3 backups of each type
 *   node manage-backups.js --restore   # Interactively choose a backup to restore
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const REPO_DIR = __dirname;
const BACKUP_DIR = path.join(REPO_DIR, '_backups');

const args = process.argv.slice(2);
const isPrune = args.includes('--prune') || args.includes('--clean');
const isRestore = args.includes('--restore');
const keepIndex = args.indexOf('--keep');
const keepCount = keepIndex !== -1 && args[keepIndex + 1] ? parseInt(args[keepIndex + 1], 10) : 5;

// Terminal colors
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function log(msg) { console.log(msg); }

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const files = fs.readdirSync(BACKUP_DIR);
  const backups = [];

  for (const filename of files) {
    const fullPath = path.join(BACKUP_DIR, filename);
    const stats = fs.statSync(fullPath);

    // Identify target file
    let target = 'Unknown';
    if (filename.startsWith('index.html')) target = 'index.html';
    else if (filename.startsWith('update-index.js')) target = 'update-index.js';
    else if (filename.startsWith('README.md')) target = 'README.md';

    backups.push({
      filename,
      fullPath,
      target,
      size: stats.size,
      time: stats.mtime
    });
  }

  // Sort descending by time (newest first)
  backups.sort((a, b) => b.time - a.time);
  return backups;
}

function prompt(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function listBackups(backups) {
  if (backups.length === 0) {
    log(yellow('No backups found in _backups/.'));
    return;
  }

  log(bold('┌────┬──────────────────────────────────────────────────────────┬─────────────────┬───────────┐'));
  log(bold('│ #  │ Backup Filename                                          │ Target File     │ File Size │'));
  log(bold('├────┼──────────────────────────────────────────────────────────┼─────────────────┼───────────┤'));

  backups.forEach((b, idx) => {
    const numCol = `${idx + 1}`.padEnd(2);
    const nameCol = (b.filename.length > 56 ? b.filename.slice(0, 53) + '...' : b.filename).padEnd(56);
    const targetCol = b.target.padEnd(15);
    const sizeCol = formatBytes(b.size).padEnd(9);

    log(`│ ${numCol} │ ${cyan(nameCol)} │ ${targetCol} │ ${sizeCol} │`);
  });

  log(bold('└────┴──────────────────────────────────────────────────────────┴─────────────────┴───────────┘'));
  log(`Total: ${bold(backups.length)} backups stored.`);
}

async function pruneBackups(backups) {
  log(`\n${bold('🧹 Pruning backups (Keeping latest ' + keepCount + ' per file type)...')}`);

  // Group by target
  const groups = {};
  backups.forEach(b => {
    if (!groups[b.target]) groups[b.target] = [];
    groups[b.target].push(b);
  });

  let deletedCount = 0;
  let reclaimedBytes = 0;

  for (const [target, list] of Object.entries(groups)) {
    if (list.length > keepCount) {
      const toDelete = list.slice(keepCount);
      for (const b of toDelete) {
        fs.unlinkSync(b.fullPath);
        deletedCount++;
        reclaimedBytes += b.size;
        log(`  ${red('✗ Deleted old backup:')} ${b.filename}`);
      }
    }
  }

  log(`\n${bold('--- Pruning Summary ---')}`);
  log(`• Backups Removed: ${green(deletedCount)}`);
  log(`• Disk Space Reclaimed: ${green(formatBytes(reclaimedBytes))}`);
  if (deletedCount === 0) {
    log(`✓ Backup directory is already lean (≤ ${keepCount} backups per target).`);
  }
}

async function restoreBackup(backups) {
  if (backups.length === 0) {
    log(yellow('No backups available to restore.'));
    return;
  }

  log(`\n${bold('🔄 Interactive Backup Restoration')}`);
  await listBackups(backups);

  const input = await prompt('\nEnter the number of the backup to restore (or "q" to cancel): ');
  if (input.toLowerCase() === 'q') {
    log('Restore cancelled.');
    return;
  }

  const index = parseInt(input, 10) - 1;
  if (isNaN(index) || index < 0 || index >= backups.length) {
    log(red('Invalid backup selection.'));
    return;
  }

  const selected = backups[index];
  const targetPath = path.join(REPO_DIR, selected.target);

  const confirm = await prompt(`\nAre you sure you want to overwrite "${cyan(selected.target)}" with "${cyan(selected.filename)}"? (y/N): `);
  if (confirm.toLowerCase() !== 'y') {
    log('Restore cancelled.');
    return;
  }

  // Create safety backup of current target before overwriting
  if (fs.existsSync(targetPath)) {
    const safetyName = `${selected.target}.backup_before_restore_${Date.now()}`;
    fs.copyFileSync(targetPath, path.join(BACKUP_DIR, safetyName));
    log(`${dim(`Safety backup created: _backups/${safetyName}`)}`);
  }

  fs.copyFileSync(selected.fullPath, targetPath);
  log(`\n${green('🎉 Successfully restored!')} ${selected.filename} -> ${selected.target}\n`);
}

async function main() {
  log(`\n${bold('🗄️ IELTS Listening Simulator - Backup Manager')}`);
  log(`${cyan('Backup Directory:')} ${BACKUP_DIR}\n`);

  const backups = getBackups();

  if (isRestore) {
    await restoreBackup(backups);
  } else if (isPrune) {
    await pruneBackups(backups);
  } else {
    await listBackups(backups);
    log(`\n${dim('Commands:')}`);
    log(`  node manage-backups.js --prune      # Clean up older backups`);
    log(`  node manage-backups.js --restore    # Restore a previous backup`);
    log('');
  }
}

main().catch(console.error);
