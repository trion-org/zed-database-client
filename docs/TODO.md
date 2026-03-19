# TODO Roadmap

## Goal

Build a Zed database extension whose UI and workflow stay as close as
practically possible to `vscode-database-client`.

This project is not targeting a text-first or reduced-parity outcome.
The product requirement is:

- near-parity connection explorer
- near-parity query editor workflow
- near-parity result view / result grid workflow
- near-parity history and saved-query workflow
- near-parity multi-driver support over time

## Non-negotiable product requirements

| Requirement                                                                        | Why it matters                                                                        | Priority |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| UI should feel close to the VS Code reference product, not like a thin CLI wrapper | The reference product is adopted because of its interactive workflow and visual model | P0       |
| Persistent database UI, not only slash commands                                    | The VS Code product is primarily UI-driven                                            | P0       |
| Connection explorer close to the VS Code sidebar/tree experience                   | This is the main navigation surface                                                   | P0       |
| Query result UI close to the VS Code table/grid experience                         | Query output is the core usage loop                                                   | P0       |
| Query tabs bound to connections                                                    | This is a core mental model from the reference product                                | P0       |
| History and saved query workflows                                                  | Required for day-to-day usage parity                                                  | P1       |
| SSH-based connectivity                                                             | One of the highest-value operational features in the reference product                | P1       |

## Key constraint

Zed's current extension APIs may not support a VS Code-like custom sidebar and grid UI directly.
Because of that, the roadmap must include an early architecture decision gate.

The project must not proceed as if native Zed extension APIs are already sufficient.

## UI parity strategy options

| Option                             | Description                                                                 | Pros                                  | Cons                                         | Decision trigger                           |
| ---------------------------------- | --------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| A. Native Zed extension UI         | Build the UI entirely within current Zed extension capabilities             | Simplest packaging if possible        | May be impossible with current APIs          | Choose only if Phase 1 proves it           |
| B. Hybrid extension + companion UI | Zed extension handles integration, companion local UI handles explorer/grid | Most realistic path to near-UI parity | More moving parts and packaging work         | Choose if native APIs are insufficient     |
| C. Upstream/fork path              | Add missing UI surfaces to Zed itself or maintain a fork                    | Best parity if successful             | Highest cost and dependency on upstream code | Choose only if product quality requires it |

## VS Code to target-Zed mapping

| VS Code surface              | Reference behavior                                        | Target outcome for this project                                  | Parity target            |
| ---------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------ |
| Activity bar + explorer tree | Connections, schemas, tables, views, routines, redis keys | Persistent left-side database explorer with expandable hierarchy | Near parity              |
| Webview result grid          | Sort, inspect, page through rows, edit cells              | Persistent result view with grid-like interaction                | Near parity              |
| Query documents              | SQL files bound to a connection                           | Connection-bound query tabs and execution context                | Near parity              |
| History view                 | Replay and review executed queries                        | Query history panel or equivalent persistent UI                  | Strong parity            |
| Saved queries                | Reuse recurring SQL snippets/files                        | Saved query browser and reopen flow                              | Strong parity            |
| Connection forms             | Add/edit connection configs in UI                         | In-app connection create/edit UX, not config-file only           | Near parity              |
| SSH integration              | Tunnel and remote filesystem helpers                      | SSH tunnel workflow at minimum; file browser if feasible later   | Partial to strong parity |

## Phase roadmap

