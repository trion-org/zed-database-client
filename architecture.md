# Architecture

This document is the consolidated architecture reference for the current extension. It does not propose a refactor; it describes the runtime architecture that exists today.

## Document Map

- [diagram.md](diagram.md): quick overview diagrams
- [deep-dive-query.md](deep-dive-query.md): query pipeline
- [deep-dive-tree-explorer.md](deep-dive-tree-explorer.md): explorer and node system
- [deep-dive-webview-app.md](deep-dive-webview-app.md): webview shell, router, and message bus

## 1. System Context

```mermaid
flowchart LR
    User["User"] --> VSCode["VS Code surface<br/>commands, tree views, editors, webviews"]
    VSCode --> Entry["src/extension.ts"]

    Entry --> Runtime["Runtime core"]
    Runtime --> Tree["Tree explorer subsystem"]
    Runtime --> Query["Query subsystem"]
    Runtime --> Webview["Webview subsystem"]
    Runtime --> Infra["Infra subsystem"]

    Tree --> Drivers["DB / NoSQL / SSH / FTP drivers"]
    Query --> Drivers
    Webview --> Drivers
    Infra --> Drivers
```

## 2. Design Summary

- This extension is a small application running inside VS Code, not just a language helper.
- `src/extension.ts` is the command registry and entry point, not the business layer.
- The `Node` layer is both a domain model and a UI model because `Node` extends `vscode.TreeItem`.
- `DbTreeDataProvider` hydrates serialized connection definitions from `globalState` and `workspaceState` into node objects.
- `ConnectionManager` owns active-node state, connection reuse, typed driver creation, and SSH tunneling.
- `QueryUnit` orchestrates query execution, while `QueryPage` is the backend adapter for the result webview.
- `ViewManager` is the shared webview shell for both `app.html` and `result.html`.

## 3. Module Boundaries

| Layer | Main files | Responsibility |
| --- | --- | --- |
| Surface | `package.json`, `src/extension.ts` | Activation events, command names, menus, VS Code registration |
| Composition root | `src/service/serviceManager.ts` | Initialize services, language providers, and tree views |
| Tree explorer | `src/provider/treeDataProvider.ts`, `src/model/**` | Build and refresh the explorer hierarchy |
| Query | `src/service/queryUnit.ts`, `src/service/result/query.ts`, `src/service/page/**` | Run SQL/ES/Mongo queries, adapt results, and drive the result UI |
| Connections | `src/service/connectionManager.ts`, `src/service/connect/**`, `src/service/tunnel/**` | Connection lifecycle, tunnels, and typed driver creation |
| Webview shell | `src/common/viewManager.ts`, `src/vue/**` | Open and reuse panels, route `app` pages, and host the result grid UI |
| Infra | `src/common/state.ts`, `src/common/filesManager.ts`, `src/service/common/databaseCache.ts`, `src/common/global.ts` | Persistence, cache, temp/query files, and status bar state |

## 4. Runtime Component Diagram

```mermaid
flowchart TD
    subgraph Entry["Entry"]
        A["package.json"]
        B["src/extension.ts"]
    end

    subgraph Core["Core runtime"]
        C["ServiceManager"]
        D["DbTreeDataProvider"]
        E["ConnectionManager"]
        F["QueryUnit"]
        G["QueryPage"]
        H["ViewManager"]
    end

    subgraph Model["Node hierarchy"]
        I["Node base"]
        J["Connection / Schema / Table / Query / SSH / Redis / FTP / ES nodes"]
    end

    subgraph Vue["Webview apps"]
        K["src/vue/main.js<br/>app.html"]
        L["src/vue/result/main.js<br/>result.html"]
    end

    subgraph Infra["Infra"]
        M["GlobalState / WorkState"]
        N["DatabaseCache"]
        O["FileManager"]
        P["Global status bar"]
    end

    subgraph Backends["Typed backends"]
        Q["Mysql / PG / MSSQL / SQLite / ES / Mongo / Redis / FTP / Exasol"]
        R["SSH tunnel"]
    end

    A --> B
    B --> C
    B --> D
    B --> E
    B --> F
    C --> D
    D --> I
    I --> J
    J --> E
    J --> F
    F --> G
    G --> H
    H --> K
    H --> L
    D --> M
    D --> N
    F --> O
    E --> P
    E --> Q
    E --> R
```

## 5. Key Invariants

### 5.1 Node identity drives several systems

