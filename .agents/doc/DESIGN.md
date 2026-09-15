# lior — LIberal ORchestrator

> A tool to explicitly configure which AI models play which roles in agent
> coding harnesses (Codex, OpenCode).

## Vision

In Codex or OpenCode, one harness performs several kinds of work:
orchestration, implementation, exploration, review, testing, summaries.
Today, choosing a different model per role means hand-editing two formats
(JSONC, TOML) in four places, while knowing each tool's subtleties.

`lior` becomes the **single source of truth**: you declare the *team*
(role → model) once in `lior.yaml`, and the tool generates each harness's
native configuration, validates compatibility, shows diffs, and diagnoses
problems.

Example:

```yaml
bindings:
  orchestrator: openai/gpt-6-astra#high
  implementer:  openai/gpt-5.6-luna
  reviewer:     zhipuai/glm-5.3
  tester:       zhipuai/glm-5.3-flash
```

→ generates `.opencode/agents/*.md`, `.codex/agents/*.toml`, and the managed
blocks in `opencode.jsonc` / `~/.codex/config.toml`.

## Settled decisions

| Decision | Choice |
|---|---|
| Stack | TypeScript + Bun, distributed via npm |
| Source of truth | `lior.yaml` (YAML, comments OK) |
| Default `apply` scope | **Project** (`.opencode/`, `.codex/`); `--global` opt-in |
| CLI name | `lior` (npm name free; acronym of LIberal ORchestrator) |
| MVP target | Solid core + `apply` (curated roles, dry-run, diff, prune) |
| Harnesses v1 | OpenCode (V2), Codex |
| User-level Codex writes | Hybrid: project-only by default; `apply --global` writes `~/.codex/config.toml` managed block with explicit confirmation |
| Roles in v0.1 | 6: `orchestrator`, `implementer`, `explorer`, `researcher`, `reviewer`, `tester` (`planner`, `summarizer` in v0.2) |
| Orchestration skill | Generated in v0.1 (charter + full skill, models injected) |
| `apply` confirmation | Dry-run by default when existing files would change; interactive confirm; `--yes` bypass |
| Role prompts | Adapted from the vendored `codex-astra-luna-orchestrator` (Apache-2.0); attribution in `NOTICE` |
| Delegation policy | Orchestrator autonomy — no user-declared workflow; the generated skill carries a default workflow as guidance only |

## Concepts

- **Role** — a position in the team: `orchestrator`, `planner`,
  `implementer`, `explorer`, `researcher`, `reviewer`, `tester`,
  `summarizer`. A role = **model + reasoning effort + system prompt +
  permissions + sandbox**, not just a model. `lior` ships *curated* roles;
  the user picks the model and effort (e.g. `#high`, mapped to
  `model_reasoning_effort` on Codex — effort varies per role: reviewer
  `low`, root `medium`, workers `max`). Only roles with a binding are
  generated.
- **ModelRef** — `provider/model#variant` (e.g. `openai/gpt-6-astra#high`),
  resolved through the registry.
- **Binding** — role → ModelRef, with per-harness overrides
  (`codex: ...`) and fallback chains.
- **Registry** — model catalog. Primary source: `https://models.dev/api.json`
  (open data: real IDs, pricing, context, capabilities, providers per model),
  cached locally (24 h TTL) + **overlay** `models.yaml` for missing metadata:
  `base_url`, API key env var, and per-provider `wire_api` compatibility.
- **Resolver** — for each (role, harness), computes the native target:
  built-in agent to override, agent file to create, config key to set.
  Applies compatibility rules and reports impossibilities.
- **Adapter** — one per harness: serializes resolver output into the native
  format, handles idempotent writing.

## Role → native target mapping

