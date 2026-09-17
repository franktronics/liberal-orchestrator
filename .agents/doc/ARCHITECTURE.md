# Technical architecture — lior

## Pipeline

Each step is pure and testable in isolation; only `Loader` (FS reads) and
`Writer` (FS writes) have side effects.

```
lior.yaml ──▶ Loader/Merger ──▶ Resolver ──▶ Planner ──▶ Renderer ──▶ Writer
(project +    (zod schema,     (registry,    (FileOps     (agents .md/   (backup,
 global)       key-by-key       role          per          .toml, jsonc,  dry-run,
               merge)           catalog,      harness)     managed        diff, prune)
                                compat.)                   blocks)
```

## Key types (`src/core/types.ts`)

- `Config` — loaded and merged `lior.yaml` (global < project, bindings
  overridden key by key).
- `Binding` — `{ role, modelRef, harnessOverrides? }`.
- `ModelRef` — `{ provider, model, effort? }`; syntax `provider/model#effort`
  or an alias defined under `models:`.
- `ResolvedBinding` — `{ role, harness, target, modelRef, warnings[] }`.
- `FileOp` — `{ path, action: create | replace | managed | delete, content? }`.
- `Plan` — `{ harness: "opencode" | "codex", ops: FileOp[] }`.

## Modules

| Path | Responsibility |
|---|---|
| `src/cli/` | citty commands — thin, delegate to core |
| `src/core/schema.ts` | zod schema of `lior.yaml` |
| `src/core/loader.ts` | Loading + global/project merge |
| `src/core/roles.ts` | Role catalog (reads `templates/roles/`) |
| `src/core/resolver.ts` | (role, harness) → native targets + compat rules |
| `src/core/presets.ts` | Built-in and user presets |
| `src/registry/` | models.dev client, cache, overlay, search |
| `src/adapters/<harness>/targets.ts` | Role → files/blocks to produce |
| `src/adapters/<harness>/render.ts` | Native-format serialization |
| `src/adapters/<harness>/inject.ts` | Managed-block / JSONC AST injection |
| `src/util/io.ts` | Atomic writes, backups, prune |
| `src/util/diff.ts` | Plan vs on-disk rendering |
| `templates/roles/<role>.md` | Harness-agnostic role definitions |

## Config layering & scope model

Harnesses each have their own multi-file config system. `lior` does not
reimplement their merge semantics; it picks explicit **destinations** per
scope and warns about conflicts it detects.

| Artifact | Project scope (default) | Global scope (`--global`) |
|---|---|---|
| OpenCode agents | `.opencode/agents/<role>.md` | `$XDG_CONFIG_HOME/opencode/agents/` |
| OpenCode skills | `.opencode/skills/lior-orchestrator/` | `$XDG_CONFIG_HOME/opencode/skills/` |
| OpenCode managed config | `opencode.jsonc` (project root) | `$XDG_CONFIG_HOME/opencode/opencode.json(c)` |
| Codex agents | `.codex/agents/<role>.toml` | `$CODEX_HOME/agents/` |
| Codex skills | `.agents/skills/lior-orchestrator/` | `~/.agents/skills/` |
| Codex managed config | `.codex/config.toml` — `model`, `[agents]` defaults only | `$CODEX_HOME/config.toml` — adds `model_providers`, `model_provider`, `review_model`, `memories.*` |

Rules:

- Honor environment overrides: `CODEX_HOME`, `XDG_CONFIG_HOME` (custom
  directories are just relocated homes).
- Codex hard rule: provider/auth keys in project `.codex/config.toml` are
  silently ignored → the resolver forces those keys to global scope and
  warns when running project-only (per Q1 decision: user-level writes need
  explicit `--global`).
- OpenCode merges every `opencode.json(c)`/`.opencode/` found up the tree
  (monorepo friendly); `lior` writes at the current project root, which has
  the highest precedence. For monorepos, run `lior` from the root (or a
  package dir — bindings then apply to that subtree).
- Agent name collisions across scopes (user vs project): project wins in
  both harnesses; `lior` detects duplicates and warns.
- Managed-block lifecycle: `lior` **updates any block bearing its markers
  wherever found** (self-cleaning, including user-level), but never
  *creates* user-level artifacts without `--global`.

## Role catalog (`templates/roles/<role>.md`)

Single harness-agnostic format: frontmatter (`id`, `title`, `description`,
`defaultEffort`, `sandbox`, optional per-harness `permissions`) + body =
system prompt (English). Adapters translate to OpenCode Markdown/frontmatter
or Codex TOML (`name`, `description`, `developer_instructions`, `model`,
`model_reasoning_effort`, `sandbox_mode`).

## Write formats

- **Generated agent file** — header `# generated-by lior <version> — edits
  will be overwritten`, rewritten on every `apply` (action `replace`).
- **Managed TOML/Markdown block** — delimiters `# >>> lior v1 >>>` /
  `# <<< lior <<<`; only the content between delimiters is replaced
  (action `managed`).
- **JSONC (`opencode.jsonc`)** — AST injection (`jsonc-parser`), merging the
  `agents` key and `model`, no text markers (no reliable comments in JSON).
- **Backups** — `.lior-backup/` at project root; `*.bak` next to user files
  (`~/.codex/config.toml`), on first modification only.

## Registry

- `https://models.dev/api.json` → cache `~/.cache/lior/registry.json` (24 h TTL).
- Trimmed snapshot bundled in the package (offline-first), refreshed by
  `scripts/update-registry.ts`.
- Overlay: `models:` adds or overrides registry entries (including private
  models, display name, token limits, capabilities, release date, and cost).
  `providers:` carries `base_url`, env var, and per-provider `wire_api` flag
  (Codex Responses-only compatibility).
- Invalid or incompatible cache files are ignored with a warning before
  falling back to the network or bundled snapshot.

## Project discovery

Commands search for the nearest `lior.yaml` from the current directory up to
the filesystem root. This keeps project aliases and bindings active when lior
is invoked from nested package or source directories. The global config remains
the lower-precedence layer.

## Effort mapping

Canonical vocabulary: `minimal | low | medium | high | xhigh | max`.
OpenCode: pass-through as `#variant` (provider semantics). Codex: check the
model's `model_reasoning_effort` whitelist; unsupported value → warning +
value dropped (never a silent failure).

## Dependencies

- Runtime: `citty`, `zod`, `yaml`, `smol-toml`, `jsonc-parser`,
  `@clack/prompts`, `picocolors`.
- Dev: `bun-types`, `@biomejs/biome`, `typescript` (strict).

## Tests & CI

- Unit: `bun test`, `*.test.ts` files next to the code.
- Golden files: `tests/fixtures/<harness>/<case>/` — expected tree vs generated.
- E2E: temporary directory + fake `$HOME`, full `init → set → apply → diff →
  prune` flow.
- CI GitHub Actions: install, lint (Biome), typecheck, tests.

## Compatibility & distribution

- ESM, Node ≥ 20 compatible; development and tests with Bun.
- npm: package `lior` (bin `lior`) ships a bundled Node-compatible
  `dist/cli.js`; CI builds it, runs it with Node, and inspects the npm package.
- The project is MIT-licensed. Role prompts derived from
  `codex-astra-luna-orchestrator` remain subject to its Apache-2.0 terms and
  are distributed with the required attribution in `NOTICE`.
