# Iceland News MCP Server

An MCP (Model Context Protocol) server that fetches the latest news from Icelandic news sources via RSS feeds.

## Features

- Fetch news from 6 Icelandic news sources
- 60+ different news feeds across categories
- Support for Icelandic, English, and Polish language feeds
- Configurable number of articles (1-50)
- Built-in tool to list all available feeds

## Supported Sources

### RÚV (Ríkisútvarpið - Icelandic National Broadcasting Service)

| Feed | Description |
|------|-------------|
| `frettir` | All news |
| `innlent` | Domestic news |
| `erlent` | International news |
| `ithrottir` | Sports |
| `menning-og-daegurmal` | Culture & current affairs |
| `audskilid` | Plain language Icelandic |
| `english` | English news |
| `polski` | Polish news |

### Morgunblaðið (mbl.is)

#### Main News
| Feed | Description |
|------|-------------|
| `fp` | Front page news |
| `innlent` | Domestic news |
| `erlent` | International news |
| `togt` | Tech & science |
| `english` | English news |
| `helst` | Top stories |
| `nyjast` | Latest news |
| `sjonvarp` | TV news |

#### Sports
| Feed | Description |
|------|-------------|
| `sport` | All sports |
| `fotbolti` | Football |
| `enski` | English Premier League |
| `golf` | Golf |
| `handbolti` | Handball |
| `korfubolti` | Basketball |
| `pepsideild` | Pepsi league (Icelandic football) |
| `formula` | Formula 1 |
| `hestar` | Horses |
| `rafithrottir` | Esports |

#### Business & Industry
| Feed | Description |
|------|-------------|
| `vidskipti` | Business |
| `200milur` | Marine & fishing |
| `fasteignir` | Real estate |

#### Culture & Lifestyle
| Feed | Description |
|------|-------------|
| `menning` | Culture |
| `folk` | People |
| `verold` | World/Celebrities |
| `matur` | Food |
| `ferdalog` | Travel |
| `bill` | Cars |

#### Smartland (Lifestyle)
| Feed | Description |
|------|-------------|
| `smartland` | Smartland |
| `stars` | Celebrities |
| `tiska` | Fashion |
| `heimili` | Home & design |
| `utlit` | Beauty |
| `heilsa` | Health & nutrition |
| `frami` | Success stories |
| `samkvaemislifid` | Social life |
| `fjolskyldan` | Family |

#### Morgunblaðið Newspaper
| Feed | Description |
|------|-------------|
| `mogginn-idag` | Today's paper |
| `mogginn-featured` | Featured articles |
| `mogginn-leidarar` | Editorials |
| `mogginn-sunnudagur` | Sunday edition |
| `mogginn-netgreinar` | Selected articles |

#### Other
| Feed | Description |
|------|-------------|
| `k100` | K100 radio |
| `smaaugl` | Classifieds |
| `blog` | Blog discussions |

### Heimildin

| Feed | Description |
|------|-------------|
| `frettir` | All news |

### Mannlíf

| Feed | Description |
|------|-------------|
| `frettir` | All news |

### Landsbankinn

| Feed | Description |
|------|-------------|
| `frettir` | News & announcements |

### Háskóli Íslands (University of Iceland)

#### University-wide
| Feed | Description |
|------|-------------|
| `frettir` | University news |
| `vidburdir` | University events |

#### School of Social Sciences
| Feed | Description |
|------|-------------|
| `felagsvisindasvid-frettir` | Social Sciences news |
| `felagsvisindasvid-vidburdir` | Social Sciences events |

#### School of Health Sciences
| Feed | Description |
|------|-------------|
| `heilbrigdisvisindasvid-frettir` | Health Sciences news |
| `heilbrigdisvisindasvid-vidburdir` | Health Sciences events |

#### School of Humanities
| Feed | Description |
|------|-------------|
| `hugvisindasvid-frettir` | Humanities news |
| `hugvisindasvid-vidburdir` | Humanities events |

#### School of Education
| Feed | Description |
|------|-------------|
| `menntavisindasvid-frettir` | Education news |
| `menntavisindasvid-vidburdir` | Education events |

#### School of Engineering and Natural Sciences
| Feed | Description |
|------|-------------|
| `verkfraedi-natturuvisindasvid-frettir` | Engineering & Natural Sciences news |
| `verkfraedi-natturuvisindasvid-vidburdir` | Engineering & Natural Sciences events |

## Installation

### Prerequisites

- Node.js 18 or higher
- npm

### Build from Source

```bash
git clone https://github.com/olibuijr/iceland-news-mcp.git
cd iceland-news-mcp
npm install
npm run build
```

## Configuration

### Claude Code

Add to your Claude Code configuration file `~/.claude/claude_code_config.json`:

```json
{
  "mcpServers": {
    "iceland-news": {
      "command": "node",
      "args": ["/absolute/path/to/iceland-news-mcp/dist/index.js"]
    }
  }
}
```

