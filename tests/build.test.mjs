import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
test('build includes all snapshots and only public assets', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'ebird-build-'));
  try {
    for (const path of ['index.html', 'index.css', 'app.js', 'model.js', 'scripts', 'examples']) {
      await cp(new URL(`../${path}`, import.meta.url), join(temp, path), { recursive: true });
    }
    execFileSync(process.execPath, ['scripts/build.mjs', 'examples/data'], { cwd: temp });
    assert.deepEqual((await readdir(join(temp, '_site'))).sort(), ['app.js', 'data', 'index.css', 'index.html', 'model.js']);
    const index = JSON.parse(await readFile(join(temp, '_site/data/index.json')));
    for (const date of index.dates) assert.equal(JSON.parse(await readFile(join(temp, `_site/data/snapshots/${date}.json`))).date, date);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
