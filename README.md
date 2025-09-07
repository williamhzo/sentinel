# Sentinel

## Monitors changelogs and sends Telegram notifications on updates

Can be used for any tool or library, currently set up for the following:

- Claude Code
- Vercel AI SDK
- Cursor IDE
- v0
- AI Elements
- wagmi
- viem

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow prompts
3. Save the bot token from the response

### 3. Get Chat ID

1. Start a chat with your bot
2. Send any message to your bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find `"chat":{"id":` in the response

### 4. Set Environment Variables

**In `.env`:**

```bash
TELEGRAM_TOKEN=your_bot_token
CHAT_ID=your_chat_id
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
     url: 'path_to_raw_markdown_or_deployed_changelog',
     link: 'path_to_changelog',
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
