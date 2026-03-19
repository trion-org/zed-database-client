# Architecture Notes

## Reference Mapping

This project draws from two references with different roles:

- `../vscode-database-client/`: product behavior, command inventory, database feature ideas
- `../zed-editor/`: actual extension capability boundary

## Porting Rule

Port **intent**, not **UI structure**.

Examples:

| VS Code concept            | Zed-native replacement                               |
| -------------------------- | ---------------------------------------------------- |
| Activity bar explorer      | slash commands + MCP tools                           |
| Tree view of connections   | textual connection inventory via slash command / MCP |
| Webview result grid        | structured text or future external renderer          |
| Extension commands         | slash commands + Zed tasks                           |
| Background service manager | sidecar process launched by extension                |

## Chosen Layers

### 1. Extension manifest

`extension.toml` declares:

- slash commands
- context server
- process capability for `node`

### 2. Rust/WASM bridge

`src/lib.rs` is intentionally thin:

- launch the sidecar for slash commands
- launch the sidecar as an MCP server
- publish context-server install instructions and settings schema

### 3. Node sidecar

`scripts/sidecar.mjs` serves two modes:

- CLI mode for local testing
- stdio MCP mode for Zed Agent integration

This keeps most runtime logic outside the WASM environment.

## Why Node for the sidecar

- available in the current machine already
- easier to iterate on protocol behavior
- allows future npm-based DB drivers if desired
- avoids overloading the Rust/WASM layer with process and IO complexity

## Immediate Roadmap

1. Stabilize config format
2. Implement PostgreSQL adapter
3. Implement MySQL adapter
4. Add query execution MCP tool
5. Add schema summary/introspection MCP tool
6. Revisit richer UX when Zed exposes more extension surfaces