| Phase                                   | Objective                                                                     | Main scope                                                                                            | Deliverables                                                                                    | Dependencies                                  | Exit criteria                                                                    | Status |
| --------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| 0. Foundation                           | Keep the repo buildable and extensible                                        | Manifest, Rust bridge, Node sidecar, wasm build, local tasks                                          | `extension.toml`, `src/lib.rs`, `scripts/sidecar.mjs`, `npm run doctor`, `npm run build:wasm`   | Rust toolchain, local `zed-editor/` reference | Extension builds and sidecar CLI works                                           | DONE   |
| 1. UI feasibility spike                 | Prove how the product can achieve near-VS Code UI parity inside or around Zed | Evaluate native Zed UI capability, extension host limits, hybrid UI path, install/runtime integration | Architecture decision record, UI prototype, risk matrix, final decision among Option A/B/C      | Phase 0                                       | One approved architecture path for the final UI exists                           | NEXT   |
| 2. Product shell parity                 | Create the visible application shell users will recognize                     | Left explorer shell, result shell, query tab shell, command routing, state store                      | Initial persistent UI shell, navigation model, workspace state, connection-bound tabs           | Phase 1                                       | Users can open the product shell and move between explorer/query/result surfaces | NEXT   |
| 3. Connection UX and config model       | Replace config-file-only setup with real product UX                           | Add/edit/delete connection UI, validation, secret handling, workspace/global settings                 | Connection form UI, normalized config schema, secret resolution, migration path from JSON files | Phase 2                                       | A user can create and edit connections without touching raw JSON                 | NEXT   |
| 4. Adapter layer and first real drivers | Add real database connectivity                                                | Adapter contract, pooling, connect/disconnect, ping, query API, metadata API                          | PostgreSQL adapter, MySQL adapter, shared result model, smoke tests                             | Phase 3                                       | PG and MySQL connect and execute real queries                                    | NEXT   |
| 5. Explorer parity                      | Build the database browsing experience close to the VS Code reference         | Databases, schemas, tables, views, functions, procedures, triggers, columns, refresh                  | Explorer data model, metadata cache, refresh actions, open-object commands                      | Phase 4                                       | Explorer supports real hierarchical browsing with acceptable performance         | NEXT   |
| 6. Query and result parity              | Build the core query execution loop with UI close to the reference product    | Execute selected SQL, current SQL, run all, cancel, pagination, result grid, explain errors clearly   | Query run pipeline, result grid, connection binding, result tabs, selection model               | Phase 4, 5                                    | A user can query and inspect results in a near-reference workflow                | NEXT   |
| 7. History and saved-query parity       | Recreate recurring daily workflows                                            | Query history, recent executions, saved query files, reopen and rerun flows                           | History store, saved-query browser, retention policy, search/filter UI                          | Phase 6                                       | Query history and saved-query loops are production-usable                        | P1     |
| 8. Data editing parity                  | Add table-edit and write workflows                                            | Insert, update, delete, row editing, confirmations, transaction safeguards, read-only mode            | Editable result rows where feasible, write confirmation UX, DML safety layer                    | Phase 6                                       | Users can modify data safely in supported drivers                                | P2     |
| 9. SSH and remote parity                | Support real-world database access patterns                                   | SSH tunnel manager, bastion config, lifecycle, reconnect, health checks                               | SSH config UI, tunnel runtime, driver integration over forwarded ports                          | Phase 3, 4                                    | Users can reach protected databases through SSH tunnels                          | P1     |
| 10. Additional drivers                  | Expand the product toward the reference matrix                                | SQLite, Redis, ClickHouse, ElasticSearch, future adapters                                             | Adapter matrix, driver-specific explorer/query UX, support docs                                 | Phase 4, 5                                    | At least two additional drivers reach MVP quality                                | P2     |
| 11. Import/export/backup/admin tooling  | Cover operational workflows from the reference product                        | Export results, import SQL, backup hooks, schema diff, mock data, doc generation                      | Export/import UX, external binary integration, admin tooling backlog execution                  | Phase 6, 8                                    | Core admin workflows exist for the main drivers                                  | P2-P3  |
| 12. Packaging, CI, release              | Make the product maintainable and distributable                               | CI, smoke tests, compatibility matrix, release notes, installer/runtime validation                    | CI pipeline, release checklist, packaged artifact strategy, regression matrix                   | Phase 0-11                                    | Repeatable release process and regression checks exist                           | P1     |

