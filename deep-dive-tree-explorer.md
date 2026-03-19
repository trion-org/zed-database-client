# Deep Dive: Tree Explorer

This document goes deeper into the explorer subsystem: connection serialization, node hydration, identity, cache, refresh behavior, and the SQL/NoSQL branch structure.

## Main Files

| File | Role |
| --- | --- |
| `src/service/serviceManager.ts` | creates the two tree views |
| `src/provider/treeDataProvider.ts` | hydrates and refreshes the node tree |
| `src/model/interface/node.ts` | base node identity, execution, and cache hooks |
| `src/service/common/databaseCache.ts` | child cache, schema cache, and collapse state |
| `src/common/state.ts` | `globalState` / `workspaceState` wrapper |
| `src/model/database/connectionNode.ts` | SQL-style root connection node |
| `src/model/database/schemaNode.ts` | schema/database level node |

## 1. Two Trees, One Provider Class

The extension creates two tree views:

- `github.cweijan.mysql`
- `github.cweijan.nosql`

Both use `DbTreeDataProvider`, but with different `connectionKey` values:

- `mysql.connections`
- `redis.connections`

## 2. Tree Hydration Flow

```mermaid
flowchart TD
    A["ServiceManager.initTreeView/initTreeProvider"] --> B["new DbTreeDataProvider(context, connectionKey)"]
    B --> C["getChildren(undefined)"]
    C --> D["getConnectionNodes()"]
    D --> E["GlobalState.get(connectionKey)"]
    D --> F["WorkState.get(connectionKey)"]
    E --> G["getNode(serialized, key, global=true)"]
    F --> H["getNode(serialized, key, global=false)"]
    G --> I["hydrate Node subclass"]
    H --> I
    I --> J["provider returns TreeItem nodes"]
```

## 3. Which Class Gets Hydrated

`DbTreeDataProvider.getNode()` maps a serialized object into a class:

- `ES` -> `EsConnectionNode`
- `REDIS` -> `RedisConnectionNode`
- `SSH` -> `SSHConnectionNode`
- `FTP` -> `FTPConnectionNode`
- otherwise -> `ConnectionNode`

Important note:

- `MongoDB` currently goes through `ConnectionNode`; there is no dedicated `MongoConnectionNode` root class.
- From there, `SchemaNode` plus `MongoTableGroup` branches into the Mongo-specific subtree.

## 4. The Node Base Class Is the Backbone

`Node` in `src/model/interface/node.ts` does several jobs:

- extends `vscode.TreeItem`
- stores connection fields
- computes `uid`
- computes `connectId`
- executes queries through `execute()`
- caches itself through `cacheSelf()`
- exposes terminal integration

### Identity Rules

```mermaid
flowchart LR
    A["key"] --> D["getConnectId()"]
    B["host/port or ssh host/port"] --> D
    C["database/schema when relevant"] --> D
    D --> E["uid"]
    E --> F["DatabaseCache child cache"]
    E --> G["collapse state"]
    D --> H["ConnectionManager alive connection map"]
    D --> I["Node.nodeCache lookups"]
```

### Why It Matters

- A wrong `uid` means refresh and cache behavior will target the wrong node.
- A wrong `connectId` means connections may be reused incorrectly or active state may be lost.

## 5. SQL-style Explorer Branch

```mermaid
flowchart TD
    Conn["ConnectionNode"] --> Schema["SchemaNode"]
    Conn --> Catalog["CatalogNode for PG/MSSQL"]
    Conn --> UserGroup["UserGroup optional"]

    Catalog --> Schema2["SchemaNode"]

    Schema --> TableGroup["TableGroup"]
    Schema --> ViewGroup["ViewGroup"]
    Schema --> QueryGroup["QueryGroup"]
    Schema --> ProcedureGroup["ProcedureGroup"]
    Schema --> FunctionGroup["FunctionGroup"]
    Schema --> TriggerGroup["TriggerGroup"]

    TableGroup --> Table["TableNode"]
    Table --> Column["ColumnNode"]
```

### Notes

- `ConnectionNode.getChildren()` loads the schema/database list and caches it in `DatabaseCache`.
- `SchemaNode.getChildren()` does not query the DB; it only creates group nodes based on settings.
- `TableGroup.getChildren()` is where the actual table list query runs.
- `TableNode.getChildren()` queries columns.

## 6. NoSQL and Remote Branch

