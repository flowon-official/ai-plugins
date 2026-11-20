# FlowOn plugins for Claude Code

This repository is FlowOn's plugin marketplace for Claude Code (`flowon`). It holds one plugin:

| Plugin | What it does |
|---|---|
| [Logic Fabric for Dataverse](plugins/logic-fabric-dataverse/README.md) (`logic-fabric-dataverse`) | Builds Logic Fabric for Dataverse solutions like software: request, spec, approved build plan, build with tests, review and acceptance, through your organization's Logic Foundry server. Also documents, governs, analyzes and security-reviews existing projects. |

## Install

```bash
claude plugin marketplace add flowon-official/logic-fabric-dataverse-claude-plugins
claude plugin install logic-fabric-dataverse@flowon
```

Then follow the plugin's [README](plugins/logic-fabric-dataverse/README.md): the plugin needs the address of your
Logic Foundry server, and your administrator sets up sign-in once for your organization.

## Privacy and license

See the Flowon [privacy policy](https://www.flowon.com/privacy-policy). Use of the plugins is subject to the Flowon
software license in [LICENSE](LICENSE) and requires a Logic Fabric subscription.

## For maintainers

```
.claude-plugin/marketplace.json
LICENSE
plugins/logic-fabric-dataverse/
  .claude-plugin/plugin.json  name, version, repository, license, foundry_url setting, privacy policy, network hosts
  .claude-plugin/icon.png     listing icon (1024 px)
  .mcp.json                   Foundry server: URL from the setting, client ID, callback port 47823
  README.md                   the plugin's documentation (shown in the plugin directory)
  LICENSE                     a copy of the root LICENSE (the directory reads it from the plugin folder)
  skills/authoring/           the workflow, rules, templates/
  skills/artifacts/           reference/ per kind, examples/
  skills/grammar/             expressions and context
  skills/testing/             test format, definition of done
  skills/tools/               command-line tools
  commands/                   one per stage, status, test, document, govern, insight, secure, agent-tools
  agents/                     reviewer, explorer, documenter, process-analyst, security-reviewer
  hooks/                      hooks.json, gate.mjs, stage.mjs, approval.mjs, context.mjs, export.mjs, workspace.mjs
  evals/                      eval cases (see evals/README.md)
```

- The client ID must be written into `.mcp.json`: Claude Code fills plugin settings into the server address but
  not into the sign-in settings.
- Keep the plugin's `LICENSE` identical to the root one, and its description the same in `plugin.json` and
  `.claude-plugin/marketplace.json`.
- Check changes with `claude plugin validate .` and `claude plugin validate --strict ./plugins/logic-fabric-dataverse`.
- Run the offline evals before a release: in `plugins/logic-fabric-dataverse`,
  `claude plugin eval . --tag offline --judge-model sonnet --runs 1 --ablation none` (about $2). Without
  `--runs 1 --ablation none` each case runs three times with and without the plugin, at about six times the cost.
- To release, raise `version` in `plugin.json` (installed copies update only when it changes), commit, and tag the
  commit `v<version>`. The Claude plugin directory follows the release tag.
