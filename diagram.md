# Current Extension Diagrams

Doc nay giu vai tro quick overview.

## Related Docs

- [architecture.md](architecture.md): ban kien truc day du hon, co module boundaries va sequence diagram cho command quan trong.
- [deep-dive-query.md](deep-dive-query.md): di sau vao query pipeline.
- [deep-dive-tree-explorer.md](deep-dive-tree-explorer.md): di sau vao tree explorer, node identity, cache, refresh.
- [deep-dive-webview-app.md](deep-dive-webview-app.md): di sau vao `app.html`, `result.html`, `ViewManager`, va message bus.

Tai lieu nay tom tat kien truc hien tai cua extension theo code trong repo. Muc tieu la giup ban doc nhanh cac luong chinh, sau do di vao file code dung diem.

## Scope

- Entry point va activation
- Runtime architecture
- Tree explorer structure
- Query execution flow
- Webview routing and message bus
- State, cache, va file persistence

## Key Files

| File | Vai tro |
| --- | --- |
| [package.json](package.json) | activation events, views, commands, grammars, menus |
| [src/extension.ts](src/extension.ts) | entry point, command wiring |
| [src/service/serviceManager.ts](src/service/serviceManager.ts) | composition root cho services, language providers, tree views |
| [src/provider/treeDataProvider.ts](src/provider/treeDataProvider.ts) | tree provider cho `Database` va `NoSQL` views |
| [src/model/interface/node.ts](src/model/interface/node.ts) | base class cho almost all nodes, identity, execute, terminal |
| [src/service/connectionManager.ts](src/service/connectionManager.ts) | connection lifecycle, active node, SSH tunnel, typed connection creation |
| [src/service/queryUnit.ts](src/service/queryUnit.ts) | query execution from editor/table actions |
| [src/service/result/query.ts](src/service/result/query.ts) | adapt result va push vao result webview |
| [src/common/viewManager.ts](src/common/viewManager.ts) | generic webview creation, singleton page logic, message bridge |
| [src/service/connect/connectService.ts](src/service/connect/connectService.ts) | connect/edit config UI flow |
| [src/common/state.ts](src/common/state.ts) | wrapper cho `globalState` va `workspaceState` |
| [src/common/filesManager.ts](src/common/filesManager.ts) | query/config/temp file persistence trong `globalStoragePath` |
| [src/service/common/databaseCache.ts](src/service/common/databaseCache.ts) | memory cache cho schema tree va collapse state |
| [src/vue/main.js](src/vue/main.js) | Vue router cho `app.html` |
| [src/vue/result/main.js](src/vue/result/main.js) | Vue entry cho `result.html` |

## 1. Activation Overview

```mermaid
flowchart TD
    A["VS Code activation events<br/>package.json"] --> B["activate(context)<br/>src/extension.ts"]

    B --> C["new ServiceManager(context)"]
    C --> C1["Global.context = context"]
    C --> C2["DatabaseCache.initCache()"]
    C --> C3["ViewManager.initExtesnsionPath()"]
    C --> C4["FileManager.init()"]
    C --> C5["new ConnectionProvider()"]

    B --> D["activeEs(context)"]
    B --> E["ConnectionNode.init()"]
    B --> F["serviceManager.init()"]
    B --> G["ConnectService.listenConfig()"]
    B --> H["window.onDidChangeActiveTextEditor(detectActive)"]
    B --> I["initCommand(commandDefinition)"]

    F --> F1["register SQL formatting provider"]
    F --> F2["register SQL CodeLens provider"]
    F --> F3["register SQL document symbol provider"]
    F --> F4["register SQL hover provider"]
    F --> F5["register SQL completion provider"]
    F --> F6["create Database tree view"]
    F --> F7["create NoSQL tree view"]
    F --> F8["init settingService / statusService / mockRunner"]

    D --> D1["register ES completion provider"]
    D --> D2["register ES CodeLens provider"]
    D --> D3["register ES commands"]

    I --> I1["70 command handlers bound to services/nodes"]
    H --> H1["detectActive()"]
    H1 --> H2["ConnectionManager.changeActive(file node)"]
```

### Read This As

- `activate()` chi wiring va bootstrap.
- `ServiceManager` la composition root nho nhat cua runtime.
- `extension.ts` la noi tap trung gan command string vao methods tren node/service.

## 2. Runtime Architecture

