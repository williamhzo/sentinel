# Sentinel

Monitors changelogs and sends Telegram notifications on updates for the following tools:

- Claude Code
- Vercel AI SDK
- Cursor IDE
- v0
- AI Elements
- wagmi
- viem

## Setup

```bash
bun install
export TELEGRAM_TOKEN="your_bot_token"
export CHAT_ID="your_chat_id"
```

## Usage

**Local/Development:**

```bash
bun run sentinel.ts
```

**Cloudflare Worker:**

```bash
wrangler deploy
```

## Testing

```bash
bun test
```
