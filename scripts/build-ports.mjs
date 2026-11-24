// Builds each plugin's packages for OpenAI Codex and GitHub Copilot from its Claude Code source, so the three never
// drift: the skills, hooks and agents are written once (for Claude Code), and this script writes the rest.
//
//   .codex-plugin/plugin.json     Codex's manifest: the skills, the generated command skills, the Codex hooks, interface
//   .github/plugin/plugin.json    Copilot's manifest (read before .claude-plugin/plugin.json): skills, agents, hooks
//   ports/skills/<command>/       each command as a skill only the user invokes (neither client loads Claude commands
//                                 from a plugin); a hand-written ports/skills/ folder that isn't a command (setup) is kept
//   ports/codex/hooks.json        the hooks for Codex: its tool names, and --client codex
//   ports/codex/agents/*.toml     the agents as Codex custom agents (a plugin can't ship them: setup copies them)
//   ports/copilot/hooks.json      the hooks for Copilot: version 1, its tool names, and --client copilot
//   ports/copilot/agents/*.agent.md  the agents for Copilot, with its tool names
//
// node scripts/build-ports.mjs          writes them
// node scripts/build-ports.mjs --check  fails when a written file isn't what the source gives (run in tests)
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const stale = [];

// What the Claude manifest doesn't say: Codex's short description (at most 30 characters) and its category.
const PORTS = {
  'logic-fabric-dataverse': { short: 'Build Dataverse logic safely', category: 'Developer Tools', foundry: true },
  'flowon-dynamics': { short: 'Logic Fabric command line', category: 'Developer Tools' },
};

// The Foundry server's name in the client's MCP configuration (setup writes it): the hooks' matchers use it.
const FOUNDRY = 'foundry';
const CLAUDE_FOUNDRY = /mcp__plugin_logic-fabric-dataverse_foundry__/g;

function write(file, text) {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;

  if (current === text) {
    return;
  }

  if (check) {
    stale.push(relative(repo, file));
    return;
  }

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

const json = value => JSON.stringify(value, null, 2) + '\n';

// A Markdown file's frontmatter (simple key: value lines) and body.
function parse(text) {
  const match = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    return { meta: {}, body: text };
  }

  const meta = {};

  for (const line of match[1].split('\n')) {
    const field = line.match(/^([\w-]+):\s*(.*)$/);
    if (field) {
      meta[field[1]] = field[2].trim().replace(/^"(.*)"$/, '$1');
    }
  }

  return { meta, body: match[2] };
}

const quote = text => JSON.stringify(text);

// An agent's name in Codex, which takes only lowercase letters, digits and underscores, with a prefix so it doesn't
// replace one of Codex's own agents (explorer): reviewer → logic_fabric_reviewer.
const codexAgent = (plugin, name) => `${plugin.replace(/-dataverse$/, '')}_${name}`.replace(/-/g, '_');

// The text of a command or agent as another client reads it.
function portText(text, plugin) {
  return text
    .replace(/\$ARGUMENTS/g, '(the text the user gave after the skill\'s name)')
    .replace(/\(`AskUserQuestion`\)/g, '(one question to the user)')
    .replace(/`AskUserQuestion`/g, 'one question to the user')
    .replace(/```\nnode "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/dashboard\.mjs"\n```\n\nIf the path above still shows `\$\{CLAUDE_PLUGIN_ROOT\}`, the script is `scripts\/dashboard\.mjs` in this plugin's folder\n\(`[^`]+`, under `~\/\.claude\/plugins\/`\): find it with Glob and run it the same way\./,
      '```\nnode "<plugin folder>/scripts/dashboard.mjs"\n```\n\n' +
      `The plugin folder (\`${plugin}\`) is three folders above this skill's \`SKILL.md\` (\`ports/skills/dashboard/\`).`)
    .replace(/, mention that it can be opened in Claude on the web or desktop\./, ', mention that it can be opened in Claude on the web or desktop, or rendered from its JSON.')
    .replace(CLAUDE_FOUNDRY, `${FOUNDRY}/`)
    // Codex's name for the agent, next to Copilot's (the same as Claude Code's).
    .replace(new RegExp('`' + plugin + ':([a-z-]+)` agent', 'g'), (all, agent) => `${all} (\`${codexAgent(plugin, agent)}\` in Codex)`);
}

// A hook command that finds the plugin's folder whatever the client gives: the PLUGIN_ROOT (or COPILOT_PLUGIN_ROOT,
// CLAUDE_PLUGIN_ROOT) variable, or the --root argument when the client substitutes ${PLUGIN_ROOT} in the command
// instead. node -e reads the same under bash, PowerShell and cmd.
function launcher(script, client) {
  const code = "const a=process.argv,i=a.indexOf('--root'),e=process.env,r=e.PLUGIN_ROOT||e.COPILOT_PLUGIN_ROOT||e.CLAUDE_PLUGIN_ROOT||(i>0&&!String(a[i+1]).includes('\\x24')?a[i+1]:'');"
    + `import(require('url').pathToFileURL(require('path').join(r,'hooks','${script}')).href)`;

  return `node -e "${code}" -- --client ${client} --root "\${PLUGIN_ROOT}"`;
}