| Role | OpenCode (V2) | Codex |
|---|---|---|
| `orchestrator` | `model` + override `agents.build` (managed block in `opencode.jsonc`) | `model` + `model_provider` (`~/.codex/config.toml`) |
| `planner` | override `agents.plan` | custom agent (no dedicated model in plan mode; effort only) |
| `implementer` | agent file `.opencode/agents/implementer.md` (mode `subagent`) | override built-in `worker` → `.codex/agents/worker.toml` |
| `explorer` | override `agents.explore` | override built-in `explorer` |
| `researcher` | agent file (read-only, doc/API research) | agent file `researcher.toml` (read-only) |
| `reviewer` | agent file + `/review` command | agent file + `review_model` (user config) |
| `tester` | agent file (edits limited to tests) | agent file (`workspace-write`) |
| `summarizer` / `title` | hidden agents `summary` / `title` | `memories.extract_model` (user config) |

Compatibility rules encoded in the resolver:

- **Codex**: custom providers only through the **Responses** API
  (`wire_api = "responses"`, the only supported value); `model_providers`,
  `model_provider`, `review_model`… can only live in the **user-level**
  config.toml (project config cannot override them). `model` and agent files
  are fine in project config. Built-in providers: `openai`, `ollama`,
  `lmstudio`.
- **OpenCode**: broad provider support (chat-completions, packages),
  per-agent model with `#variant`.
- Codex agent file: `name`, `description`, `developer_instructions`
  required; a file named after a built-in (`worker`, `explorer`) takes
  precedence.
- OpenCode agent file: YAML frontmatter + body = prompt; for built-ins
  (`build`, `plan`, `general`, `explore`), prefer JSON-key overrides (a
  `.md` file would replace the system prompt).

### Can Codex use external models at all?

Yes, but only through endpoints that speak the **Responses API**. That is
why GLM-5.3 "direct from Z.AI" does not work in Codex (their endpoint is
chat-completions/Anthropic style), while it works fine in OpenCode. Options:
a Responses-compatible aggregator relaying the model, a local translating
proxy (v1 gateway idea), or local models via the built-in `ollama`/
`lmstudio` providers. The registry overlay tracks `wire_api` per provider so
the resolver can suggest compatible relays or fallbacks automatically.

## Guaranteed delegation: team charter + orchestration skill

The primary model delegates to sub-agents on its own; nothing guarantees it.
To make the orchestrator actually delegate implementation to `implementer`,
`lior` generates two artifacts:

1. A **team charter** — short managed block in `AGENTS.md`: the team, who
   does what, when to delegate.
2. An **orchestration skill** — `.opencode/skills/lior-orchestrator/SKILL.md`
   and `.agents/skills/lior-orchestrator/SKILL.md`, encoding the delegation
   policy: *delegation gate* (when spawning is mandatory), bounded delegation
   contract (objective / scope / constraints / deliverable / acceptance
   criteria), parallelization, model escalation (a sub-agent never escalates
   itself; the orchestrator decides), failure handling, completion gates.
   Per-role models and efforts are injected from `lior.yaml`.
   The skill embeds a *default* workflow (explore → implement → test →
   review) as guidance only; the orchestrator stays autonomous and decides
   who to use and when.

In OpenCode, one can additionally restrict which agents the parent may
launch through `subagent` permissions.

## Write strategy (`apply`)

1. **One file per role** — `.opencode/agents/<role>.md`,
   `.codex/agents/<role>.toml`. Zero merging, idempotent, header
   `# generated-by lior <version>`.
2. **Managed blocks** in existing files:
   - `opencode.jsonc`: AST injection (jsonc-parser) under `agents`, no text
     markers (JSON has no reliable comments).
   - `~/.codex/config.toml`: delimited block `# >>> lior v1 >>>` …
     `# <<< lior <<<`.
   - `AGENTS.md`: delimited section, same principle.
   - Never touch user content; `.bak` on first modification.
3. `apply --dry-run` → diff; `prune` → removes files of retired roles;
   `--global` → writes into `~/.config/opencode/` and `~/.codex/`.
4. `import` — reads existing configs and generates a starter `lior.yaml`.

## Source file (`lior.yaml`)

