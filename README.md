# Sentinel

A changelog monitoring tool that tracks updates from various development tools and sends notifications via Telegram.

## Features

- Monitors changelogs for:

  - Claude Code
  - Vercel AI SDK
  - Cursor IDE
  - v0
  - Vercel AI Elements
  - wagmi (core & React)
  - viem

- Parses raw markdown changelogs for consistent output
- Filters out noise (commit hashes, dependency updates, etc.)
- Sends formatted notifications to Telegram

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Set environment variables:

   ```bash
   export TELEGRAM_TOKEN="your_telegram_bot_token"
   export CHAT_ID="your_telegram_chat_id"
   ```

3. Run the monitoring script:
   ```bash
   bun run index.ts
   ```

## Testing

```bash
bun test
```

The tests verify:

- Changelog parsing for each tool
- Message formatting consistency
