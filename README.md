# Liberal Orchestrator (`lior`)

`lior` is a command-line tool for explicitly assigning AI models to roles in
coding-agent harnesses such as OpenCode and Codex.

The project is currently in its first development milestone. This version
provides the configuration schema and loader, model-reference parsing, and a
searchable model registry with online, cached, and bundled offline sources.

## Current capabilities

- Parse and validate `lior.yaml` files.
- Merge user-level and project-level configuration.
- Resolve model aliases and reasoning-effort suffixes.
- Search the [models.dev](https://models.dev/) registry.
- Work offline from a cache or the bundled registry snapshot.
- Add private models or override registry metadata through `lior.yaml`.
- Build a Node.js-compatible npm CLI package.

The `init`, `set`, `apply`, `diff`, and harness-generation commands are planned
but are not part of this milestone yet.

## Requirements

- [Bun](https://bun.sh/) for development and tests.
- Node.js 20 or newer for the built CLI package.

## Test locally

Clone the repository and install its dependencies:

```bash
git clone https://github.com/franktronics/liberal-orchestrator.git
cd liberal-orchestrator
bun install
```

Run the complete development validation:

```bash
bun run lint
bun run typecheck
bun test
```

Test the CLI without making a network request:

```bash
bun run lior --help
bun run lior models search glm --offline
bun run lior models info zhipuai/glm-5.3 --offline
```

Remove `--offline` to refresh the registry from models.dev and cache it under
`~/.cache/lior/`:

```bash
bun run lior models search claude
```

### Test project aliases

The repository includes a sample `lior.yaml`. Model aliases declared there can
be queried directly:

```bash
bun run lior models info glm --offline
```

A minimal configuration looks like this:

```yaml
version: 1
models:
  glm: { provider: zhipuai, id: glm-5.3 }
bindings:
  reviewer: glm
```

`lior` discovers the nearest `lior.yaml` by walking upward from the current
directory.

### Test the distributable package

Run the package smoke test to build, pack, install, and execute the CLI in a
temporary directory:

```bash
bun run package:check
```

To test the executable globally on your machine:

```bash
bun run build
npm link
lior --help
lior models search glm --offline
```

Remove the global link when finished:

```bash
npm unlink -g lior
```

## Development commands

| Command | Purpose |
| --- | --- |
| `bun run lior --help` | Run the CLI from source |
| `bun test` | Run all tests |
| `bun run lint` | Check formatting and lint rules |
| `bun run typecheck` | Check TypeScript types |
| `bun run build` | Build `dist/cli.js` for Node.js |
| `bun run package:check` | Smoke-test the npm package |

## License

This project is available under the [MIT License](LICENSE).
