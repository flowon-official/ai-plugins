# Flowon plugins for Claude Code, Codex and GitHub Copilot

This repository is Flowon's plugin marketplace, `flowon`, for Claude Code, OpenAI Codex and GitHub Copilot (the CLI
and Visual Studio Code). It lists one plugin per Logic Fabric offering, and plugins for the tools that go with them.
Each plugin lives in a repository of its own:

| Plugin | For | What it does |
|---|---|---|
| [Logic Fabric for Dataverse](https://github.com/flowon-official/logic-fabric-dataverse-plugin) (`logic-fabric-dataverse`) | Logic Fabric for Dataverse | Builds solutions like software: request, spec, approved build plan, build with tests, review and acceptance, through your organization's Logic Foundry server. Also documents, governs, analyzes and security-reviews existing projects. |
| [Logic Fabric CLI](https://github.com/flowon-official/flowon-dynamics-plugin) (`flowon-dynamics`) | Logic Fabric for Dataverse and Logic Fabric for Dynamics 365 On-Premises | Uses the Logic Fabric CLI and the Flowon PowerShell module: export and import projects, solutions, security and data, mappings, patches, Logic APIs, tests and deployment pipelines. |

## Install

Claude Code:

```bash
claude plugin marketplace add flowon-official/ai-plugins
claude plugin install logic-fabric-dataverse@flowon
claude plugin install flowon-dynamics@flowon
```

GitHub Copilot CLI (Visual Studio Code uses the plugins the CLI installed):

```bash
copilot plugin marketplace add flowon-official/ai-plugins
copilot plugin install logic-fabric-dataverse@flowon
copilot plugin install flowon-dynamics@flowon
```

Codex:

```bash
codex plugin marketplace add flowon-official/ai-plugins
codex plugin add logic-fabric-dataverse@flowon
codex plugin add flowon-dynamics@flowon
```

Install the ones you need, then follow each plugin's README. The Logic Fabric for Dataverse plugin needs the address
of your Logic Foundry server (Claude Code asks for it; in Codex and Copilot its `setup` skill connects it), and your
administrator sets up sign-in once for your organization.

A marketplace added as `flowon-official/claude-plugins`, this repository's earlier name, keeps working.

## Privacy and license

See the Flowon [privacy policy](https://www.flowon.com/privacy-policy). Use of the plugins is subject to the Flowon
software license in [LICENSE](LICENSE) and requires a Logic Fabric subscription.

## For maintainers

### How the catalog works

`.claude-plugin/marketplace.json` is the catalog, and all three clients read it. Each entry pins one release of a plugin:
its repository, its tag and the tag's commit, as a `url` source (Codex has no `github` source type and skips such
entries). Every change to this file is a release: users get what it points at, so it changes only through pull
requests a release owner approves, and the Verify check confirms each tag is on its commit and has the plugin's name
and version. Reverting a pull request rolls its release back.

Plugins don't release from here. A plugin repository's own release workflow tags a new version and opens the pull
request that moves its entry; [plugin-tools](https://github.com/flowon-official/plugin-tools) has those workflows, the
generator for the Codex and Copilot packages, and the checks.

Keep this repository to the catalog: every commit to it makes Codex fetch it again and reinstall every plugin from it.
Don't add `.agents/plugins/marketplace.json` either: Codex reads it instead of the shared catalog.

### Adding a plugin

A plugin, from Flowon or another vendor, lives in a repository of its own with the plugin at its root, written for
Claude Code with its Codex and Copilot packages built by plugin-tools. Its first release's pull request adds its entry
here. Its author goes in its `plugin.json`.

### Naming

- Plain `logic-fabric` is reserved for the Logic Fabric flagship's plugin. A plugin for another offering carries its
  qualifier: `logic-fabric-dataverse`, and `logic-fabric-dynamics-onpremises` if Dynamics 365 On-Premises gets one.
- A plugin for a tool is named after the tool's command: `flowon-dynamics`.
- Every offering's plugin uses the same commands (`start`, `spec`, `plan`, `build`, `review`, `accept`, ...); the
  plugin name in front of them tells the offering apart.
- The plugins share the `logic-fabric/` workspace folder in a customer's repository. `workspace.yaml` names the
  workspace's `offering`, and each plugin works only in a workspace for its own.
- A plugin's repository is named `<plugin>-plugin`.

### History

Until 0.10.0 (Logic Fabric for Dataverse) and 1.1.0 (the CLI plugin), the plugins lived in this repository under
`plugins/`, tagged `<plugin>-v<version>`; those tags stay here. Their repositories keep that history, tagged
`v<version>`.
