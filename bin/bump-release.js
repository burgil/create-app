import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import dotenv from 'dotenv';

function run(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch (e) {
    console.error('Command failed:', cmd, e?.message || e);
    process.exit(1);
  }
}

// Load environment variables from .env if present
dotenv.config();

function parseSemver(v) {
  const m = v.trim().match(/^([0-9]+)\.([0-9]+)\.([0-9]+)(?:-(.*))?$/);
  if (!m) throw new Error(`Invalid semver: ${v}`);
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10), m[4] || ''];
}

function bumpVersion(current, type) {
  const [major, minor, patch, rest] = parseSemver(current);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`; // default patch
}

function getRemoteRepo() {
  const url = run('git remote get-url origin');
  // Support SSH and HTTPS
  let match = url.match(/git@github.com:(.+?)\/(.+?)(?:.git)?$/);
  if (!match) match = url.match(/https:\/\/github.com\/(.+?)\/(.+?)(?:.git)?$/);
  if (!match) {
    console.error('Unable to parse remote origin URL:', url);
    process.exit(1);
  }
  const owner = match[1];
  const repo = match[2];
  return { owner, repo };
}

async function createRelease(owner, repo, tag, body) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN not set in environment. Aborting create release.');
    process.exit(1);
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json'
    },
    body: JSON.stringify({
      tag_name: tag,
      name: `v${tag}`,
      body,
      draft: false,
      prerelease: false
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Failed to create release:', res.status, text);
    process.exit(1);
  }
  const json = await res.json();
  return json;
}

async function updatePreviousRelease(owner, repo, excludeTag) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return;
  const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });
  if (!res.ok) return;
  const list = await res.json();
  const prev = list.find(r => r.tag_name !== excludeTag);
  if (!prev) return;
  const id = prev.id;
  const newName = prev.name?.includes('alpha') ? prev.name : `${prev.name}`;
  const patchUrl = `https://api.github.com/repos/${owner}/${repo}/releases/${id}`;
  const patch = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json'
    },
    body: JSON.stringify({ body: '_Outdated_', prerelease: true, name: newName })
  });
  if (!patch.ok) {
    console.error('Failed to update previous release:', patch.status, await patch.text());
  } else {
    console.log('Updated previous release to _Outdated_ and marked prerelease');
  }
}

