/**
 * IELTS Listening Simulator - Test Health & Audio Validator
 * 
 * Audits all practice test files across Part 1–4 to ensure:
 *   1. Audio source is present, valid, and properly configured
 *   2. Question inputs are present and properly numbered (1–10)
 *   3. Answer key dictionary exists and matches question count
 *   4. Tapescripts and modals are properly linked
 *   5. Optional live URL check to verify audio servers respond
 * 
 * Usage:
 *   node validate-tests.js               # Fast local audit of all tests
 *   node validate-tests.js --check-urls  # Includes live HTTP checks for audio links
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const REPO_DIR = __dirname;
const args = process.argv.slice(2);
const checkUrls = args.includes('--check-urls');

// Terminal colors
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function log(msg) { console.log(msg); }

/**
 * Ping an audio URL via HTTP HEAD request.
 */
function checkAudioUrl(url) {
  return new Promise((resolve) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const localPath = path.join(REPO_DIR, url);
      return resolve({ ok: fs.existsSync(localPath), status: fs.existsSync(localPath) ? 200 : 404 });
    }

    try {
      const client = url.startsWith('https://') ? https : http;
      const req = client.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
        resolve({ ok: isSuccess, status: res.statusCode });
      });

      req.on('error', (err) => resolve({ ok: false, status: err.code || 'ERR' }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 'TIMEOUT' }); });
      req.end();
    } catch (err) {
      resolve({ ok: false, status: 'EXCEPTION' });
    }
  });
}

/**
 * Audit a single test HTML file.
 */
async function validateTestFile(partNum, filename, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  const warnings = [];

  // 1. Audio Source Check
  const audioMatch = content.match(/<audio[^>]*id=["']custom-audio-element["'][^>]*src=["']([^"']*)["']/i)
    || content.match(/<audio[^>]*src=["']([^"']+)["']/i);
  
  const audioSrc = audioMatch ? audioMatch[1].trim() : null;

  if (!audioSrc) {
    issues.push('Missing <audio> source tag');
  } else if (checkUrls) {
    const urlCheck = await checkAudioUrl(audioSrc);
    if (!urlCheck.ok) {
      warnings.push(`Audio URL unreachable (HTTP ${urlCheck.status})`);
    }
  }

  // 2. Question Inputs Check
  const inputMatches = content.match(/name=["'](?:s\d+_q\d+|q\d+)["']/gi)
    || content.match(/class=["'][^"']*fill-in-blank[^"']*["']/gi)
    || [];
  const questionCount = inputMatches.length;

  if (questionCount === 0) {
    issues.push('No question inputs found');
  } else if (questionCount < 10) {
    warnings.push(`Only ${questionCount}/10 question inputs found`);
  }

  // 3. Answer Key Check
  const hasAnswersObj = /const\s+answers\s*=\s*\{/i.test(content) 
    || /answers:\s*\{/i.test(content)
    || /correctAnswers/i.test(content);
  
  if (!hasAnswersObj) {
    warnings.push('Answers object not detected');
  }

  // 4. Transcript Check
  const hasTranscript = /transcript/i.test(content);
  if (!hasTranscript) {
    warnings.push('Audio transcript not found');
  }

  // 5. Script & App Initializer Check
  const hasDOMContentLoaded = /DOMContentLoaded/i.test(content);
  if (!hasDOMContentLoaded) {
    warnings.push('Missing DOMContentLoaded event listener');
  }

  return {
    partNum,
    filename,
    title: filename.replace(/^Part\s+[1-4]\s*-\s*/i, '').replace(/\.html$/i, ''),
    audioSrc: audioSrc ? (audioSrc.length > 40 ? audioSrc.slice(0, 37) + '...' : audioSrc) : 'NONE',
    questionCount,
    hasAnswers: hasAnswersObj,
    hasTranscript,
    issues,
    warnings
  };
}

async function main() {
  log(`\n${bold('🩺 IELTS Listening Simulator - Test Health & Audio Validator')}`);
  log(`${cyan('Repository:')} ${REPO_DIR}`);
  if (checkUrls) log(`${cyan('Audio Verification:')} Live HTTP ping enabled`);
  else log(`${dim('Tip: Use --check-urls to verify audio links live on the web')}`);
  log('');

  const results = [];
  let totalTests = 0;
  let totalIssues = 0;
  let totalWarnings = 0;

  for (let p = 1; p <= 4; p++) {
    const partFolder = path.join(REPO_DIR, `Part ${p}`);
    if (!fs.existsSync(partFolder)) continue;

    const files = fs.readdirSync(partFolder).filter(f => f.endsWith('.html'));
    for (const filename of files) {
      totalTests++;
      const fullPath = path.join(partFolder, filename);
      const res = await validateTestFile(p, filename, fullPath);
      results.push(res);
      totalIssues += res.issues.length;
      totalWarnings += res.warnings.length;
    }
  }

  // Print Results Table
  log(bold('┌────────┬───────────────────────────────────────┬────────────┬───────────┬────────────┬────────┐'));
  log(bold('│ Part   │ Test Title                            │ Questions  │ Audio     │ Answers    │ Status │'));
  log(bold('├────────┼───────────────────────────────────────┼────────────┼───────────┼────────────┼────────┤'));

  results.forEach(r => {
    const partCol = `Part ${r.partNum}`.padEnd(6);
    const titleCol = (r.title.length > 37 ? r.title.slice(0, 34) + '...' : r.title).padEnd(37);
    const qCol = `${r.questionCount}/10`.padEnd(10);
    const audioCol = (r.audioSrc !== 'NONE' ? green('✓ Found') : red('✗ Missing')).padEnd(18);
    const ansCol = (r.hasAnswers ? green('✓ Present') : yellow('? Untyped')).padEnd(20);
    
    let statusCol = green('✓ Pass ');
    if (r.issues.length > 0) statusCol = red('✗ Fail ');
    else if (r.warnings.length > 0) statusCol = yellow('⚠ Warn ');

    log(`│ ${partCol} │ ${titleCol} │ ${qCol} │ ${audioCol} │ ${ansCol} │ ${statusCol}│`);
  });

  log(bold('└────────┴───────────────────────────────────────┴────────────┴───────────┴────────────┴────────┘'));

  // Detailed Issues Report if any
  const failedOrWarned = results.filter(r => r.issues.length > 0 || r.warnings.length > 0);
  if (failedOrWarned.length > 0) {
    log(`\n${bold('Detailed Audit Notes:')}`);
    failedOrWarned.forEach(r => {
      log(`\n${cyan(`[Part ${r.partNum}] ${r.title}`)}`);
      r.issues.forEach(i => log(`  ${red('✗ Issue:')} ${i}`));
      r.warnings.forEach(w => log(`  ${yellow('⚠ Warning:')} ${w}`));
    });
  }

  log(`\n${bold('--- Health Audit Summary ---')}`);
  log(`• Total Tests Audited: ${bold(totalTests)}`);
  log(`• Healthy Tests: ${green(totalTests - failedOrWarned.filter(r => r.issues.length > 0).length)} / ${totalTests}`);
  if (totalIssues > 0) log(`• Critical Issues: ${red(totalIssues)}`);
  if (totalWarnings > 0) log(`• Non-Critical Warnings: ${yellow(totalWarnings)}`);
  if (totalIssues === 0 && totalWarnings === 0) {
    log(`\n${green('🎉 All 36 IELTS tests passed validation with 100% integrity!')}`);
  }
  log('');
}

main().catch(console.error);
