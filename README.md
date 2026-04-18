# MCP Weather Agent (with New Relic)

> **Live demo (mock):** https://sunilbittu.github.io/mcp-to-mcp-exp/
> A static, in-browser mock of the agent flow — no Node, no API keys, canned
> data. The full app below is the real thing.

A small demo of an **AI agent driving an MCP server**. Ask "how's the weather
in Hyderabad?" in plain English and the agent:

1. Calls the MCP tool `get_city_info` to geocode the city.
2. Calls `get_weather` with the returned coordinates.
3. Renders a glassmorphism weather card in the browser.

Everything is **instrumented with New Relic** — the HTTP request, the agent
loop, every LLM call, and every MCP tool call show up as nested segments in
the same distributed trace, plus custom events (`MCPToolCall`, `AgentLLMCall`)
for dashboards.

```
Browser ──▶ Express ──▶ Claude agent ──▶ MCP client ──stdio──▶ Weather MCP server
                              │                                       │
                              │                                       ├─ get_city_info  (Open-Meteo Geocoding)
                              │                                       └─ get_weather    (Open-Meteo Forecast)
                              ▼
                          New Relic
```

## What's open-source / keyless

| Piece | Provider | API key? |
| --- | --- | --- |
| Geocoding | [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api) | No |
| Weather   | [Open-Meteo](https://open-meteo.com/en/docs)                | No |
| MCP SDK   | `@modelcontextprotocol/sdk`                                 | — |
| AI agent  | Claude (Anthropic SDK)                                      | Yes (`ANTHROPIC_API_KEY`) |
| APM       | New Relic Node.js agent                                     | Yes (`NEW_RELIC_LICENSE_KEY`) |

The two data services are fully free and require no key. The only required
keys are for the orchestrating LLM and the APM backend.

## Project layout

```
src/
├── mcp-server/server.js     # MCP server (stdio): get_city_info, get_weather
├── host/
│   ├── app.js               # Express entry, /api/query
│   ├── agent.js             # Claude tool-use loop
│   ├── mcp-client.js        # Spawns the MCP server, wraps each tool call
│   └── telemetry.js         # New Relic helpers (segments, events, errors)
└── public/                  # UI (HTML/CSS/JS) — the weather card
newrelic.cjs                 # New Relic agent config
```

## Setup

```bash
npm install
cp .env.example .env
# edit .env — add ANTHROPIC_API_KEY and NEW_RELIC_LICENSE_KEY
```

## Run

```bash
# with New Relic enabled
npm start

# without New Relic (e.g. for local hacking)
npm run start:no-nr
```

Open http://localhost:3000 and ask: *"how's the weather in Hyderabad?"*

## How New Relic sees it

A single `POST /api/query` transaction contains nested custom segments:

```
POST /api/query
└── agent.run
    ├── agent.llm.iteration_1            (Claude decides to call a tool)
    ├── mcp.tool.get_city_info           (custom attrs: tool name, args, duration)
    ├── agent.llm.iteration_2            (Claude decides to call the next tool)
    ├── mcp.tool.get_weather
    └── agent.llm.iteration_3            (Claude produces the final summary)
```

Plus custom events recorded for each iteration / tool call:

- `MCPToolCall { tool, server, duration_ms, success }`
- `AgentLLMCall { model, iteration, stop_reason, input_tokens, output_tokens }`

Use these in NRQL to build dashboards, e.g.:

```sql
SELECT average(duration_ms) FROM MCPToolCall FACET tool TIMESERIES
SELECT sum(output_tokens)  FROM AgentLLMCall FACET model TIMESERIES
```

## Running the MCP server standalone

The MCP server is a normal stdio MCP server — you can wire it into Claude
Desktop, Claude Code, or any other MCP client:

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/absolute/path/to/src/mcp-server/server.js"]
    }
  }
}
```

## Static mock on GitHub Pages

The `docs/` folder is a self-contained static mock of the same UI. The agent
loop and both MCP tool calls are simulated client-side using a small built-in
city dictionary and deterministic fake weather (stable per city per day).
Useful for previewing the UI without any backend.

**Deploy**: pushed to `main`, the workflow `.github/workflows/deploy-pages.yml`
publishes `docs/` to GitHub Pages automatically.

**One-time repo setup**: in *Settings → Pages*, set **Source = GitHub Actions**.
After the first push to `main`, the page is live at
`https://<your-user>.github.io/<repo>/`.

The mock recognises: Hyderabad, Bengaluru, Mumbai, Delhi, London, Paris,
New York (or NYC), Tokyo, Sydney, Dubai, San Francisco (or SF), Singapore,
Berlin, Toronto. Anything else returns a friendly error.

## Notes

- The agent is capped at 6 tool-use iterations as a safety guard.
- If `NEW_RELIC_LICENSE_KEY` is missing, the agent runs without telemetry —
  the `telemetry.js` wrappers degrade to no-ops.
- All network calls go to `*.open-meteo.com` and `api.anthropic.com`.
