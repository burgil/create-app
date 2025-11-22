import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';
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
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--type' || a === '-t') && args[i + 1]) { type = args[++i]; }
    if ((a === '--set' || a === '-s') && args[i + 1]) { setVersion = args[++i]; }
  }

  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const current = pkg.version;
  if (!current) { console.error('No version in package.json'); process.exit(1); }
  const newVersion = setVersion ? setVersion : bumpVersion(current, type);

  // Update package.json
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Bumped version ${current} → ${newVersion}`);

  // Git operations
  run('git add .');
  run(`git commit -m "v${newVersion}"`);
  run('git push');
  run(`git tag ${newVersion}`);
  run(`git push origin ${newVersion}`);

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