```yaml
version: 1
harness: [opencode, codex]     # default: all detected

models:                        # registry overlay (short aliases)
  astra: { provider: openai,   id: gpt-6-astra }
  luna:  { provider: openai,   id: gpt-5.6-luna }
  glm:   { provider: zhipuai,  id: glm-5.3 }

bindings:
  orchestrator: astra#high
  implementer:  luna#max
  explorer:     luna#low
  researcher:   luna#low
  tester:       glm
  reviewer:
    model: glm
    codex: openai/astra        # override: Z.ai has no Responses endpoint

providers:                     # credentials/endpoints (never secrets)
  zhipuai:
    base_url: https://api.z.ai/api/paas/v4
    env: ZAI_API_KEY

presets:                       # shareable, committable
  budget:  { orchestrator: glm, implementer: luna#low }
  premium: { orchestrator: astra#high, implementer: astra }
```

Locations: `lior.yaml` at project root; `~/.config/lior/lior.yaml` for
global. Precedence: global < project (bindings override key by key).

## CLI

```
lior init                       # create lior.yaml (interactive or preset)
lior set <role> <model>         # e.g. lior set reviewer glm
lior roles                      # list roles + current model
lior models [search <term>]     # catalog (registry) + pricing + context
lior apply [--harness …] [--dry-run] [--global]
lior diff                       # current configs vs desired state
lior status                     # what each harness uses per role
lior prune                      # remove files of deleted roles
lior import                     # bootstrap from existing configs
lior doctor                     # consistency of generated config (see “Authentication”)
lior usage                      # real tokens & cost per role/model (v0.2)
lior preset list|save|apply
```

## Roadmap

- **v0.1 (MVP)** — schema, registry (models.dev + overlay), OpenCode + Codex
  adapters, `apply`/`diff`/`prune`/`set`, curated roles, presets, generated
  orchestration skill.
- **v0.2** — `doctor`, `usage` (aggregating both harnesses' session logs:
  real tokens/cost per role and model — Codex rollouts
  `~/.codex/sessions`, OpenCode storage), `watch`, interactive TUI,
  `planner`/`summarizer` roles, cost estimates.
- **v1** — optional local gateway (uniform fallback/load-balancing; must
  expose the Responses API for Codex), MCP server exposing the mapping,
  OpenCode plugin, more harnesses (Claude Code, Crush, …).

## Authentication

`lior` **never** touches authentication: no stored secrets, no managed
logins. Credentials belong to the harnesses (`codex login`, OpenCode auth,
Codex providers' `env_key`).

`doctor` is a read-only *smoke test* of consistency between the generated
config and the environment: does the env var referenced by `env_key` exist
(existence check, never reading the value), is the Codex project *trusted*,
are referenced models known to the registry. Goal: avoid first-call
failures, not authenticate on the user's behalf. Any endpoint ping is
optional and off by default.

## Inspirations

- **`codex-astra-luna-orchestrator`** (vendored repo) — a static Codex-only
  distribution of an Astra/Luna topology (Pro/Plus profiles copied by
  `setup.sh`). Worth taking: curated role prompts (worker, explorer,
  researcher, tester, reviewer with Rules/Do-Don't/return-format structure),
  the independent reviewer, explicit model+effort pinning per role file (the
  only stable approach against spawn overrides), the orchestration skill
  (delegation gate, contracts, escalation, gates), budget-based presets
  (Pro/Plus), and `token_usage.py` (real usage per thread/role/model from
  rollouts). `lior` replaces manual copying with parametric multi-harness
  generation; an `astra-luna` preset reproduces their topology in one
  command.

## Risks & attention points

- **Moving formats**: OpenCode V2 is young, Codex adds experimental
  features → isolated adapters + regression tests on fixtures.
- **Codex Responses-only**: the registry overlay must carry a `wire_api`
  flag per provider; the resolver suggests compatible relays (aggregators)
  or fallbacks.
- **Never break user config**: backups, managed blocks, dry-run by default
  whenever an existing file would change.
- **Codex trust**: project `.codex/` configs are ignored if the project is
  not trusted → `doctor` must check it.