```mermaid
flowchart LR
    subgraph VSCode["VS Code Surface"]
        V1["Activity Bar views"]
        V2["Command palette / context menus"]
        V3["SQL / ES editor"]
        V4["Webview panels"]
        V5["Status bar"]
    end

    subgraph Core["Extension Core"]
        X1["extension.ts"]
        X2["ServiceManager"]
        X3["DbTreeDataProvider"]
        X4["ConnectionManager"]
        X5["QueryUnit"]
        X6["ViewManager"]
    end

    subgraph Nodes["Node Model Layer"]
        N1["Node base class"]
        N2["ConnectionNode / EsConnectionNode / RedisConnectionNode"]
        N3["SchemaNode / groups / table nodes / file nodes"]
    end

    subgraph Services["Service Layer"]
        S1["connect"]
        S2["status"]
        S3["dump / import / export"]
        S4["mock"]
        S5["page / dialect"]
        S6["ssh tunnel / terminal / forward"]
    end

    subgraph Infra["Infra and Storage"]
        I1["GlobalState / WorkState"]
        I2["DatabaseCache"]
        I3["FileManager"]
        I4["Driver connections"]
    end

    subgraph Drivers["Typed backends"]
        D1["MysqlConnection"]
        D2["PostgreSqlConnection"]
        D3["MSSqlConnection"]
        D4["SqliteConnection"]
        D5["EsConnection"]
        D6["MongoConnection"]
        D7["RedisConnection"]
        D8["FTPConnection"]
        D9["ExasolConnection"]
        D10["SSHTunnelService"]
    end

    V1 --> X3
    V2 --> X1
    V3 --> X5
    V4 --> X6
    V5 --> X4

    X1 --> X2
    X1 --> X4
    X1 --> X5
    X1 --> X6
    X2 --> X3
    X3 --> N2
    N2 --> N3
    N1 --> X4
    N1 --> X5
    X4 --> S5
    X4 --> D10
    X5 --> X4
    X6 --> S1
    X6 --> S2
    X6 --> S3
    X6 --> S6

    X3 --> I1
    X3 --> I2
    X5 --> I3
    X4 --> I4

    I4 --> D1
    I4 --> D2
    I4 --> D3
    I4 --> D4
    I4 --> D5
    I4 --> D6
    I4 --> D7
    I4 --> D8
    I4 --> D9
```

### Main Idea

- Extension nay khong chi la syntax helper. No la mot ung dung nho ben trong VS Code.
- `Node` layer la domain + UI hybrid, vi `Node` ke thua `vscode.TreeItem`.
- `ViewManager` la bridge chung cho gan nhu toan bo webview pages.

## 3. Explorer Tree Structure

```mermaid
flowchart TD
    Root["Activity Bar"] --> DBView["Database view<br/>github.cweijan.mysql"]
    Root --> NoSQLView["NoSQL view<br/>github.cweijan.nosql"]

    DBView --> DBProvider["DbTreeDataProvider<br/>mysql.connections"]
    NoSQLView --> NoSQLProvider["DbTreeDataProvider<br/>redis.connections"]

    subgraph SQLTree["SQL-style tree"]
        DBProvider --> Conn["ConnectionNode"]
        Conn --> Cat["CatalogNode<br/>PG / MSSQL only"]
        Conn --> Schema["SchemaNode"]
        Conn --> UserGroup["UserGroup"]

        Cat --> SchemaFromCat["SchemaNode"]

        Schema --> TableGroup["TableGroup"]
        Schema --> ViewGroup["ViewGroup"]
        Schema --> QueryGroup["QueryGroup"]
        Schema --> ProcGroup["ProcedureGroup"]
        Schema --> FuncGroup["FunctionGroup"]
        Schema --> TriggerGroup["TriggerGroup"]

        TableGroup --> Table["TableNode"]
        Table --> Column["ColumnNode"]

        ViewGroup --> View["ViewNode"]
        QueryGroup --> Query["QueryNode"]
        ProcGroup --> Proc["ProcedureNode"]
        FuncGroup --> Func["FunctionNode"]
        TriggerGroup --> Trigger["TriggerNode"]
    end

    subgraph NoSQLTree["NoSQL and remote tree"]
        NoSQLProvider --> MongoConn["ConnectionNode<br/>MongoDB reuses SQL connection node"]
        MongoConn --> MongoSchema["SchemaNode"]
        MongoSchema --> MongoGroup["MongoTableGroup"]
        MongoGroup --> MongoTable["MongoTableNode"]

        NoSQLProvider --> ESConn["EsConnectionNode"]
        ESConn --> ESIndexGroup["EsIndexGroup"]
        ESConn --> ESQueryGroup["QueryGroup"]
        ESIndexGroup --> ESIndex["ESIndexNode"]
        ESIndex --> ESColumn["EsColumnNode"]

        NoSQLProvider --> RedisConn["RedisConnectionNode"]
        RedisConn --> RedisFolder["RedisFolderNode"]
        RedisFolder --> RedisKey["KeyNode"]

        NoSQLProvider --> SSHConn["SSHConnectionNode"]
        SSHConn --> SSHFolder["SSHConnectionNode as folder"]
        SSHConn --> SSHFile["FileNode"]
        SSHConn --> SSHLink["LinkNode"]

        NoSQLProvider --> FTPConn["FTPConnectionNode"]
        FTPConn --> FTPFolder["FTPConnectionNode as folder"]
        FTPConn --> FTPFile["FTPFileNode"]
    end
```