- `Node.getConnectId()` is the key for connection reuse.
- `Node.uid` is the key for child cache, collapse state, and the in-memory node cache.
- `Node.cacheSelf()` makes it possible to find the same logical node again via `uid` or `connectId`.

### 5.2 Connection config is serialized, then hydrated

- Connection definitions are stored in `globalState` and `workspaceState`.
- When the tree renders, `DbTreeDataProvider.getConnectionNodes()` reads serialized objects.
- `getNode()` maps those objects into `ConnectionNode`, `EsConnectionNode`, `RedisConnectionNode`, `SSHConnectionNode`, `FTPConnectionNode`, or `ConnectionNode` for SQL and MongoDB roots.

### 5.3 The query UI is interactive, not passive

- The result view does not just render data.
- It calls back into the backend for `execute`, `next`, `count`, `export`, and `saveModify`.
- Because of that, the query subsystem and webview subsystem are tightly coupled.

### 5.4 `app.html` is a multi-route shell

- A single `app.html` serves `connect`, `status`, `design`, `structDiff`, `redisStatus`, `terminal`, `forward`, and `sshTerminal`.
- The actual route is controlled by the backend through the `route` event.

## 6. Sequence: `mysql.runQuery`

This sequence describes the editor-driven command path.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant VS as VS Code
    participant EX as extension.ts
    participant CM as ConnectionManager
    participant QU as QueryUnit
    participant QP as QueryPage
    participant VM as ViewManager
    participant WV as result webview
    participant CON as typed connection

    U->>VS: Run "mysql.runQuery"
    VS->>EX: invoke registered command
    EX->>CM: tryGetConnection()
    EX->>QU: runQuery(sqlOrNull, activeNode)

    QU->>QU: Trans.begin()
    alt sql not provided
        QU->>VS: read activeTextEditor
        QU->>QU: getSqlFromEditor()
    end
    QU->>QU: strip comments + parse batch delimiter
    QU->>QP: send(RUN)
    QP->>VM: createWebviewPanel(path=result)
    VM-->>WV: open/reuse result panel
    QP-->>WV: postMessage RUN

    QU->>CM: getConnection(node)
    alt alive connection exists
        CM-->>QU: reuse existing connection
    else need new connection
        opt using SSH
            CM->>CM: create tunnel
        end
        CM->>CON: create typed connection by dbType
        CM->>CON: connect()
        CON-->>CM: connected
        CM-->>QU: connection
    end

    QU->>CON: query(sql)
    alt error
        QU->>QP: send(ERROR)
        QP-->>WV: postMessage ERROR
    else affectedRows
        QU->>VS: execute mysql.history.record
        QU->>QP: send(DML or DDL)
        QP-->>WV: postMessage DML/DDL
    else rowset
        QU->>VS: execute mysql.history.record
        QU->>QP: send(DATA)
        QP->>QP: adaptData() and enrich column metadata
        QP-->>WV: postMessage DATA
        WV-->>U: render grid
    else message block
        QU->>QP: send(MESSAGE_BLOCK)
        QP-->>WV: postMessage MESSAGE_BLOCK
    end
```

### Notes

- The command handler in `src/extension.ts` does not query directly; it delegates to `QueryUnit`.
- `QueryPage.send(RUN)` happens before the query returns so the result panel can enter a loading state.
- `QueryPage.adaptData()` contains DB-specific logic for ES, MongoDB, and SQL table metadata.

## 7. Sequence: `mysql.connection.add`

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant VS as VS Code
    participant EX as extension.ts
    participant CS as ConnectService
    participant VM as ViewManager
    participant APP as app webview / connect route
    participant CM as ConnectionManager
    participant TP as DbTreeDataProvider
    participant ST as globalState/workspaceState

    U->>VS: Run "mysql.connection.add"
    VS->>EX: invoke command
    EX->>CS: openConnect(provider)
    CS->>VM: createWebviewPanel(path=app, title=connect)
    VM-->>APP: open panel
    CS-->>APP: post route=connect
    APP-->>CS: route-connect
    CS-->>APP: connect + sqliteState

    U->>APP: fill form and click Connect
    APP-->>CS: connecting(connectionOption)
    CS->>CS: NodeUtil.of() + Util.trim()

    alt dbType == SSH
        CS->>CM: no normal DB connect
        CS->>CS: ClientManager.getSSH()
    else DB/NoSQL/remote
        CS->>CM: removeConnection(old connectId)
        CS->>CM: getConnection(node)
        CM-->>CS: connected
    end

    CS->>TP: addConnection(node)
    TP->>ST: update serialized node
    TP->>TP: refresh tree
    CS-->>APP: success(message, key, connectionKey)
    APP-->>U: show success state
```

