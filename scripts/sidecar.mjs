import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const exampleConfigPath = path.join(
  projectRoot,
  'examples',
  'connections.example.json'
);
const protocolVersion = '2025-03-26';
const serverInfo = {
  name: 'database-client',
  version: '0.1.0'
};

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function parseArgValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}

function firstPositionalArg(args) {
  const flagsWithValues = new Set(['--config', '--worktree-root']);

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (flagsWithValues.has(value)) {
      index += 1;
      continue;
    }

    if (!value.startsWith('--')) {
      return value;
    }
  }

  return null;
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function getConfigPathOption(input) {
  if (Array.isArray(input)) {
    return parseArgValue(input, '--config');
  }

  if (input && typeof input === 'object') {
    return input.config_path ?? input.configPath ?? null;
  }

  return null;
}

function getWorktreeRootOption(input) {
  if (Array.isArray(input)) {
    return parseArgValue(input, '--worktree-root');
  }

  if (input && typeof input === 'object') {
    return input.worktree_root ?? input.worktreeRoot ?? null;
  }

  return null;
}

function sanitizeConnection(connection) {
  const { password, passwordEnv, passphrase, secret, ...rest } = connection;

  return {
    ...rest,
    passwordConfigured: Boolean(password || passwordEnv),
    passwordEnv: passwordEnv ?? null
  };
}

