use zed_extension_api::process::Command as ProcessCommand;
use zed_extension_api::settings::ContextServerSettings;
use zed_extension_api::{
    self as zed, ContextServerConfiguration, ContextServerId, Project, SlashCommand,
    SlashCommandOutput, SlashCommandOutputSection, Worktree,
};

struct DatabaseClientExtension;

impl DatabaseClientExtension {
    fn render_slash_output(label: &str, text: String) -> Result<SlashCommandOutput, String> {
        Ok(SlashCommandOutput {
            sections: vec![SlashCommandOutputSection {
                range: (0..text.len()).into(),
                label: label.to_string(),
            }],
            text,
        })
    }

    fn sidecar_cli_args(
        command: &str,
        worktree: Option<&Worktree>,
        extra: &[String],
    ) -> Vec<String> {
        let mut args = vec!["scripts/sidecar.mjs".to_string(), command.to_string()];
        if let Some(worktree) = worktree {
            args.push("--worktree-root".to_string());
            args.push(worktree.root_path());
        }
        args.extend(extra.iter().cloned());
        args
    }

    fn run_sidecar(
        command: &str,
        worktree: Option<&Worktree>,
        extra: &[String],
    ) -> Result<String, String> {
        let args = Self::sidecar_cli_args(command, worktree, extra);
        let mut process = ProcessCommand::new("node").args(args);
        let output = process.output()?;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        match output.status {
            Some(0) => Ok(stdout),
            Some(code) => Err(format!("sidecar exited with status {code}: {stderr}")),
            None => Err(format!("sidecar terminated unexpectedly: {stderr}")),
        }
    }

    fn context_server_config_path(
        project: &Project,
        context_server_id: &ContextServerId,
    ) -> Result<Option<String>, String> {
        let settings = ContextServerSettings::for_project(context_server_id.as_ref(), project)?;
        let Some(value) = settings.settings else {
            return Ok(None);
        };

        Ok(value
            .get("config_path")
            .and_then(|value| value.as_str())
            .map(ToString::to_string))
    }

    fn context_server_settings_schema() -> String {
        zed::serde_json::json!({
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "config_path": {
                    "type": "string",
                    "description": "Absolute path to a database-client connection config JSON file."
                }
            }
        })
        .to_string()
    }

    fn context_server_default_settings() -> String {
        zed::serde_json::json!({
            "config_path": "/absolute/path/to/database-client.connections.json"
        })
        .to_string()
    }

    fn context_server_installation_instructions() -> String {
        [
            "# Database Client setup",
            "",
            "1. Create a connection config JSON file.",
            "2. Prefer environment-variable references such as `passwordEnv` instead of raw passwords.",
            "3. Point the extension at that file with:",
            "",
            "```json",
            "{",
            "  \"context_servers\": {",
            "    \"database-client\": {",
            "      \"settings\": {",
            "        \"config_path\": \"/absolute/path/to/database-client.connections.json\"",
            "      }",
            "    }",
            "  }",
            "}",
            "```",
            "",
            "For slash commands outside MCP, the sidecar also looks for workspace-local files such as `.zed/database-client.connections.json`."
        ]
        .join("\n")
    }
}

impl zed::Extension for DatabaseClientExtension {
    fn new() -> Self {
        Self
    }

    fn run_slash_command(
        &self,
        command: SlashCommand,
        args: Vec<String>,
        worktree: Option<&Worktree>,
    ) -> Result<SlashCommandOutput, String> {
        match command.name.as_str() {
            "db-status" => {
                let text = Self::run_sidecar("status", worktree, &[])?;
                Self::render_slash_output("Database Client Status", text)
            }
            "db-connections" => {
                let text = Self::run_sidecar("list-connections", worktree, &[])?;
                Self::render_slash_output("Database Connections", text)
            }
            "db-describe" => {
                let Some(connection_id) = args.first() else {
                    return Err("db-describe requires a connection id".to_string());
                };
                let text =
                    Self::run_sidecar("describe-connection", worktree, &[connection_id.clone()])?;
                Self::render_slash_output("Database Connection", text)
            }
            other => Err(format!("unknown slash command: {other}")),
        }
    }

    fn context_server_command(
        &mut self,
        context_server_id: &ContextServerId,
        project: &Project,
    ) -> Result<zed::Command, String> {
        let mut env = Vec::new();
        if let Some(config_path) = Self::context_server_config_path(project, context_server_id)? {
            env.push(("DATABASE_CLIENT_CONFIG".to_string(), config_path));
        }

        Ok(zed::Command {
            command: "node".to_string(),
            args: vec!["scripts/sidecar.mjs".to_string(), "serve-mcp".to_string()],
            env,
        })
    }

    fn context_server_configuration(
        &mut self,
        context_server_id: &ContextServerId,
        _project: &Project,
    ) -> Result<Option<ContextServerConfiguration>, String> {
        if context_server_id.as_ref() != "database-client" {
            return Ok(None);
        }

        Ok(Some(ContextServerConfiguration {
            installation_instructions: Self::context_server_installation_instructions(),
            settings_schema: Self::context_server_settings_schema(),
            default_settings: Self::context_server_default_settings(),
        }))
    }
}

zed::register_extension!(DatabaseClientExtension);
