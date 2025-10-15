# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

description: Sentinel is a changelog monitoring service built with Bun and deployed to Cloudflare Workers. It monitors various developer tools and sends Telegram notifications when updates are available.
globs: "_.ts, _.tsx, _.html, _.css, _.js, _.jsx, package.json, wrangler.toml"
alwaysApply: true

---

# Sentinel - Changelog Monitor

Sentinel is a TypeScript application that monitors changelogs from various developer tools and services, sending notifications via Telegram when new releases are detected. It can run both locally with Bun and as a Cloudflare Worker with scheduled execution.

## Architecture

The project consists of several key components:

### Core Files

- `sentinel.ts` - Main entry point with dual environment support (Bun local/Cloudflare Worker)
- `utils.ts` - Shared utilities for storage, environment, and Telegram messaging
- `changelog-checks.ts` - Individual changelog parsers for each monitored tool
- `changelog.test.ts` - Comprehensive test suite using Bun's built-in test runner

### Monitored Tools

Currently monitors changelogs for:

- **Claude Code** - Anthropic's CLI tool
- **AI SDK** - Vercel's AI development kit
- **Cursor** - AI-powered code editor
- **v0** - Vercel's AI-powered UI generator
- **AI Elements** - Vercel's AI component library
- **Wagmi** - React hooks for Ethereum
- **Viem** - TypeScript Ethereum library

## Development Setup

### Prerequisites

- Bun runtime
- Telegram bot token and chat ID
- Cloudflare account (for deployment)

### Environment Variables

Create a `.env` file with:

```env
TELEGRAM_TOKEN=your_bot_token
CHAT_ID=your_chat_id
```

To get these values:

1. Create a Telegram bot via [@BotFather](https://t.me/botfather) with `/newbot` command
2. Get your chat ID by visiting: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` after messaging your bot

### Available Scripts

- `bun run dev` - Start Wrangler development server
- `bun run deploy` - Deploy to Cloudflare Workers
- `bun run bun-run` - Run locally with Bun
- `bun run sentinel.ts` - Direct execution (same as bun-run)
- `bun test` - Run all tests
- `bun test <file>` - Run specific test file

## Usage Patterns

### Local Development

```ts
// Run locally for testing
bun run sentinel.ts

// Run with hot reload for development
bun --hot sentinel.ts
```

### Cloudflare Worker Deployment

The application automatically detects the execution environment and adapts accordingly:

- **Local**: Uses filesystem-based storage in `./cache/` directory
- **Worker**: Uses Cloudflare KV for persistent storage

### Testing

Uses Bun's native testing framework:

```ts
import { describe, it, expect } from 'bun:test';
// Test implementation
```

## Technical Details

### Dual Environment Support

- Detects execution context using `globalThis.ScheduledEvent`
- Provides environment-specific storage and configuration
- Supports both filesystem (local) and KV (worker) storage backends

### Changelog Parsing Strategies

- **Markdown parsing** for GitHub-hosted changelogs
- **HTML scraping** for web-based changelogs (Cursor, Vercel)
- **Content hashing** for change detection
- **Configurable filtering** to extract meaningful updates

### Telegram Integration

- Markdown-formatted messages
- Error handling for failed deliveries
- Consistent message formatting across all tools

### Scheduled Execution

- Can run via Cloudflare Workers cron trigger (currently paused)
- Configure schedule in `wrangler.toml` under `[triggers]` section
- Also requires KV namespace binding to be uncommented

## Adding New Monitored Tools

To add a new changelog to monitor:

1. **Add configuration** in `changelog-checks.ts`:

   ```typescript
   NEWTOOL: {
     url: 'path_to_raw_markdown_or_changelog_url',
     link: 'path_to_changelog_page',
     name: 'tool name',
   }
   ```

2. **Create checker function**:

   - For markdown changelogs: Use `createChangelogChecker` helper
   - For HTML changelogs: Write custom parser using cheerio (see `checkCursor` or `checkV0`)

3. **Add to execution** in `sentinel.ts`:
   - Import new checker function
   - Add to `Promise.all()` in `runChecks()` function
   - Add corresponding `if (update) await sendTelegramMessage()` call

## Configuration

### Wrangler Configuration

```toml
name = "sentinel"
main = "sentinel.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# Uncomment to enable scheduled execution
# [triggers]
# crons = ["*/10 * * * *"]

# Uncomment and configure for Worker storage
# [[kv_namespaces]]
# binding = "SENTINEL_KV"
# id = "your_kv_namespace_id"
```

### TypeScript Configuration

- Latest ESNext features
- Bundler module resolution
- Cloudflare Workers and Bun type support
- Strict type checking enabled

## Deployment to Cloudflare Workers

1. Ensure Wrangler is authenticated: `wrangler login`
2. Create KV namespace: `wrangler kv:namespace create "SENTINEL_KV"`
3. Update `wrangler.toml` with KV namespace ID and uncomment the binding
4. Set secrets:
   - `wrangler secret put TELEGRAM_TOKEN`
   - `wrangler secret put CHAT_ID`
5. Uncomment cron trigger in `wrangler.toml` if desired
6. Deploy: `bun run deploy`

## Bun-Specific Features

- Native .env loading (no dotenv required)
- Built-in testing framework
- Fast TypeScript execution
- Efficient HTTP client