async function main() {
  const args = process.argv.slice(2);
  let type = 'patch';
  let setVersion = null;
  let dryRun = false;
  let assumeYes = false;
  let releaseNotes = null;
  let commitMsg = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--type' || a === '-t') && args[i + 1]) { type = args[++i]; }
    if ((a === '--set' || a === '-s') && args[i + 1]) { setVersion = args[++i]; }
    if (a === '--dry-run') dryRun = true;
    if (a === '--yes' || a === '-y') assumeYes = true;
  }

  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const current = pkg.version;
  if (!current) { console.error('No version in package.json'); process.exit(1); }
  // If no explicit type passed on command line and we are in TTY, prompt interactively
  let interactive = process.stdout.isTTY && process.stdin.isTTY;
  let chosenType = type;
  let newVersion;
  if (!setVersion && interactive && !assumeYes) {
    const rl = readline.createInterface({ input, output });
    const patch = bumpVersion(current, 'patch');
    const minor = bumpVersion(current, 'minor');
    const major = bumpVersion(current, 'major');
    console.log(`Current version: ${current}`);
    console.log(`1) patch → ${patch}`);
    console.log(`2) minor → ${minor}`);
    console.log(`3) major → ${major}`);
    console.log(`4) set custom version`);
    const choice = await rl.question('Select version bump (1/2/3/4) [1]: ');
    let sel = choice.trim() || '1';
    if (sel === '1') chosenType = 'patch';
    if (sel === '2') chosenType = 'minor';
    if (sel === '3') chosenType = 'major';
    if (sel === '4') {
      const custom = await rl.question('Enter version to set: ');
      setVersion = custom.trim();
    }
    newVersion = setVersion ? setVersion : bumpVersion(current, chosenType);

    // Preview Unreleased commit messages
    try {
      const tagsOut = run('git tag --list --sort=-v:refname');
      if (tagsOut) {
        const latestTag = tagsOut.split('\n')[0];
        const preview = run(`git log ${latestTag}..HEAD --pretty=format:%s`);
        console.log('\nUnreleased commits:\n');
        console.log(preview || '  (no unreleased commits)');
      } else {
        const preview = run('git log -n 20 --pretty=format:%s');
        console.log('\nRecent commits:\n');
        console.log(preview || '  (no recent commits)');
      }
    } catch (e) {
      console.warn('Unable to preview unreleased commits:', e?.message || e);
    }

    const commitMessage = await rl.question(`Commit message [v${newVersion}]: `) || `v${newVersion}`;
    console.log('\nEnter release notes for this version. Enter a single dot (.) on its own line to finish.');
    const noteLines = [];
    while (true) {
      const nl = await rl.question('> ');
      if (nl.trim() === '.') break;
      // keep empty lines as separators
      if (nl === '') {
        // skip adding empty lines to avoid noise
        continue;
      }
      noteLines.push(nl);
    }
    const confirm = await rl.question(`Proceed with version ${newVersion} and commit message "${commitMessage}"? (y/N): `);
    rl.close();
    if (!confirm || !/^y(es)?$/i.test(confirm.trim())) {
      console.log('Aborting. No changes made.');
      process.exit(0);
    }
    type = chosenType;
    releaseNotes = noteLines;
    // Use chosen commit message
    commitMsg = commitMessage;
  } else {
    newVersion = setVersion ? setVersion : bumpVersion(current, type);
    commitMsg = `v${newVersion}`;
  }

  // Update package.json
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Bumped version ${current} → ${newVersion}`);

  // Git operations
  // Regenerate CHANGELOG and add only package.json and CHANGELOG.md to commit
  // We no longer use a generator script here; bump collects release notes and prepends them
  // Prepend release notes to CHANGELOG
  const changelogPath = path.resolve(process.cwd(), 'CHANGELOG.md');
  const dateStr = new Date().toISOString().split('T')[0];
  const header = `## ${newVersion} - ${dateStr}`;
  const notes = (releaseNotes && releaseNotes.length) ? releaseNotes : [`${commitMsg}`];
  const block = `${header}\n\n${notes.map(n => `- ${n}`).join('\n')}\n\n`;
  if (dryRun) {
    console.log('[dry-run] Would add the following changelog block:');
    console.log(block);
  } else {
    // Insert at top after '# Changelog' header
    let currentChangelog = '';
    if (fs.existsSync(changelogPath)) currentChangelog = fs.readFileSync(changelogPath, 'utf8');
    if (!currentChangelog || !currentChangelog.trim()) {
      currentChangelog = '# Changelog\n\n';
    }
    const lines = currentChangelog.split('\n');
    // find where to insert: after the first line if it is '# Changelog', or at the top otherwise
    let insertIdx = 1;
    if (lines[0] && lines[0].trim().toLowerCase() !== '# changelog') insertIdx = 0;
    lines.splice(insertIdx, 0, block);
    const newChangelog = lines.join('\n');
    fs.writeFileSync(changelogPath, newChangelog);
    console.log(`Updated ${changelogPath}`);
  }

  if (dryRun) {
    console.log('[dry-run] Would run: git add package.json CHANGELOG.md');
    console.log(`[dry-run] Would commit with message: ${commitMsg}`);
    console.log(`[dry-run] Would git push and tag ${newVersion}`);
  } else {
    run('git add package.json CHANGELOG.md');
    run(`git commit -m "${commitMsg}"`);
    run('git push');
    run(`git tag ${newVersion}`);
    run(`git push origin ${newVersion}`);
  }

  const { owner, repo } = getRemoteRepo();

  // Release description
  const body = `Usage\n-----\n\nRun directly from GitHub using \`npx\` (no install):\n\n\`npx github:burgil/create-app my-project-name\`\n\n> **Warning:** Ensure you review and agree to the [Template TOS](./template/TOS.md) before proceeding, as it outlines important usage terms and conditions.\n\n![cli-preview](cli-preview.png)`;

  console.log(`Creating release v${newVersion} on ${owner}/${repo}...`);
  await createRelease(owner, repo, newVersion, body);
  console.log(`Created release v${newVersion}`);

  // Update previous release
  console.log('Updating previous release (set description to _Outdated_ and mark prerelease)');
  await updatePreviousRelease(owner, repo, newVersion);
}

main().catch(err => { console.error(err); process.exit(1); });
