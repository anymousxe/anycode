# AnyCode

A terminal-based AI coding agent with persistent memory, custom modes, and autonomous capabilities. Based on [OpenCode](https://github.com/anomalyco/opencode).

## Install

### One-liner (Windows CMD)

```
curl -fsSL https://raw.githubusercontent.com/anymousxe/anycode/main/install.bat -o install.bat && install.bat
```

### One-liner (Windows PowerShell)

```
iwr -useb https://raw.githubusercontent.com/anymousxe/anycode/main/install.bat -outf install.bat; ./install.bat
```

### One-liner (macOS / Linux)

```
curl -fsSL https://raw.githubusercontent.com/anymousxe/anycode/main/install.sh | bash
```

### Scoop

```
scoop install anycode
```

### Winget

```
winget install anycode
```

### Build from source

Requires [Bun](https://bun.sh).

```
git clone https://github.com/anymousxe/anycode.git
cd anycode
bun install
cd packages/opencode
bun run script/build.ts --single
```

Binary at `packages/opencode/dist/anycode-windows-x64/bin/anycode.exe` — copy it anywhere in your PATH.

## Features

- **Terminal TUI** — Full interactive terminal UI with chat history, file diffs, and tool output
- **Persistent Memory** — The AI remembers things about you across all conversations. It saves preferences, project details, and personal context automatically
- **Custom System Prompt** — Use `/prompt` to set instructions the AI always follows (e.g. "respond concisely", "always use TypeScript")
- **Multiple Agent Modes** — Switch between modes with Tab:
  - **Build** — Default, full-access coding agent
  - **Plan** — Read-only mode for analysis and planning
  - **Agent** — Autonomous mode with memory and proactive tool use (green)
  - **Coding** — Minimal mode, concise code-only responses (amber, hidden by default)
- **Toggle Modes** — Click ⚙ Settings at the bottom of the sidebar to toggle which modes appear on Tab
- **Skills** — Extend capabilities with custom skills in `~/.config/anycode/skills/`
- **Memories** — View stored memories with `/memory`. The AI uses them across all chats

## Key Commands

| Command | What it does |
|---------|-------------|
| `Tab` | Cycle between enabled agent modes |
| `/memory` | View all stored memories |
| `/prompt` | Set or edit your custom system prompt |
| `/skills` | List available skills |
| `/share` | Share current session |
| `Ctrl+C` | Abort current AI response |
| `Esc` | Close dialog / go back |

## Custom Providers (OpenAI-compatible)

Add any OpenAI-compatible endpoint (local models, proxies, custom deployments) to `~/.config/anycode/opencode.json`:

```json
{
  "provider": {
    "my-custom": {
      "name": "My Custom Endpoint",
      "env": ["MY_CUSTOM_API_KEY"],
      "options": {
        "baseURL": "https://your-endpoint.com/v1",
        "apiKey": "sk-xxx"
      },
      "models": {
        "gpt-5.4": {
          "name": "GPT 5.4",
          "tool_call": true,
          "temperature": true,
          "limit": { "context": 128000, "output": 16384 }
        }
      }
    }
  }
}
```

Then select it in the model picker (`Ctrl+X M` or type `@my-custom:gpt-5.4` in the prompt).

## Config

Config files live in `~/.config/anycode/`:

- `tui.json` — Keybinds and theme settings
- `opencode.json` — Providers, models, and agent configuration
- `memory.json` — Stored memories (auto-managed)

## License

MIT