### Notes

- The connect form runs in a webview, but the final state still lives in `globalState` and `workspaceState`.
- `provider.addConnection()` is the point where the connection is actually persisted.
- `mysql.connection.edit` follows the same flow, except `openConnect()` preloads the node and carries `isGlobal`.

## 8. Sequence: `mysql.table.design`

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant VS as VS Code
    participant EX as extension.ts
    participant TN as TableNode
    participant VM as ViewManager
    participant APP as app webview / design route
    participant CON as DB connection

    U->>VS: Context menu "mysql.table.design"
    VS->>EX: invoke command
    EX->>TN: designTable()
    TN->>VM: createWebviewPanel(path=app, title=Design Table)
    VM-->>APP: open panel
    TN-->>APP: post route=design
    APP-->>TN: route-design

    TN->>CON: showIndex(schema, table)
    TN->>CON: showColumns(schema, table)
    TN-->>APP: design-data(indexes, columns, table, comment, primaryKey, dbType)
    APP-->>U: render InfoPanel / ColumnPanel / IndexPanel

    alt rename table or update comment
        U->>APP: click Update in InfoPanel
        APP-->>TN: updateTable(newTableName, newComment)
        TN->>CON: execute dialect.updateTable(...)
        TN-->>APP: success or error
        TN->>TN: clear parent cache and reload provider
    else update column
        U->>APP: edit column
        APP-->>TN: updateColumn(...)
        TN->>CON: execute dialect.updateColumnSql(...)
        TN-->>APP: success or error
        TN->>TN: clear own cache and reload provider
    else create/drop index
        U->>APP: create or delete index
        APP-->>TN: createIndex(...) or dropIndex(...)
        TN->>CON: execute generated SQL
        TN-->>APP: success or error
    else raw execute
        U->>APP: create/drop column path emits execute(sql)
        APP-->>TN: execute(sql)
        TN->>CON: execute(sql)
        TN-->>APP: success or error
        TN->>TN: clear caches and reload provider
    end
```

### Notes

- The design page is an `app` route, not a standalone webview type.
- `TableNode.designTable()` is the backend controller for the entire page.
- The child Vue panels do not query directly; they emit events back to `TableNode`.

## 9. Ownership by Area

| Area | Primary owner in code |
| --- | --- |
| Command map | `src/extension.ts` |
| Tree hydration | `src/provider/treeDataProvider.ts` |
| Node identity and generic DB actions | `src/model/interface/node.ts` |
| Connection lifecycle | `src/service/connectionManager.ts` |
| Connect/edit config UI flow | `src/service/connect/connectService.ts` |
| Query orchestration | `src/service/queryUnit.ts` |
| Result adaptation and result webview backend | `src/service/result/query.ts` |
| Webview shell and reuse policy | `src/common/viewManager.ts` |
| App webview routing | `src/vue/main.js`, `src/vue/App.vue` |
| Result grid UI | `src/vue/result/App.vue` |

## 10. Hot Spots and Coupling

### Tight coupling

- `Node` is coupled to `vscode.TreeItem`, cache behavior, query execution, and terminal logic.
- `QueryPage` is coupled to the result webview protocol.
- `TableNode.designTable()` is coupled to SQL generation, execution, cache invalidation, and webview event handling.

### Hidden contracts

- `app.html` route protocol: the backend must emit `route`, and the frontend must emit `route-<name>`.
- `result.html` event contract: `RUN`, `DATA`, `NEXT_PAGE`, `COUNT`, `DML`, `ERROR`, and `MESSAGE`.
- Connection serialization contract: objects stored in state must be hydratable into valid `Node` subclasses.

## 11. Recommended Reading Order

1. `package.json`
2. `src/extension.ts`
3. `src/service/serviceManager.ts`
4. `src/provider/treeDataProvider.ts`
5. `src/model/interface/node.ts`
6. `src/service/connectionManager.ts`
7. `src/service/queryUnit.ts`
8. `src/service/result/query.ts`
9. `src/common/viewManager.ts`
10. `src/vue/main.js`
11. `src/vue/result/App.vue`

## 12. If You Need More Detail

- Query path: [deep-dive-query.md](deep-dive-query.md)
- Explorer path: [deep-dive-tree-explorer.md](deep-dive-tree-explorer.md)
- Webview path: [deep-dive-webview-app.md](deep-dive-webview-app.md)