const script = command => command.match(/hooks\/([\w-]+\.mjs)/)?.[1];

// Claude Code's hooks for another client: its event and tool names, and the launcher.
function portHooks(claude, client) {
  const matchers = client === 'codex'
    ? { 'Write|Edit|MultiEdit': 'apply_patch|Edit|Write', 'Bash|PowerShell': 'Bash' }
    : { 'Write|Edit|MultiEdit': 'Write|Edit', 'Bash|PowerShell': 'Bash' };
  const hooks = {};

  for (const [event, groups] of Object.entries(claude.hooks)) {
    hooks[event] = groups.map(group => {
      let matcher = group.matcher;

      if (matcher) {
        matcher = matchers[matcher]
          // Codex names a configured server's tools mcp__<server>__<tool>. Copilot CLI names them <server>-<tool>
          // (undocumented, seen live), so its matcher takes any name with the server's in it, and the hooks check the
          // name again.
          ?? (client === 'codex' ? matcher.replace(/mcp__plugin_[\w-]+?_foundry__/, `mcp__${FOUNDRY}__`) : matcher.replace(/mcp__plugin_[\w-]+?_foundry__/, `.*${FOUNDRY}.*`));
      }

      const entries = group.hooks.map(hook => client === 'codex'
        ? { type: 'command', command: launcher(script(hook.command), client), timeout: hook.timeout }
        : { type: 'command', command: launcher(script(hook.command), client), timeoutSec: hook.timeout });

      return client === 'codex' || !matcher ? { ...(matcher ? { matcher } : {}), hooks: entries } : { matcher, hooks: entries };
    });
  }

  // Copilot drops a prompt hook's added context in some versions; the session's start carries it too.
  if (client === 'copilot' && hooks.UserPromptSubmit) {
    hooks.SessionStart = hooks.UserPromptSubmit;
  }

  return client === 'copilot' ? { version: 1, hooks } : { description: claude.description, hooks };
}

// Copilot's names for Claude Code's tools in an agent's tools list (unknown names are ignored, so both the CLI's and
// VS Code's names are given).
const COPILOT_TOOLS = {
  Read: ['view', 'read'],
  Grep: ['rg', 'search'],
  Glob: ['glob'],
  Write: ['create', 'edit', 'apply_patch'],
  Edit: ['edit', 'apply_patch'],
  Bash: ['bash', 'powershell'],
};

function portAgents(pluginDir, plugin) {
  const folder = join(pluginDir, 'agents');

  if (!existsSync(folder)) {
    return null;
  }

  const written = [];

  for (const file of readdirSync(folder).filter(f => f.endsWith('.md'))) {
    const { meta, body } = parse(readFileSync(join(folder, file), 'utf8'));
    const tools = (meta.tools || '').split(',').map(t => t.trim()).filter(Boolean);
    const copilot = [...new Set(tools.flatMap(t => COPILOT_TOOLS[t] ?? [t.replace(CLAUDE_FOUNDRY, `${FOUNDRY}/`)]))];
    const text = portText(body, plugin).trim();
    const copilotFile = join(pluginDir, 'ports', 'copilot', 'agents', `${meta.name}.agent.md`);
    const codexFile = join(pluginDir, 'ports', 'codex', 'agents', `${codexAgent(plugin, meta.name)}.toml`);

    written.push(copilotFile, codexFile);
    write(copilotFile,
      `---\nname: ${meta.name}\ndescription: ${quote(meta.description)}\ntools: ${JSON.stringify(copilot)}\n---\n\n${text}\n`);

    const foundry = tools.filter(t => t.match(CLAUDE_FOUNDRY)).map(t => t.replace(CLAUDE_FOUNDRY, ''));
    const allowed = foundry.length ? `Use only these Logic Foundry tools: ${foundry.join(', ')}.${tools.includes('Write') || tools.includes('Edit') ? '' : ' Don\'t change any file.'}\n\n` : '';

    if (text.includes("'''")) {
      throw new Error(`${file} contains ''', which a TOML literal string can't hold.`);
    }

    write(codexFile,
      `# Generated by scripts/build-ports.mjs from agents/${file}.\nname = ${quote(codexAgent(plugin, meta.name))}\ndescription = ${quote(meta.description)}\ndeveloper_instructions = '''\n${allowed}${text}\n'''\n`);
  }

  return written;
}

function portCommands(pluginDir, plugin) {
  const folder = join(pluginDir, 'commands');

  if (!existsSync(folder)) {
    return [];
  }

  const names = [];

  for (const file of readdirSync(folder).filter(f => f.endsWith('.md'))) {
    const name = file.replace(/\.md$/, '');
    const { meta, body } = parse(readFileSync(join(folder, file), 'utf8'));
    const lines = [
      '---',
      `name: ${name}`,
      `description: ${quote(meta.description)}`,
      ...(meta['argument-hint'] ? [`argument-hint: ${quote(meta['argument-hint'])}`] : []),
      'user-invocable: true',
      'disable-model-invocation: true',
      '---',
      '',
      `<!-- Generated by scripts/build-ports.mjs from commands/${file}. -->`,
      '',
    ];

    write(join(pluginDir, 'ports', 'skills', name, 'SKILL.md'), lines.join('\n') + portText(body, plugin).trimStart());
    write(join(pluginDir, 'ports', 'skills', name, 'agents', 'openai.yaml'),
      `# Generated by scripts/build-ports.mjs: Codex runs this skill only when the user asks for it.\ninterface:\n  display_name: ${quote(`${plugin}: ${name}`)}\npolicy:\n  allow_implicit_invocation: false\n`);
    names.push(name);
  }

  return names;
}

