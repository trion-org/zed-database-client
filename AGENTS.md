# AGENTS.md — Database Client for Zed

## Project Overview

This repository is the active codebase for a **Zed-native database extension**.

It uses two local references:

- `vscode-database-client/` as the feature and workflow reference
- `zed-editor/` as the extension-platform and API reference

The target is **not** a direct VS Code port.
Zed currently supports extensions through **Rust/WASM**, **slash commands**, **context servers (MCP)**,
language servers, snippets, grammars, and related extension APIs.
It does **not** expose the same custom sidebar/tree/webview surface area as VS Code.

The current implementation strategy is:

`extension.toml -> Rust/WASM bridge -> Node sidecar / MCP server -> future DB adapters`

---

## Repository Layout

- `src/`: Rust/WASM Zed extension entrypoint
- `scripts/`: Node sidecar and environment helpers
- `examples/`: example connection config files
- `docs/`: architecture notes and migration constraints
- `.zed/`: local Zed tasks and project settings
- `zandbox/`: scratch area for prompts, notes, session memory, and experiments
- `vscode-database-client/`: reference-only upstream VS Code extension
- `zed-editor/`: reference-only upstream Zed source tree

---

## Build / Check Commands

### Package Manager

- **Node package manager:** `npm`
- **Rust toolchain manager:** `rustup`

### Extension Commands

Run from the repo root.

```bash
# Install npm dependencies and initialize Husky hooks
npm install

# Check prerequisites and scaffold integrity
npm run doctor

# Format supported project files
npm run format

# Check formatting without writing changes
npm run format:check

# Scan the git repository for secrets
npm run gitleaks

# Print scaffold sidecar status using the example config
npm run sidecar:status

# List configured example connections
npm run sidecar:list

# Run the local MCP sidecar over stdio
npm run sidecar:serve

# Build the Rust/WASM extension
npm run build:wasm

# Full build gate
npm run build
```

### Makefile Shortcuts

```bash
make install
make doctor
make format
make format-check
make gitleaks
make status
make list
make serve
make build-wasm
make extension-build
```

### Pre-commit Hook

Husky runs the `precommit` script on each commit.
The hook currently:

- formats staged files
- runs `gitleaks` on staged changes

`gitleaks` must be installed separately and available on `PATH`, or set through `GITLEAKS_BIN`.

### Testing

There is no automated test suite yet.

Current validation is:

- `npm run doctor`
- `npm run sidecar:status`
- `npm run sidecar:list`
- manual Zed dev-extension install and runtime checks

When tests are added, prefer:

```bash
npm test
```

---

## Toolchain Requirements

- **Node.js:** `>= 20`
- **Rust:** `1.93`
- **Rust target:** `wasm32-wasip2`

The scaffold includes `rust-toolchain.toml` so the intended Rust version is explicit.

If `cargo` or `rustup` is missing, the Node sidecar can still run, but the Zed extension itself
cannot be built until Rust is installed.

---

## Architecture Rules

### Zed Extension Layer (`src/lib.rs`)

- Owns Zed-facing integration only
- Registers slash commands
- Starts the MCP/context-server process
- Reads Zed context-server settings and passes them to the sidecar
- Must stay thin; do not push database business logic into the WASM layer

### Sidecar Layer (`scripts/sidecar.mjs`)

- Owns process-level logic and protocol handling
- Provides a CLI mode for local debugging
- Provides an MCP stdio mode for Zed Agent integration
- Reads connection config files
- Future DB driver logic belongs here or in modules imported from here

### Connection Config

Secrets must not be committed.
Prefer environment-variable references such as `passwordEnv` instead of raw passwords.

Planned search order for config:

1. explicit CLI `--config`
2. `DATABASE_CLIENT_CONFIG` environment variable
3. workspace-local files such as `.zed/database-client.connections.json`
4. the example config for local smoke testing

---

## Code Style

### General

- Default to ASCII
- Keep comments short and only where structure is non-obvious
- Favor explicit names over clever abstractions
- Keep the Rust layer small and the sidecar behavior testable from the CLI

### JavaScript

- ESM modules only
- No runtime dependency unless it clearly reduces complexity enough to justify install cost
- Prefer built-in Node APIs first
- Use 2-space indentation

### Rust

- Use `rustfmt`
- Keep state minimal
- Prefer helper methods over giant `match` bodies
- Use `zed_extension_api` from the local `zed-editor/` path while this workspace is local-only
- Before publishing externally, replace the path dependency with a crates.io version compatible with the target Zed release

### JSON / TOML

- 2-space indentation in JSON
- Keep manifests and example configs human-editable

---

## Naming Conventions

| Element         | Convention             | Example                     |
| --------------- | ---------------------- | --------------------------- |
| Directories     | `kebab-case`           | `database-client`           |
| Rust crate name | `snake_case`           | `database_client_extension` |
| Rust types      | `PascalCase`           | `DatabaseClientExtension`   |
| Rust functions  | `snake_case`           | `context_server_command`    |
| JS files        | `kebab-case`           | `check-env.mjs`             |
| CLI commands    | `kebab-case`           | `list-connections`          |
| Slash commands  | `kebab-case`           | `db-status`                 |
| Env vars        | `SCREAMING_SNAKE_CASE` | `DATABASE_CLIENT_CONFIG`    |

---

## Key Rules & Gotchas

- **Do not implement against VS Code UI assumptions.** There is no Zed equivalent for most custom VS Code explorer/webview surfaces.
- **Do not edit `vscode-database-client/` for product work.** Use it as a reference only.
- **Do not edit `zed-editor/` unless the task is explicitly about upstream exploration or patching.**
- **Do not commit secrets** in configs, examples, logs, or session snapshots.
- **Do not assume Cargo is installed** on every machine; always keep `npm run doctor` useful even when Rust is missing.
- **Do not widen extension capabilities casually.** If the extension only needs `node`, avoid broader process allowances later.
- **Keep MCP outputs deterministic and text-first** so they remain usable by models and easy to inspect manually.

---

## Development Workflow

1. Inspect relevant reference code in `vscode-database-client/`
2. Confirm the matching Zed capability in `zed-editor/`
3. Implement or adjust the scaffold in the repo root
4. Run local checks:
   - `npm run doctor`
   - `npm run sidecar:status`
   - `npm run sidecar:list`
5. If Rust is available, run `npm run build:wasm`
6. Install the extension in Zed via `zed: install dev extension`
7. Validate slash commands and the context server from inside Zed

---

## Session Memory (`zandbox/session_diff/`)

On each meaningful session, add a new JSON snapshot file to `zandbox/session_diff/` using:

`session-YYYYMMDD-HHMMSS.json`

Each snapshot should include:

- `session_time`
- `summary`
- `context_loaded`
- `timeline`
- `commands`
- `decisions`
- `files_changed`
- `issues`
- `next_steps`

Rules:

- Keep the log concise but complete enough to resume work
- Never store secrets, tokens, passwords, or raw connection credentials
- Redact any sensitive value as `***REDACTED***`