function validateConfig(config, configPath) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Config at ${configPath} must be a JSON object.`);
  }

  if (!Array.isArray(config.connections)) {
    throw new Error(
      `Config at ${configPath} must contain a "connections" array.`
    );
  }

  for (const connection of config.connections) {
    if (!connection || typeof connection !== 'object') {
      throw new Error(`Each connection in ${configPath} must be an object.`);
    }

    if (typeof connection.id !== 'string' || connection.id.length === 0) {
      throw new Error(
        `Every connection in ${configPath} must define a non-empty "id".`
      );
    }

    if (
      typeof connection.driver !== 'string' ||
      connection.driver.length === 0
    ) {
      throw new Error(
        `Connection "${connection.id}" in ${configPath} must define "driver".`
      );
    }
  }
}

function resolveConfigPath(input) {
  const explicitConfig = getConfigPathOption(input);
  if (explicitConfig) {
    return path.resolve(projectRoot, explicitConfig);
  }

  if (process.env.DATABASE_CLIENT_CONFIG) {
    return path.resolve(process.env.DATABASE_CLIENT_CONFIG);
  }

  const worktreeRoot =
    getWorktreeRootOption(input) || process.env.DATABASE_CLIENT_WORKTREE_ROOT;
  if (worktreeRoot) {
    const candidates = [
      path.join(worktreeRoot, '.zed', 'database-client.connections.json'),
      path.join(worktreeRoot, '.database-client', 'connections.json'),
      path.join(worktreeRoot, 'database-client.connections.json')
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return exampleConfigPath;
}

function loadConfig(input) {
  const configPath = resolveConfigPath(input);
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  validateConfig(config, configPath);

  return {
    configPath,
    usingExampleConfig:
      path.resolve(configPath) === path.resolve(exampleConfigPath),
    config
  };
}

function listConnections(input) {
  const { configPath, usingExampleConfig, config } = loadConfig(input);

  return {
    configPath,
    usingExampleConfig,
    connectionCount: config.connections.length,
    connections: config.connections.map(sanitizeConnection)
  };
}

function findConnection(input, id) {
  const data = listConnections(input);
  const connection = data.connections.find((entry) => entry.id === id);

  if (!connection) {
    throw new Error(`Connection "${id}" was not found in ${data.configPath}.`);
  }

  return {
    configPath: data.configPath,
    usingExampleConfig: data.usingExampleConfig,
    connection
  };
}

function buildStatus(input) {
  const data = listConnections(input);
  const drivers = [
    ...new Set(data.connections.map((connection) => connection.driver))
  ];

  return {
    ...data,
    drivers,
    capabilities: {
      slashCommands: ['db-status', 'db-connections', 'db-describe'],
      mcpTools: [
        'db_status',
        'db_list_connections',
        'db_describe_connection',
        'db_run_query'
      ]
    },
    limitations: [
      'Database drivers are not wired yet.',
      'Query execution is scaffold-only.',
      'No custom Zed panel/tree UI exists in this scaffold.'
    ]
  };
}

function formatStatusText(status) {
  return [
    'Database Client Scaffold',
    `Config path: ${status.configPath}`,
    `Using example config: ${status.usingExampleConfig ? 'yes' : 'no'}`,
    `Connections: ${status.connectionCount}`,
    `Drivers: ${status.drivers.join(', ') || 'none'}`,
    `Slash commands: ${status.capabilities.slashCommands.join(', ')}`,
    `MCP tools: ${status.capabilities.mcpTools.join(', ')}`,
    'Limitations:',
    ...status.limitations.map((item) => `- ${item}`)
  ].join('\n');
}

function formatConnectionsText(data) {
  const lines = [
    `Config path: ${data.configPath}`,
    `Using example config: ${data.usingExampleConfig ? 'yes' : 'no'}`,
    `Connections (${data.connectionCount}):`
  ];

  for (const connection of data.connections) {
    lines.push(
      `- ${connection.id} [${connection.driver}] ${connection.host ?? 'n/a'}:${connection.port ?? 'n/a'} / ${connection.database ?? 'n/a'}`
    );
  }

  return lines.join('\n');
}

function formatDescribeText(data) {
  return JSON.stringify(data, null, 2);
}

function printResult(data, asJson, formatter) {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(formatter(data));
}

function toolDefinitions() {
  return [
    {
      name: 'db_status',
      description:
        'Show scaffold status, resolved config path, and current limitations.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          config_path: {
            type: 'string',
            description:
              'Optional absolute or project-relative path to a connection config file.'
          }
        }
      }
    },
    {
      name: 'db_list_connections',
      description:
        'List configured connection profiles from the resolved config file.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          config_path: {
            type: 'string',
            description:
              'Optional absolute or project-relative path to a connection config file.'
          }
        }
      }
    },
    {
      name: 'db_describe_connection',
      description: 'Describe one configured connection profile by id.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            description: 'Connection id from the config file.'
          },
          config_path: {
            type: 'string',
            description:
              'Optional absolute or project-relative path to a connection config file.'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'db_run_query',
      description: 'Reserved scaffold tool for future SQL execution.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            description: 'Connection id from the config file.'
          },
          sql: {
            type: 'string',
            description: 'SQL query to execute.'
          },
          config_path: {
            type: 'string',
            description:
              'Optional absolute or project-relative path to a connection config file.'
          }
        },
        required: ['id', 'sql']
      }
    }
  ];
}

function toolText(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function callTool(name, input) {
  switch (name) {
    case 'db_status': {
      const status = buildStatus(input);
      return {
        content: [{ type: 'text', text: formatStatusText(status) }],
        structuredContent: status
      };
    }
    case 'db_list_connections': {
      const result = listConnections(input);
      return {
        content: [{ type: 'text', text: formatConnectionsText(result) }],
        structuredContent: result
      };
    }
    case 'db_describe_connection': {
      const id = input?.id;
      if (typeof id !== 'string' || id.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'Tool db_describe_connection requires a non-empty "id".'
            }
          ],
          isError: true
        };
      }

      try {
        const result = findConnection(input, id);
        return {
          content: [{ type: 'text', text: toolText(result) }],
          structuredContent: result
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: error.message }],
          isError: true
        };
      }
    }
    case 'db_run_query':
      return {
        content: [
          {
            type: 'text',
            text: 'Query execution is not implemented yet. Wire a real driver adapter into the sidecar first.'
          }
        ],
        isError: true
      };
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true
      };
  }
}

function writeMessage(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8');
  process.stdout.write(Buffer.concat([header, body]));
}

function writeResult(id, result) {
  writeMessage({
    jsonrpc: '2.0',
    id,
    result
  });
}

function writeError(id, code, message) {
  writeMessage({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message
    }
  });
}

function mergeToolInput(cliArgs, toolArgs) {
  const input = toolArgs && typeof toolArgs === 'object' ? { ...toolArgs } : {};
  const configPath = getConfigPathOption(cliArgs);
  const worktreeRoot = getWorktreeRootOption(cliArgs);

  if (configPath && input.config_path == null && input.configPath == null) {
    input.config_path = configPath;
  }

  if (
    worktreeRoot &&
    input.worktree_root == null &&
    input.worktreeRoot == null
  ) {
    input.worktree_root = worktreeRoot;
  }

  return input;
}

function handleMcpRequest(message, cliArgs) {
  const { id, method, params } = message;

  if (method === 'initialize') {
    writeResult(id, {
      protocolVersion: protocolVersion,
      capabilities: {
        tools: {
          listChanged: false
        }
      },
      serverInfo: serverInfo
    });
    return;
  }

  if (method === 'notifications/initialized') {
    return;
  }

  if (method === 'ping') {
    writeResult(id, {});
    return;
  }

  if (method === 'tools/list') {
    writeResult(id, {
      tools: toolDefinitions()
    });
    return;
  }

  if (method === 'tools/call') {
    const name = params?.name;
    const toolInput = mergeToolInput(cliArgs, params?.arguments);
    writeResult(id, callTool(name, toolInput));
    return;
  }

  if (typeof id !== 'undefined') {
    writeError(id, -32601, `Method not found: ${method}`);
  }
}

function startMcpServer(args) {
  let buffer = Buffer.alloc(0);

  process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }

      const header = buffer.slice(0, headerEnd).toString('utf8');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        fail('Invalid MCP frame: missing Content-Length header.');
      }

      const contentLength = Number.parseInt(match[1], 10);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (buffer.length < messageEnd) {
        return;
      }

      const payload = buffer.slice(messageStart, messageEnd).toString('utf8');
      buffer = buffer.slice(messageEnd);

      let message;
      try {
        message = JSON.parse(payload);
      } catch (error) {
        writeError(null, -32700, `Parse error: ${error.message}`);
        continue;
      }

      handleMcpRequest(message, args);
    }
  });

  process.stdin.resume();
}

function main() {
  const [, , command, ...args] = process.argv;
  const asJson = hasFlag(args, '--json');

  try {
    switch (command) {
      case 'status':
        printResult(buildStatus(args), asJson, formatStatusText);
        return;
      case 'list-connections':
        printResult(listConnections(args), asJson, formatConnectionsText);
        return;
      case 'describe-connection': {
        const id = firstPositionalArg(args);
        if (!id) {
          fail('describe-connection requires a connection id.');
        }

        printResult(findConnection(args, id), asJson, formatDescribeText);
        return;
      }
      case 'serve-mcp':
        startMcpServer(args);
        return;
      case 'run-query':
        fail(
          'run-query is not implemented yet. Add a real DB adapter first.',
          2
        );
        return;
      default:
        fail(`Unknown command: ${command ?? '<none>'}`);
    }
  } catch (error) {
    fail(error.message);
  }
}

main();
