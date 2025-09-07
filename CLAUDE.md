---
description: Sentinel is a changelog monitoring service built with Bun and deployed to Cloudflare Workers. It monitors various developer tools and sends Telegram notifications when updates are available.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json, wrangler.toml"
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
Copy `.env.example` to `.env` and fill in:
```env
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### Available Scripts
- `bun run dev` - Start Wrangler development server
- `bun run deploy` - Deploy to Cloudflare Workers
- `bun run bun-run` - Run locally with Bun
- `bun test` - Run test suite

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
- Runs every 10 minutes via Cloudflare Workers cron trigger
- Configurable in `wrangler.toml`

## Configuration

### Wrangler Configuration
```toml
name = "sentinel"
main = "sentinel.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[triggers]
crons = ["*/10 * * * *"]  # Every 10 minutes
```

### TypeScript Configuration
- Latest ESNext features
- Bundler module resolution
- Cloudflare Workers and Bun type support
- Strict type checking enabled

## Deployment

1. Ensure Wrangler is configured with your Cloudflare account
2. Set up KV namespace in Cloudflare dashboard
3. Configure secrets: `wrangler secret put TELEGRAM_TOKEN` and `wrangler secret put CHAT_ID`
4. Deploy: `bun run deploy`

## Bun-Specific Features
- Native .env loading (no dotenv required)
- Built-in testing framework
- Fast TypeScript execution
- Efficient HTTP client