### Notes

- `DbTreeDataProvider.getNode()` quyet dinh serialized connection se hydrate thanh node class nao.
- MongoDB di vao `NoSQL` view, nhung van reuse `ConnectionNode` va `SchemaNode`.
- Tree data la lazy-loaded qua `getChildren()` tren tung node.

## 4. Query Execution Flow

```mermaid
flowchart TD
    A["User action"] --> A1["Run from SQL editor"]
    A --> A2["Run from table node"]
    A --> A3["Run from query node"]
    A --> A4["Run from ES CodeLens"]

    A1 --> B["mysql.runQuery / mysql.runAllQuery"]
    A2 --> B
    A3 --> B
    A4 --> B

    B --> C["QueryUnit.runQuery()"]
    C --> C1["Resolve active connection node"]
    C --> C2["Get SQL from editor or provided SQL"]
    C --> C3["DelimiterHolder.parseBatch()"]
    C --> D["QueryPage.send(RUN)"]

    C --> E["ConnectionManager.getConnection(node)"]
    E --> E1["Reuse alive connection if possible"]
    E --> E2["Create SSH tunnel if needed"]
    E --> E3["Instantiate typed connection by dbType"]
    E3 --> E4["connect()"]

    E4 --> F["driver.query(sql)"]
    F --> G{"Query result type"}

    G -->|data rows| H["QueryPage.send(DATA)"]
    G -->|affectedRows| I["QueryPage.send(DML/DDL)"]
    G -->|message block| J["QueryPage.send(MESSAGE_BLOCK)"]
    G -->|error| K["QueryPage.send(ERROR)"]

    D --> R["ViewManager.createWebviewPanel(path=result)"]
    H --> R
    I --> R
    J --> R
    K --> R

    R --> UI["src/vue/result/App.vue"]
    UI --> UI1["render rows / pagination / edit dialog / export dialog"]

    UI -->|execute| C
    UI -->|next page| P["PageService.build() + dbOption.execute()"]
    UI -->|count| Q["dbOption.execute(count SQL)"]
    UI -->|export| X["ExportService.export()"]
    UI -->|saveModify| Y["dbOption.execute(update SQL)"]
```

### Important Details

- `QueryUnit` vua lo editor integration, vua lo query orchestration.
- `QueryPage` vua adapt result, vua la backend handler cho result webview.
- Result webview khong chi hien thi; no con goi nguoc lai backend de paging, export, save row edits.

## 5. Webview Routing and Message Bus

```mermaid
flowchart LR
    subgraph Backend["Extension backend"]
        B1["Service or Node method"]
        B2["ViewManager.createWebviewPanel(path=app or result)"]
        B3["Handler.on(event)"]
        B4["Handler.emit(event, payload)"]
    end

    subgraph AppWebview["app.html -> Vue router"]
        A1["src/vue/main.js"]
        A2["src/vue/App.vue"]
        A3["Routes:<br/>connect<br/>status<br/>design<br/>structDiff<br/>keyView<br/>terminal<br/>redisStatus<br/>forward<br/>sshTerminal"]
    end

    subgraph ResultWebview["result.html"]
        R1["src/vue/result/main.js"]
        R2["src/vue/result/App.vue"]
    end

    subgraph Bridge["postMessage bridge"]
        G1["window.postMessage from backend"]
        G2["acquireVsCodeApi().postMessage from webview"]
        G3["src/vue/util/vscode.js"]
    end

    B1 --> B2
    B2 --> B3
    B3 --> B4
    B4 --> G1
    G1 --> G3
    G3 --> A1
    G3 --> R1

    A1 --> A2
    A2 --> A3

    A3 -->|user action| G2
    R2 -->|user action| G2
    G2 --> B3
```

