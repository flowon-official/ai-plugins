// The Codex and Copilot packages (scripts/build-ports.mjs) are current with their Claude Code source, and what they
// point to exists. Run: node --test tests/
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const plugins = readdirSync(join(repo, 'plugins')).filter(p => existsSync(join(repo, 'plugins', p, '.claude-plugin', 'plugin.json')));
const read = file => JSON.parse(readFileSync(file, 'utf8'));

test('the Codex and Copilot packages are current', () => {
  execFileSync('node', [join(repo, 'scripts', 'build-ports.mjs'), '--check'], { stdio: 'pipe' });
});

for (const plugin of plugins) {
  const dir = join(repo, 'plugins', plugin);
  const claude = read(join(dir, '.claude-plugin', 'plugin.json'));

  test(`${plugin}: every manifest has the Claude manifest's name and version, and its paths exist`, () => {
    for (const manifest of [join(dir, '.codex-plugin', 'plugin.json'), join(dir, '.github', 'plugin', 'plugin.json')]) {
      const port = read(manifest);
      assert.equal(port.name, claude.name);
      assert.equal(port.version, claude.version);

      for (const path of [port.skills, port.agents, port.hooks, port.interface?.logo, port.extensions?.['com.openai']?.onboardingSkill].flat().filter(Boolean)) {
        assert.ok(existsSync(join(dir, path)), `${manifest}: ${path} doesn't exist`);
      }
    }
  });

  test(`${plugin}: the Codex manifest keeps Codex from importing the Claude commands itself`, () => {
    if (existsSync(join(dir, 'commands'))) {
      assert.deepEqual(read(join(dir, '.codex-plugin', 'plugin.json')).commands, []);
    }
  });

  test(`${plugin}: the Codex manifest doesn't load the Claude .mcp.json (its address is a Claude Code setting)`, () => {
    if (existsSync(join(dir, '.mcp.json'))) {
      assert.deepEqual(read(join(dir, '.codex-plugin', 'plugin.json')).mcpServers, {});
    }
  });

  test(`${plugin}: each Codex agent has a name Codex can spawn, not one of Codex's own, and every agent a skill names exists`, () => {
    const folder = join(dir, 'ports', 'codex', 'agents');
    const names = existsSync(folder)
      ? readdirSync(folder).map(file => readFileSync(join(folder, file), 'utf8').match(/^name = "([^"]+)"$/m)?.[1])
      : [];

    for (const name of names) {
      assert.match(name ?? '', /^[a-z0-9_]+$/);
      assert.ok(!['default', 'worker', 'explorer'].includes(name), `${name} replaces one of Codex's own agents`);
    }

    const skills = join(dir, 'ports', 'skills');
    const text = existsSync(skills)
      ? readdirSync(skills, { recursive: true }).filter(f => f.endsWith('SKILL.md')).map(f => readFileSync(join(skills, f), 'utf8')).join('\n')
      : '';

    for (const [, shared, codex] of text.matchAll(/`[\w-]+:([a-z-]+)` agent \(`(\w+)` in Codex\)/g)) {
      assert.ok(names.includes(codex), `a skill names the Codex agent ${codex}, which doesn't exist`);
      assert.ok(existsSync(join(dir, 'ports', 'copilot', 'agents', `${shared}.agent.md`)), `a skill names the agent ${shared}, which doesn't exist`);
    }
  });

  for (const client of ['codex', 'copilot']) {
    const file = join(dir, 'ports', client, 'hooks.json');

    if (!existsSync(file)) {
      continue;
    }

    test(`${plugin}: each ${client} hook runs an existing hook script as that client`, () => {
      const commands = Object.values(read(file).hooks).flat().flatMap(group => group.hooks).map(hook => hook.command);
      assert.ok(commands.length > 0);

      for (const command of commands) {
        const script = command.match(/'hooks','([\w-]+\.mjs)'/)?.[1];
        assert.ok(script && existsSync(join(dir, 'hooks', script)), `${command} runs no existing script`);
        assert.match(command, new RegExp(`--client ${client}\\b`));
      }
    });
  }

  test(`${plugin}: no generated skill or agent tells another client to use Claude Code's tools`, () => {
    const ports = join(dir, 'ports');

    if (!existsSync(ports)) {
      return;
    }

    const files = readdirSync(ports, { recursive: true }).map(f => join(ports, f)).filter(f => /\.(md|toml)$/.test(f));

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /mcp__plugin_|\$ARGUMENTS|\$\{CLAUDE_PLUGIN_ROOT\}|`AskUserQuestion`/, file);
    }
  });
}