for (const plugin of readdirSync(join(repo, 'plugins'))) {
  const pluginDir = join(repo, 'plugins', plugin);
  const claudeManifest = join(pluginDir, '.claude-plugin', 'plugin.json');

  if (!existsSync(claudeManifest)) {
    continue;
  }

  const port = PORTS[plugin] ?? { short: plugin.slice(0, 30), category: 'Developer Tools' };
  const manifest = JSON.parse(readFileSync(claudeManifest, 'utf8'));
  const commands = portCommands(pluginDir, plugin);
  const agents = portAgents(pluginDir, plugin);
  const portSkills = existsSync(join(pluginDir, 'ports', 'skills')) || commands.length > 0;
  const claudeHooks = join(pluginDir, 'hooks', 'hooks.json');
  const hooks = existsSync(claudeHooks) ? JSON.parse(readFileSync(claudeHooks, 'utf8')) : null;

  if (hooks) {
    write(join(pluginDir, 'ports', 'codex', 'hooks.json'), json(portHooks(hooks, 'codex')));
    write(join(pluginDir, 'ports', 'copilot', 'hooks.json'), json(portHooks(hooks, 'copilot')));
  }

  const skills = ['./skills/', ...(portSkills ? ['./ports/skills/'] : [])];
  const common = {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description.replace(/ from Claude Code/g, ''),
    author: manifest.author,
    homepage: manifest.homepage,
    repository: manifest.repository,
    license: manifest.license,
    keywords: manifest.keywords,
  };

  const setup = existsSync(join(pluginDir, 'ports', 'skills', 'setup', 'SKILL.md'));

  write(join(pluginDir, '.codex-plugin', 'plugin.json'), json({
    ...common,
    skills,
    // Codex turns a plugin's Claude commands into skills of its own on install, Claude text included, and skips those
    // that take arguments; the command skills in ports/skills/ replace them.
    ...(commands.length ? { commands: [] } : {}),
    ...(hooks ? { hooks: './ports/codex/hooks.json' } : {}),
    // Codex reads the plugin's .mcp.json, whose address is Claude Code's ${user_config.foundry_url}, and fails on it in
    // every session; setup configures the server in Codex instead.
    ...(existsSync(join(pluginDir, '.mcp.json')) ? { mcpServers: {} } : {}),
    ...(setup ? { extensions: { 'com.openai': { onboardingSkill: './ports/skills/setup/SKILL.md' } } } : {}),
    interface: {
      displayName: manifest.displayName ?? manifest.name,
      shortDescription: port.short,
      longDescription: common.description,
      developerName: manifest.author?.name ?? 'Flowon',
      category: port.category,
      capabilities: ['Read', 'Write'],
      websiteURL: manifest.homepage,
      privacyPolicyURL: manifest.privacyPolicyUrl,
      composerIcon: './.claude-plugin/icon.png',
      logo: './.claude-plugin/icon.png',
    },
  }));

  write(join(pluginDir, '.github', 'plugin', 'plugin.json'), json({
    ...common,
    skills,
    ...(agents ? { agents: './ports/copilot/agents/' } : {}),
    ...(hooks ? { hooks: './ports/copilot/hooks.json' } : {}),
  }));

  // A command removed from the source leaves no skill behind.
  const generated = join(pluginDir, 'ports', 'skills');

  if (existsSync(generated)) {
    for (const folder of readdirSync(generated)) {
      const skill = join(generated, folder, 'SKILL.md');

      if (existsSync(skill) && readFileSync(skill, 'utf8').includes('Generated by scripts/build-ports.mjs') && !commands.includes(folder)) {
        if (check) {
          stale.push(relative(repo, join(generated, folder)));
        } else {
          rmSync(join(generated, folder), { recursive: true, force: true });
        }
      }
    }
  }

  // Nor does an agent removed or renamed.
  for (const folder of [join(pluginDir, 'ports', 'codex', 'agents'), join(pluginDir, 'ports', 'copilot', 'agents')]) {
    for (const file of existsSync(folder) ? readdirSync(folder) : []) {
      const path = join(folder, file);

      if (!(agents || []).includes(path)) {
        if (check) {
          stale.push(relative(repo, path));
        } else {
          rmSync(path, { force: true });
        }
      }
    }
  }
}

if (stale.length) {
  console.error(`The Codex and Copilot packages are out of date; run node scripts/build-ports.mjs:\n  ${stale.join('\n  ')}`);
  process.exit(1);
}

console.log(check ? 'The Codex and Copilot packages are current.' : 'Wrote the Codex and Copilot packages.');
