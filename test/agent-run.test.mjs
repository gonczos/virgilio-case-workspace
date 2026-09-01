import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, 'scripts', 'start-agent-run.ps1');

function runScript(args, cwd) {
  return spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
    {
      cwd,
      encoding: 'utf8',
    },
  );
}

async function makeTempRepo(t) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'virgilio-agent-run-'));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(tempRoot, 'docs', 'discussions'), { recursive: true });
  return tempRoot;
}

test('snapshots the agreed prompt and prints a suggested frozen-prompt command', async (t) => {
  const tempRoot = await makeTempRepo(t);
  const sourcePrompt = path.join(tempRoot, 'docs', 'discussions', 'WIP-example.md');
  const promptContent = 'First line\r\nSecond line\r\n';
  await fs.writeFile(sourcePrompt, promptContent, 'utf8');

  const result = runScript(
    ['-TaskId', 'example-run', '-Prompt', 'docs/discussions/WIP-example.md', '-RepoRoot', tempRoot],
    repoRoot,
  );

  assert.equal(result.status, 0, result.stderr);

  const frozenPrompt = path.join(tempRoot, 'docs', 'agent-runs', 'example-run', 'prompt.md');
  const reportPath = path.join(tempRoot, 'docs', 'agent-runs', 'example-run', 'report.md');

  assert.equal(await fs.readFile(frozenPrompt, 'utf8'), promptContent);
  assert.match(result.stdout, /Frozen prompt: docs\/agent-runs\/example-run\/prompt\.md/);
  assert.match(result.stdout, /Report path: docs\/agent-runs\/example-run\/report\.md/);
  assert.match(result.stdout, /Suggested Codex command using the frozen prompt:/);
  assert.match(result.stdout, /codex exec -C/);
  assert.match(result.stdout, /prompt\.md/);

  const reportText = await fs.readFile(reportPath, 'utf8');
  assert.match(reportText, /# Task Report - example-run/);
  assert.match(reportText, /## Outcome/);
});

test('frozen prompt remains unchanged after later discussion edits', async (t) => {
  const tempRoot = await makeTempRepo(t);
  const sourcePrompt = path.join(tempRoot, 'docs', 'discussions', 'WIP-example.md');
  await fs.writeFile(sourcePrompt, 'Original prompt\n', 'utf8');

  const result = runScript(
    ['-TaskId', 'example-run', '-Prompt', 'docs/discussions/WIP-example.md', '-RepoRoot', tempRoot],
    repoRoot,
  );
  assert.equal(result.status, 0, result.stderr);

  await fs.writeFile(sourcePrompt, 'Revised prompt\n', 'utf8');

  const frozenPrompt = path.join(tempRoot, 'docs', 'agent-runs', 'example-run', 'prompt.md');
  assert.equal(await fs.readFile(frozenPrompt, 'utf8'), 'Original prompt\n');
});

test('refuses to overwrite an existing recorded run', async (t) => {
  const tempRoot = await makeTempRepo(t);
  const sourcePrompt = path.join(tempRoot, 'docs', 'discussions', 'WIP-example.md');
  await fs.writeFile(sourcePrompt, 'Prompt\n', 'utf8');

  const first = runScript(
    ['-TaskId', 'example-run', '-Prompt', 'docs/discussions/WIP-example.md', '-RepoRoot', tempRoot],
    repoRoot,
  );
  assert.equal(first.status, 0, first.stderr);

  const second = runScript(
    ['-TaskId', 'example-run', '-Prompt', 'docs/discussions/WIP-example.md', '-RepoRoot', tempRoot],
    repoRoot,
  );
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /Recorded run already exists/);
});

test('rejects an invalid task id', async (t) => {
  const tempRoot = await makeTempRepo(t);
  const sourcePrompt = path.join(tempRoot, 'docs', 'discussions', 'WIP-example.md');
  await fs.writeFile(sourcePrompt, 'Prompt\n', 'utf8');

  const result = runScript(
    ['-TaskId', '../bad', '-Prompt', 'docs/discussions/WIP-example.md', '-RepoRoot', tempRoot],
    repoRoot,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid TaskId/);
});

test('reports a missing prompt clearly', async (t) => {
  const tempRoot = await makeTempRepo(t);

  const result = runScript(
    ['-TaskId', 'example-run', '-Prompt', 'docs/discussions/missing.md', '-RepoRoot', tempRoot],
    repoRoot,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Prompt file not found/);
});
