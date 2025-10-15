# Repository Guidelines

## Project Structure & Module Organization

`sentinel.ts` is the worker entry point; it wires storage providers from `utils.ts` with the changelog scrapers in `changelog-checks.ts`. Add new monitors by extending `CONFIG`, creating a checker, and registering it inside `runChecks`. Utility code also provides Telegram messaging and filesystem/KV storage; local runs persist state in `cache/`. UI assets live in `assets/`, while `wrangler.toml`, `package.json`, and `tsconfig.json` control the Cloudflare Worker and TypeScript build. Tests currently sit at the repo root (`changelog.test.ts`); mirror that placement for additional suites.

## Build, Test, and Development Commands

Use `bun install` once to sync dependencies. Run `bun run sentinel.ts` for a Bun-based local execution that requires `.env` with `TELEGRAM_TOKEN` and `CHAT_ID`. `wrangler dev` starts the worker against your Cloudflare account, and `wrangler deploy` publishes it. Execute `bun test` to run the Bun test runner; add `--watch` locally if you prefer live re-runs.

## Coding Style & Naming Conventions

TypeScript files are ES modules with two-space indentation, trailing commas in multiline literals, and single quotes. Keep helper functions pure and leverage async/await rather than chained promises. Follow the existing naming scheme: camelCase for functions, PascalCase for types, and UPPER_SNAKE for keys inside shared config maps. When formatting outbound messages, preserve the lowercase release headings established in `generateMessage`.

## Testing Guidelines

The project uses Bun’s built-in `bun:test`. Group related assertions with `describe` blocks and keep expectations concrete (e.g., exact message strings). When adding a new checker, mirror the existing tests by stubbing storage via `createMockStorage` and validating both the generated message and canonical link. Cover edge cases like “thanks @user” cleanup or empty changelog sections so regression noise does not leak to Telegram.

## Commit & Pull Request Guidelines

Recent history favors short, lower-case, imperative summaries (e.g., `update claude`). Keep subject lines under ~60 characters; expand on motivation and follow-up steps in the body if needed. For pull requests, include: 1) a brief problem statement and outcome, 2) any new config or secrets, 3) test evidence (`bun test`, `bun run sentinel.ts`, or `wrangler dev`). When behavior changes user-visible output (Telegram payloads), paste a sample message to aid reviewers. Link related issues with `Closes #123` when applicable.

## Environment & Secrets

Store local secrets in `.env`; never commit that file. Cloudflare deployments rely on `wrangler.toml` plus KV binding `SENTINEL_KV`. For Bun runs, ensure `cache/` stays writable or configure an alternate path when running in CI. Rotate Telegram tokens promptly if exposed and update Cloudflare secrets via `wrangler secret put`.