```mermaid
flowchart TD
    EsConn["EsConnectionNode"] --> EsIndexGroup["EsIndexGroup"]
    EsConn --> EsQueryGroup["QueryGroup"]
    EsIndexGroup --> EsIndex["ESIndexNode"]
    EsIndex --> EsColumn["EsColumnNode"]

    RedisConn["RedisConnectionNode"] --> RedisFolder["RedisFolderNode"]
    RedisFolder --> RedisKey["KeyNode"]

    SSHConn["SSHConnectionNode"] --> SSHFolder["SSHConnectionNode folder"]
    SSHConn --> SSHFile["FileNode"]
    SSHConn --> SSHLink["LinkNode"]

    FTPConn["FTPConnectionNode"] --> FTPFolder["FTPConnectionNode folder"]
    FTPConn --> FTPFile["FTPFileNode"]

    MongoConn["ConnectionNode dbType=MongoDB"] --> MongoSchema["SchemaNode"]
    MongoSchema --> MongoTableGroup["MongoTableGroup"]
    MongoTableGroup --> MongoTable["MongoTableNode"]
```

## 7. Lazy Loading and Timeout Behavior

`DbTreeDataProvider.getChildren(element)` does the following:

1. Starts a timeout timer.
2. Awaits `element.getChildren()`.
3. If the timeout wins, returns `InfoNode("Connect time out!")`.
4. If the call finishes in time, assigns `parent` to each child and returns the list.

Implications:

- The tree layer has its timeout guard directly in the provider, not in the driver layer.
- If the request finishes after timeout, the provider calls `reload(element)` so the tree can try again.

## 8. Cache Layers

### 8.1 Persisted state

- Connection definitions: `globalState` + `workspaceState`
- Collapse state: persisted separately through `DatabaseCache.storeElementState()`

### 8.2 In-memory state

- `DatabaseCache.cache.database`: schema list per connection
- `DatabaseCache.childCache`: child list per node uid
- `Node.nodeCache`: lookup by `connectId` or `uid`
- `ConnectionManager.activeNode`

### 8.3 Refresh rules

```mermaid
flowchart TD
    A["Node change"] --> B{"What changed?"}
    B -->|connection config| C["node.indent(add/update/delete)"]
    B -->|schema/table content| D["clear child/schema cache"]
    B -->|active selection| E["ConnectionManager.changeActive()"]

    C --> F["DbTreeDataProvider.refresh()"]
    D --> F
    E --> F
```

## 9. Active Database / Active Connection

Explorer active state does not live in the tree provider.

- `ConnectionManager.activeNode` is the source of truth.
- `Global.updateStatusBarItems(activeNode)` updates the status bar text.
- When the active editor changes, `detectActive()` can reconstruct the node from a file path of the form `key@@host@port@db@schema`.

Implication:

- Query files in `globalStoragePath` carry active-connection metadata in the path itself.

## 10. Connection Persistence Flow

```mermaid
sequenceDiagram
    autonumber
    participant UI as connect webview
    participant CS as ConnectService
    participant TP as DbTreeDataProvider
    participant N as Node.indent()
    participant ST as globalState/workspaceState

    UI->>CS: connecting(connectionOption)
    CS->>TP: addConnection(node)
    TP->>TP: choose connectionKey by dbType
    TP->>N: indent(add/update/delete)
    N->>ST: update serialized object map
    N-->>TP: done
    TP->>TP: refresh all instances
```

## 11. Typical Expand Flow

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant VS as VS Code tree
    participant TP as DbTreeDataProvider
    participant N as current node
    participant DC as DatabaseCache

    U->>VS: expand node
    VS->>TP: getChildren(node)
    TP->>N: getChildren()
    alt cache hit
        N->>DC: read child cache
        N-->>TP: cached children
    else cache miss
        N->>N: execute DB/remote call
        N->>DC: write child cache
        N-->>TP: fresh children
    end
    TP-->>VS: render child nodes
```

## 12. Hot Spots

- `Node` is an abstract base class, but it still owns a lot of concrete behavior.
- MongoDB reuses `ConnectionNode` as its root, which is easy to misread when scanning quickly.
- `DatabaseCache.storeElementState()` has separate global and workspace branches, which matters when debugging expand/collapse behavior.
- Refresh is broad: `DbTreeDataProvider.refresh()` fires for all provider instances.

## 13. Read This Area In Order

1. `src/provider/treeDataProvider.ts`
2. `src/model/interface/node.ts`
3. `src/service/common/databaseCache.ts`
4. `src/model/database/connectionNode.ts`
5. `src/model/database/schemaNode.ts`
6. `src/model/main/tableGroup.ts`
7. `src/model/main/tableNode.ts`
8. `src/model/es/model/esConnectionNode.ts`
9. `src/model/redis/redisConnectionNode.ts`
10. `src/model/ssh/sshConnectionNode.ts`
11. `src/model/ftp/ftpConnectionNode.ts`
