# Implementation plan — v0.1 (MVP)

## Scope

**Included**: `lior.yaml` schema + loader, registry (models.dev + overlay),
curated role catalog, multi-harness resolver, OpenCode + Codex adapters,
`init`/`set`/`roles`/`models`/`status`/`diff`/`apply`/`prune`/`preset`,
team charter + orchestration skill generation, backups, dry-run.

**Non-goals v0.1**: `doctor`, `usage`, `import`, `watch`, rich TUI, local
gateway, MCP server, OpenCode plugin, harnesses other than OpenCode/Codex,
`planner`/`summarizer` roles.

## Settled decisions

- **Q1 = hybrid user-level writes**: project-only by default; `apply
  --global` (explicit, confirmed) writes the managed block into the
  user-level Codex config. Provider/auth keys are always routed to global
  scope with a warning otherwise. See ARCHITECTURE.md “Config layering &
  scope model”.
- **Q3 = 6 roles** in v0.1: `orchestrator`, `implementer`, `explorer`,
  `researcher`, `reviewer`, `tester`. Only roles with a binding are
  generated (selecting roles = editing bindings).
- **Q4 = full orchestration skill in v0.1** (charter + skill, models
  injected).
- **Q5 = dry-run by default** when existing files would change; interactive
  confirmation; `--yes` bypass for scripting.
- **Q2 = role prompts adapted from the vendored repo**
  (`codex-astra-luna-orchestrator`, Apache-2.0): restructured into our
  template format, attribution kept in `NOTICE`.
- **Q6 = orchestrator autonomy**: no user-declared workflow pipeline in
  `lior.yaml`; the generated orchestration skill embeds a *default* workflow
  as guidance only — the orchestrator decides who to use and when.

All grilling decisions are settled; no open questions remain.

## Phases

### Phase 0 — Foundation (done)

- `bun init`, strict `tsconfig`, Biome, `bun test` wiring, GitHub Actions CI
  (install + lint + typecheck + test).
- Folder structure + `lior` bin (citty) with `--help`.

**Acceptance**: `bun run lior --help` works; green CI on an empty commit.

### Phase 1 — Core & registry (done)

- `core/schema.ts`: full zod schema of `lior.yaml` (version, harness,
  models, bindings, providers, presets).
- `core/loader.ts`: merge global (`~/.config/lior/lior.yaml`) < project.
- `registry/`: models.dev fetch + 24 h cache (`~/.cache/lior/`), bundled
  snapshot (7.6k models), validated-cache fallback, private-model overlay,
  `search`.
- `ModelRef` parser (`provider/model#effort`, aliases; splits on the first
  slash because model ids may contain slashes).
- Upward project discovery keeps `lior.yaml` active from nested directories.
- npm packaging exposes the built Node-compatible `lior` executable and is
  smoke-tested in CI.

**Acceptance**: `lior models search glm` offline (snapshot) and online;
unit tests for parser/merge/search.

### Phase 2 — Roles & resolver (1–2 d)

- `templates/roles/`: curated roles (prompts adapted from the vendored repo,
  Apache-2.0 — attribution in `NOTICE`), harness-agnostic format
  (frontmatter + prompt).
- `core/resolver.ts`: (role, harness) → `ResolvedBinding[]`; rules:
  - Codex: custom providers Responses-only; `model_providers`,
    `model_provider`, `review_model` only in **user** config; `model` and
    agent files OK in project config.
  - OpenCode: built-ins (`build`, `plan`, `general`, `explore`) overridden
    via JSONC keys, not files.
  - Canonical effort mapping → `model_reasoning_effort` / `#variant`.
- Warnings model (never a silent failure) + exit codes.

**Acceptance**: resolver unit tests on config fixtures.

### Phase 3 — Adapters (2–3 d)

- **Codex** adapter: `.codex/agents/<role>.toml` (project), managed block in
  `~/.codex/config.toml` (`--global`), skill
  `.agents/skills/lior-orchestrator/`, charter section in `AGENTS.md`.
- **OpenCode** adapter: `.opencode/agents/<role>.md`, AST injection in
  `opencode.jsonc` (`model`, `agents.*`), skill `.opencode/skills/`.
- `util/io.ts`: atomic writes, backups, `generated-by` headers, prune.
- `util/diff.ts`: plan vs on-disk rendering.
- Scope model per ARCHITECTURE.md (env overrides, global routing of provider
  keys, duplicate-agent warnings).

**Acceptance**: golden tests `tests/fixtures/<harness>/<case>/`; e2e smoke
on a temp directory with a fake `$HOME`.

### Phase 4 — CLI surface (1–2 d)

- `lior init` interactive (@clack/prompts) with `default` / `astra-luna` /
  `budget` presets.
- `lior set`, `roles`, `status`, `diff`, `apply` (`--dry-run`, `--global`,
  `--harness`), `prune`, `preset list|apply|save`.
- Dry-run-by-default semantics + `--yes` (Q5).

**Acceptance**: e2e happy path `init → set → apply → diff → prune` in a
temp directory, both harnesses.

### Phase 5 — Release (0.5–1 d)

- README (usage, demo GIF, “no magic” philosophy), `NOTICE` (attributions),
  `npm publish lior@0.1.0`, git tag.

## Definition of Done v0.1

1. A new user gets a working Astra/Luna topology in Codex **and** OpenCode
   in ≤ 3 commands, without hand-editing any file.
2. `apply` is idempotent (two runs = zero diff) and never modifies user
   content outside managed blocks (backups created).
3. No silent failures: every incompatibility produces a visible warning.
4. Golden tests + e2e pass in CI; core coverage (resolver, loader) ≥ 90 %.
