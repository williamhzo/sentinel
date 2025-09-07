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

## Adding New Tools

To monitor a new tool's changelog:

1. **Add config** in `changelog-checks.ts`:

   ```typescript
   NEWTOOL: {
     url: 'https://raw.githubusercontent.com/org/repo/main/CHANGELOG.md',
     link: 'https://github.com/org/repo/blob/main/CHANGELOG.md',
     name: 'tool name',
   }
   ```

2. **Create checker** (use `createChangelogChecker` for markdown or write custom function for HTML):

   ```typescript
   export const checkNewTool = createChangelogChecker(
     CONFIG.NEWTOOL,
     'newtool'
   );
   ```

3. **Add to checks** in `sentinel.ts` `runChecks()` function

## Testing

```bash
bun test
```
