# Database Client for Zed

This repository is a **Zed-native scaffold** for a database extension inspired by
`vscode-database-client`, but shaped around what Zed extensions can actually do today.

## Why this is not a direct VS Code port

`vscode-database-client` depends heavily on:

- activity-bar containers
- tree views
- webview panels
- VS Code command and UI contribution points

Zed extensions currently center around:

- `extension.toml`
- Rust/WASM extension code
- slash commands
- context servers (MCP)
- language tooling integration
- project-local tasks

So this scaffold is intentionally built as:

`Zed extension -> Rust bridge -> Node sidecar / MCP server -> future DB adapters`

## Workspace layout

- `src/`, `scripts/`, `examples/`, `docs/`, `.zed/`: active extension scaffold
- `vscode-database-client/`: reference implementation
- `zed-editor/`: Zed API and extension reference
- `zandbox/`: scratch notes, prompts, and session memory

## What the scaffold already provides

- `extension.toml` with slash-command and context-server registration
- Rust extension entrypoint in `src/lib.rs`
- zero-dependency Node sidecar in `scripts/sidecar.mjs`
- example connection config in `examples/connections.example.json`
- Zed local tasks in `.zed/tasks.json`
- `npm run doctor` to validate prerequisites
- root `Makefile` shortcuts for extension work

## Current scope

Implemented now:

- scaffolded slash commands
- scaffolded MCP server
- connection-config loading
- example connection inventory
- environment validation

Not implemented yet:

- real database drivers
- query execution
- schema introspection
- SSH tunnel orchestration
- result-grid UI
- connection editing UI inside Zed

## Prerequisites

- Node.js 20+ inside WSL/Linux
- Rust via `rustup`
- Rust target `wasm32-wasip2`
- Linux Zed binary when using the no-admin WSL path
- Zed installed locally

## No-Admin WSL/Linux Setup

This path avoids Visual Studio Build Tools, but it only works when the toolchain stays Linux-native inside WSL.

- `node` and `npm` must resolve to Linux binaries, not `/mnt/c/...`
- `cargo` and `rustup` must be the WSL/Linux ones
- `zed` must be the Linux Zed binary, not the Windows app launcher
- keep the repo checked out under `/home/...` in WSL, not a Windows UNC path

A user-space Node manager such as `nvm` is the simplest way to install Node 20+ without admin rights.

Example:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
. "$HOME/.nvm/nvm.sh"
nvm install 20
nvm use 20
rustup target add wasm32-wasip2
```

## Commands

```bash
npm install
npm run doctor
npm run format
npm run format:check
npm run gitleaks
npm run sidecar:status
npm run sidecar:list
npm run sidecar:serve
npm run build:wasm
```

Or:

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

## Pre-commit hooks

Husky is configured to run on `pre-commit`.

The hook runs:

- staged formatting
- `gitleaks` against staged changes

`gitleaks` is an external binary and must be available on `PATH`, or exposed through
`GITLEAKS_BIN=/absolute/path/to/gitleaks`.

## Connection config

For local CLI testing, the scaffold uses:

- `examples/connections.example.json`

For real project usage, the intended workspace-local config path is:

- `.zed/database-client.connections.json`

You can also point the context server at any absolute config file path through Zed settings once the
dev extension is installed.

The config format intentionally prefers environment-variable references for secrets:

```json
{
  "connections": [
    {
      "id": "local-postgres",
      "driver": "postgres",
      "host": "127.0.0.1",
      "port": 5432,
      "database": "app",
      "username": "app",
      "passwordEnv": "PGPASSWORD"
    }
  ]
}
```

## Install in Zed

1. Open the Linux Zed binary inside WSL.
2. Run `zed: extensions`.
3. Click `Install Dev Extension`.
4. Choose this repository root from the Linux filesystem path, for example `/home/erisanh/projects/area/zed-database-client`.

If you use the Windows Zed binary, the dev-extension build still runs on Windows and will not be admin-free.

If Rust is missing, the installation/build will fail until the Rust toolchain is installed. On Linux/WSL, no Visual Studio Build Tools are needed.

## Zed context-server settings example

After the extension is installed, configure the context server in your Zed settings:

```json
{
  "context_servers": {
    "database-client": {
      "settings": {
        "config_path": "/absolute/path/to/database-client.connections.json"
      }
    }
  }
}
```

## Next milestones

1. Add real driver adapters for PostgreSQL and MySQL first.
2. Add `db_run_query` execution in the sidecar and expose it through MCP tools.
3. Add schema introspection output tuned for LLM and slash-command consumption.
4. Add optional SSH tunnel process management.