### Typical `app` Webview Pattern

1. Backend mo panel voi `path: "app"`.
2. Backend emit `route = connect` hoac `route = status`.
3. Vue router chuyen sang component tuong ung.
4. Component gui action lai backend bang `postMessage`.
5. Backend service xu ly va emit data/state tro lai.

### Typical `result` Webview Pattern

1. Backend mo panel voi `path: "result"`.
2. `QueryPage.send()` emit `RUN`, `DATA`, `ERROR`, ...
3. Result app cap nhat grid, toolbar, export, pagination, row edit state.

## 6. State, Cache, and Persistence

```mermaid
flowchart TD
    A["Connection definitions"] --> B["GlobalState / WorkState"]
    B --> B1["mysql.connections"]
    B --> B2["redis.connections"]

    C["Tree collapse state"] --> D["DatabaseCache + persisted collapse state"]
    D --> D1["globalState"]
    D --> D2["workspaceState"]

    E["Runtime schema/table cache"] --> F["DatabaseCache.memory"]
    F --> F1["schema list per connection"]
    F --> F2["child nodes per uid"]

    G["Temporary and generated files"] --> H["FileManager"]
    H --> H1["globalStoragePath/query files"]
    H --> H2["globalStoragePath/config.json"]
    H --> H3["globalStoragePath/temp/..."]

    I["Remote SSH file editing"] --> J["ConnectionProvider.tempRemoteMap"]
    J --> K["workspace.onDidSaveTextDocument"]
    K --> L["sftp.fastPut(temp local -> remote path)"]

    M["Active connection"] --> N["ConnectionManager.activeNode"]
    N --> O["Global status bar text"]
```

### What Lives Where

- Connection config song song ton tai trong `globalState` va `workspaceState`.
- Tree cache va child cache mostly la in-memory.
- Query/template/config files duoc ghi ra `context.globalStoragePath`.
- SSH remote edit dung local temp file, roi upload lai khi save.

## 7. Connect and Config Flow

```mermaid
flowchart TD
    A["User clicks Add/Edit Connection"] --> B["mysql.connection.add / mysql.connection.edit"]
    B --> C["ConnectService.openConnect(provider, connectionNode?)"]
    C --> D["ViewManager.createWebviewPanel(path=app, route=connect)"]
    D --> E["connect UI emits connecting"]
    E --> F["NodeUtil.of + Util.trim"]
    F --> G["ConnectService.connect(node)"]
    G --> H{"dbType == SSH ?"}
    H -->|yes| I["ClientManager.getSSH()"]
    H -->|no| J["ConnectionManager.removeConnection(old)"]
    J --> K["ConnectionManager.getConnection(new)"]
    I --> L["provider.addConnection(node)"]
    K --> L
    L --> M["node.indent(add/update)"]
    M --> N["globalState/workspaceState updated"]
    N --> O["DbTreeDataProvider.refresh()"]
```

## 8. Mental Model

Doc extension nay nhanh nhat theo thu tu sau:

1. [src/extension.ts](src/extension.ts)
2. [src/service/serviceManager.ts](src/service/serviceManager.ts)
3. [src/provider/treeDataProvider.ts](src/provider/treeDataProvider.ts)
4. [src/model/interface/node.ts](src/model/interface/node.ts)
5. [src/service/connectionManager.ts](src/service/connectionManager.ts)
6. [src/service/queryUnit.ts](src/service/queryUnit.ts)
7. [src/service/result/query.ts](src/service/result/query.ts)
8. [src/common/viewManager.ts](src/common/viewManager.ts)
9. [src/vue/main.js](src/vue/main.js) va [src/vue/result/App.vue](src/vue/result/App.vue)

## 9. Short Summary

- `extension.ts` la command registry.
- `ServiceManager` la bootstrap layer.
- `DbTreeDataProvider` + `Node` hierarchy la explorer app.
- `ConnectionManager` la session/runtime connection layer.
- `QueryUnit` + `QueryPage` la data execution layer.
- `ViewManager` + Vue apps la UI shell ben trong webview.
- `GlobalState`, `WorkState`, `DatabaseCache`, `FileManager` la persistence/cache layer.