Then restart Claude Code or run `/mcp` to refresh MCP servers.

### Claude Desktop

Add to your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "iceland-news": {
      "command": "node",
      "args": ["/absolute/path/to/iceland-news-mcp/dist/index.js"]
    }
  }
}
```

Then restart Claude Desktop.

### Cursor

Add to your Cursor MCP configuration file `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "iceland-news": {
      "command": "node",
      "args": ["/absolute/path/to/iceland-news-mcp/dist/index.js"]
    }
  }
}
```

Then restart Cursor or use the command palette to reload MCP servers.

### VS Code with Continue Extension

Add to your Continue configuration file `~/.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "iceland-news",
      "command": "node",
      "args": ["/absolute/path/to/iceland-news-mcp/dist/index.js"]
    }
  ]
}
```

### Windsurf

Add to your Windsurf MCP configuration file `~/.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "iceland-news": {
      "command": "node",
      "args": ["/absolute/path/to/iceland-news-mcp/dist/index.js"]
    }
  }
}
```

### Zed

Add to your Zed settings file `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "iceland-news": {
      "command": {
        "path": "node",
        "args": ["/absolute/path/to/iceland-news-mcp/dist/index.js"]
      }
    }
  }
}
```

## Usage

Once configured, you can ask your AI assistant to fetch Icelandic news:

- "Get the latest news from Iceland"
- "Show me sports news from Morgunblaðið"
- "What's the latest international news from RÚV?"
- "Fetch 5 articles from the MBL English feed"
- "List all available feeds"
- "Get news from the University of Iceland"

### Tool: `get_news`

Fetch news articles from a specific source and feed.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `source` | string | `ruv` | News source: `ruv`, `mbl`, `heimildin`, `mannlif`, `landsbankinn`, or `hi` |
| `feed` | string | `frettir` | The feed to fetch (see tables above) |
| `limit` | number | `10` | Number of articles to return (1-50) |

**Example:**

```json
{
  "name": "get_news",
  "arguments": {
    "source": "mbl",
    "feed": "sport",
    "limit": 5
  }
}
```

### Tool: `list_feeds`

List all available feeds for one or all sources.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `source` | string | `all` | Source to list: `ruv`, `mbl`, `heimildin`, `mannlif`, `landsbankinn`, `hi`, or `all` |

**Example:**

```json
{
  "name": "list_feeds",
  "arguments": {
    "source": "hi"
  }
}
```

## Development

### Project Structure

```
iceland-news-mcp/
├── src/
│   └── index.ts      # Main MCP server source
├── dist/
│   └── index.js      # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

### Scripts

```bash
# Build the project
npm run build

# Run the server (for testing)
npm start
```

### Testing

You can test the server manually by sending JSON-RPC messages:

```bash
# Test fetching news
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_news","arguments":{"source":"mbl","feed":"sport","limit":3}}}' | node dist/index.js

# Test listing feeds
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_feeds","arguments":{"source":"all"}}}' | node dist/index.js
```

## Author

**Ólafur Búi Ólafsson**
Email: olibuijr@olibuijr.com
GitHub: [@olibuijr](https://github.com/olibuijr)

## Changelog

### v1.1.0 (2025-12-03)

**New Features:**
- **Web UI**: Added SvelteKit web interface for real-time voice conversation
- **Voice Assistant**: Integrated Gemini Live API for native audio responses
- **Icelandic Speech Recognition**: Added Whisper STT service with fine-tuned Icelandic model (`language-and-voice-lab/whisper-large-icelandic-62640-steps-967h`)
- **Function Calling**: Gemini can now fetch news using MCP tools (`get_all_news`, `get_news_by_source`, `get_news_by_category`)
- **Voice Activity Detection (VAD)**: Auto-transcription when user stops speaking
- **Auto-Headlines**: App automatically reads 10 latest headlines on startup
- **Multiple Voices**: Choose from 5 different voices (Puck, Charon, Kore, Fenrir, Aoede)

**Technical:**
- News API endpoint for RSS feed aggregation
- Whisper service runs on CUDA (RTX 3080) for fast inference
- SvelteKit proxy for Whisper service requests
- Professional Icelandic news reporter persona

### v1.0.0 (2025-12-03)

**Initial Release:**
- MCP server with 2 tools: `get_news` and `list_feeds`
- Support for 6 Icelandic news sources
- 60+ RSS feeds across categories
- Multi-language support (Icelandic, English, Polish)

## License

ISC

## Credits

- News content provided by:
  - [RÚV](https://www.ruv.is) (Ríkisútvarpið - Icelandic National Broadcasting Service)
  - [Morgunblaðið](https://www.mbl.is) (mbl.is)
  - [Heimildin](https://heimildin.is)
  - [Mannlíf](https://mannlif.is)
  - [Landsbankinn](https://www.landsbankinn.is)
  - [Háskóli Íslands](https://hi.is) (University of Iceland)
- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
