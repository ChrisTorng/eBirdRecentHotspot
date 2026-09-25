import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
test('build includes all snapshots and only public assets', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'ebird-build-'));
  try {
    for (const path of ['index.html', 'index.css', 'app.js', 'model.js', 'heat.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'scripts', 'examples']) {
      await cp(new URL(`../${path}`, import.meta.url), join(temp, path), { recursive: true });
    }
    await cp(join(temp, 'examples/data'), join(temp, '.data-worktree/data'), { recursive: true });
    execFileSync(process.execPath, ['scripts/build.mjs', '.data-worktree/data'], { cwd: temp });
    assert.deepEqual((await readdir(join(temp, '_site'))).sort(), ['app.js', 'data', 'heat.js', 'icon-192.png', 'icon-512.png', 'index.css', 'index.html', 'manifest.webmanifest', 'model.js']);
    const summary = JSON.parse(await readFile(join(temp, '_site/data/summaries/2026-09-24.json')));
    assert.equal(summary.algorithm, 'companions-half-v1');
    assert.equal(summary.locations.Lsolo.heat, 1);
    const index = JSON.parse(await readFile(join(temp, '_site/data/index.json')));
    for (const date of index.dates) assert.equal(JSON.parse(await readFile(join(temp, `_site/data/snapshots/${date}.json`))).date, date);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
