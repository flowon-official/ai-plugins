# Flowon plugins for Claude Code

This repository is Flowon's plugin marketplace for Claude Code (`flowon`). It holds one plugin per Logic Fabric
offering, and plugins for the tools that go with them:

| Plugin | For | What it does |
|---|---|---|
| [Logic Fabric for Dataverse](plugins/logic-fabric-dataverse/README.md) (`logic-fabric-dataverse`) | Logic Fabric for Dataverse | Builds solutions like software: request, spec, approved build plan, build with tests, review and acceptance, through your organization's Logic Foundry server. Also documents, governs, analyzes and security-reviews existing projects. |
| [Logic Fabric CLI](plugins/flowon-dynamics/README.md) (`flowon-dynamics`) | Logic Fabric for Dataverse and Logic Fabric for Dynamics 365 On-Premises | Uses the Logic Fabric CLI and the Flowon PowerShell module: export and import projects, solutions, security and data, mappings, patches, Logic APIs, tests and deployment pipelines. |

## Install

```bash
claude plugin marketplace add flowon-official/claude-plugins
claude plugin install logic-fabric-dataverse@flowon
claude plugin install flowon-dynamics@flowon
```

Install the ones you need, then follow each plugin's README. The Logic Fabric for Dataverse plugin needs the address
of your Logic Foundry server, and your administrator sets up sign-in once for your organization.

## Privacy and license

See the Flowon [privacy policy](https://www.flowon.com/privacy-policy). Use of the plugins is subject to the Flowon
software license in [LICENSE](LICENSE) and requires a Logic Fabric subscription.

## For maintainers

### Naming

- Plain `logic-fabric` is reserved for the Logic Fabric flagship's plugin. A plugin for another offering carries its
  qualifier: `logic-fabric-dataverse`, and `logic-fabric-dynamics-onpremises` if Dynamics 365 On-Premises gets one.
- A plugin for a tool is named after the tool's command: `flowon-dynamics`.
- Every offering's plugin uses the same commands (`start`, `spec`, `plan`, `build`, `review`, `accept`, ...); the
  plugin name in front of them tells the offering apart.
- The plugins share the `logic-fabric/` workspace folder in a customer's repository. `workspace.yaml` names the
  workspace's `offering`, and each plugin works only in a workspace for its own.

### Layout

```
.claude-plugin/marketplace.json
LICENSE
scripts/sync-cli-skill.mjs      copies the CLI skill from flowon-xrm into plugins/flowon-dynamics
scripts/sync-expressions.mjs    writes the expression functions table from the grammar Logic Foundry serves
tests/                          node --test checks of plugin scripts (the dashboard generator)
plugins/logic-fabric-dataverse/
  .claude-plugin/plugin.json    name, version, repository, license, foundry_url setting, privacy policy, network hosts
  .claude-plugin/icon.png       listing icon (1024 px)
  .mcp.json                     Foundry server: URL from the setting, client ID, callback port 47823
  README.md                     the plugin's documentation (shown in the plugin directory)
  LICENSE                       a copy of the root LICENSE (the directory reads it from the plugin folder)
  skills/authoring/             the workflow, rules, templates/
  skills/artifacts/             reference/ per kind, examples/
  skills/grammar/               expressions and context
  skills/testing/               test format, definition of done
  commands/                     one per stage, status, dashboard, test, document, govern, insights, secure, agent-tools
  agents/                       reviewer, explorer, documenter, process-analyst, security-reviewer
  hooks/                        hooks.json, gate.mjs, dataverse.mjs, stage.mjs, approval.mjs, context.mjs, export.mjs, dashboard.mjs, workspace.mjs
  scripts/                      dashboard.mjs and its page template dashboard.html (the dashboard command)
  evals/                        eval cases (see evals/README.md)
plugins/flowon-dynamics/
  .claude-plugin/plugin.json    name, version, repository, license, privacy policy, network hosts
  .claude-plugin/icon.png       listing icon
  README.md, LICENSE
  skills/cli/                   SKILL.md and reference.md, copied from flowon-xrm (don't edit them here)
```

### Changes and releases

- The CLI skill's source is in the `flowon-xrm` repository, next to the CLI's code
  (`src/server/src/platform/Flowon.Xrm.Tools.CommandLine/skill/`). Change it there, then copy it here with
  `node scripts/sync-cli-skill.mjs <path to flowon-xrm>`.
- The functions table in `plugins/logic-fabric-dataverse/skills/artifacts/reference/expressions.md` is generated
  from the grammar Logic Foundry serves. After the grammar changes in `flowon-xrm`, run
  `node scripts/sync-expressions.mjs <flowon-xrm>/src/server/src/ai/platform/Flowon.Xrm.AI.Agents.Assist/Assets/grammar/fol-grammar.json`;
  `--check` fails when the table is out of date.
- The client ID must be written into `.mcp.json`: Claude Code fills plugin settings into the server address but
  not into the sign-in settings.
- Keep each plugin's `LICENSE` identical to the root one, and its description the same in its `plugin.json` and
  `.claude-plugin/marketplace.json`.
- Check changes with `claude plugin validate .` and `claude plugin validate --strict ./plugins/<plugin>`, and run
  `node --test` (Node 20 or later).
- Run the Logic Fabric for Dataverse plugin's offline evals before a release: in `plugins/logic-fabric-dataverse`,
  `claude plugin eval . --tag offline --judge-model sonnet --runs 1 --ablation none` (about $2). Without
  `--runs 1 --ablation none` each case runs three times with and without the plugin, at about six times the cost.
- To release a plugin, raise `version` in its `plugin.json` (installed copies update only when it changes), commit,
  and tag the commit `<plugin>-v<version>`, for example `logic-fabric-dataverse-v0.6.0`. The Claude plugin directory
  follows each plugin's release tag.