## Feature parity checklist

| Feature group                         | Target parity            | Target phase | Notes                                         |
| ------------------------------------- | ------------------------ | ------------ | --------------------------------------------- |
| Connection explorer UI                | Near parity              | 5            | Must feel close to the VS Code product        |
| Connection create/edit UI             | Near parity              | 3            | Config file only is not sufficient            |
| Query execution                       | Near parity              | 6            | Includes selected/current/all execution modes |
| Result grid                           | Near parity              | 6            | Sorting, paging, row context, clear state     |
| Schema browsing                       | Strong parity            | 5            | Tables, columns, views, routines, indexes     |
| Query history                         | Strong parity            | 7            | Search and replay required                    |
| Saved queries                         | Strong parity            | 7            | Persistent user workflow required             |
| Data editing                          | Partial to strong parity | 8            | Depends on result-grid capabilities           |
| SSH tunneling                         | Strong parity            | 9            | Required for production use cases             |
| PostgreSQL/MySQL                      | Strong parity            | 4-6          | First-class drivers                           |
| SQLite/Redis/ClickHouse/ElasticSearch | Progressive parity       | 10           | Sequence depends on demand                    |
| Backup/import/mock/schema diff        | Partial parity           | 11           | Important, but after core UI/query parity     |

## Recommended implementation order

| Order | Area        | Why                                                                                             |
| ----- | ----------- | ----------------------------------------------------------------------------------------------- |
| 1     | Phase 1     | Without the UI architecture decision, the rest of the plan may be built on the wrong foundation |
| 2     | Phase 2     | The product shell must exist before feature flows can feel like the reference product           |
| 3     | Phase 3     | Real connection UX is required before users can adopt the tool                                  |
| 4     | Phase 4     | Real drivers unlock everything else                                                             |
| 5     | Phase 5     | Explorer parity is one of the primary identity surfaces of the product                          |
| 6     | Phase 6     | Query/result parity is the main value loop                                                      |
| 7     | Phase 7     | History and saved queries make it viable for daily use                                          |
| 8     | Phase 9     | SSH is a major operational requirement                                                          |
| 9     | Phase 8     | Editing can come after read/query paths are solid                                               |
| 10    | Phase 10-12 | Driver expansion and release hardening follow the stable core                                   |

## Beta-ready definition

| Area            | Requirement                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------- |
| Build           | `npm run doctor` and `npm run build:wasm` pass consistently                                  |
| UI              | Explorer, query surface, and result surface look and behave close to the reference product   |
| Drivers         | PostgreSQL and MySQL are production-usable                                                   |
| Workflow        | Connection management, schema browsing, query execution, history, and export are all present |
| Reliability     | Timeouts, reconnects, refresh, error handling, and large-result handling are acceptable      |
| Zed integration | Dev extension install works and the runtime experience is stable                             |
| Docs            | README, architecture, TODO, setup, troubleshooting, and support matrix are complete          |

## Open questions

| Question                                                                                      | Impact                               | Priority |
| --------------------------------------------------------------------------------------------- | ------------------------------------ | -------- |
| Can current Zed extension APIs host a near-VS Code explorer and result UI directly?           | Decides the entire architecture path | P0       |
| If not, what is the cleanest hybrid UX that still feels integrated inside Zed?                | Decides product shell and packaging  | P0       |
| What is the minimum acceptable result-grid feature set for beta parity?                       | Shapes Phase 6 scope                 | P1       |
| Should history and saved queries live in JSON, SQLite, or another local store?                | Shapes Phase 7 maintainability       | P1       |
| Which two non-PG/MySQL drivers should come next: SQLite, Redis, ClickHouse, or ElasticSearch? | Shapes Phase 10 roadmap              | P2       |
| How much of backup/import/mock/schema-diff belongs in-core vs sidecar subcommands?            | Shapes Phase 11                      | P2       |
