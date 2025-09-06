import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

type TelegramPayload = {
  chat_id: string;
  text: string;
  parse_mode: string;
};

type UpdateSummary = {
  title: string;
  date: string;
  changelog: string;
};

const TELEGRAM_TOKEN = Bun.env.TELEGRAM_TOKEN || '';
const TELEGRAM_CHAT_ID = Bun.env.CHAT_ID || '';

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error(
    'Missing required environment variables: TELEGRAM_TOKEN and CHAT_ID'
  );
  process.exit(1);
}

const FILES = {
  claude: path.join(__dirname, 'cache', 'last_claude_version.json'),
  cursor: path.join(__dirname, 'cache', 'last_cursor_hash.json'),
  v0: path.join(__dirname, 'cache', 'last_v0_hash.json'),
  aiSdk: path.join(__dirname, 'cache', 'last_ai_sdk_tag.json'),
  wagmi: path.join(__dirname, 'cache', 'last_wagmi_tag.json'),
  viem: path.join(__dirname, 'cache', 'last_viem_tag.json'),
  elements: path.join(__dirname, 'cache', 'last_elements_hash.json'),
};

type Message = {
  toolName: string;
  changelog: string;
  link: string;
};

function generateMessage({ toolName, changelog, link }: Message): string {
  return `${toolName} release

${changelog.toLowerCase()}

${link}`;
}

async function sendTelegramMessage(message: string): Promise<void> {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const payload: TelegramPayload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'Markdown',
  };
  try {
    await axios.post(url, payload);
  } catch (error) {
    console.error('Telegram send error:', (error as Error).message);
  }
}

type StoredValue = {
  value: string;
};

async function getLastValue(
  filePath: string,
  defaultValue: string = ''
): Promise<string> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parsed: StoredValue = JSON.parse(data);
    return parsed.value || defaultValue;
  } catch {
    return defaultValue;
  }
}

async function saveValue(filePath: string, value: string): Promise<void> {
  const data: StoredValue = { value };
  await fs.writeFile(filePath, JSON.stringify(data), 'utf8');
}

async function checkClaudeCode(): Promise<string | null> {
  const url =
    'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';
  try {
    const { data } = await axios.get(url);

    const lines = data.split('\n');
    let version = '';
    let changelog = '';
    let foundFirstEntry = false;

    for (const line of lines) {
      if (line.match(/^##\s+\d+\.\d+(\.\d+)?$/)) {
        if (foundFirstEntry) break;
        version = line.replace(/^##\s+/, '').trim();
        foundFirstEntry = true;
        continue;
      }

      if (foundFirstEntry && line.match(/^-\s+/)) {
        const bulletText = line.replace(/^-\s+/, '').trim();
        if (bulletText) {
          changelog += `• ${bulletText}\n`;
        }
      }
    }

    if (!version) return null;

    const contentHash = crypto
      .createHash('sha256')
      .update(version + changelog)
      .digest('hex');
    const lastHash = await getLastValue(FILES.claude);

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'claude code',
        changelog: changelog.trim(),
        link: 'https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md',
      });
      await saveValue(FILES.claude, contentHash);
      return summary;
    }
  } catch (error) {
    console.error('Claude check error:', (error as Error).message);
  }
  return null;
}

async function checkAISDK(): Promise<string | null> {
  const url =
    'https://raw.githubusercontent.com/vercel/ai/main/packages/ai/CHANGELOG.md';
  try {
    const { data } = await axios.get(url);

    const lines = data.split('\n');
    let version = '';
    let changelog = '';
    let currentVersion = '';
    let currentChangelog = '';
    let foundVersionWithChanges = false;

    for (const line of lines) {
      if (line.match(/^##\s+\d+\.\d+\.\d+/)) {
        // If we have a version with meaningful changes, use it
        if (currentChangelog.trim() && !foundVersionWithChanges) {
          version = currentVersion;
          changelog = currentChangelog;
          foundVersionWithChanges = true;
          break;
        }
        // Start tracking new version
        currentVersion = line.replace(/^##\s+/, '').trim();
        currentChangelog = '';
        continue;
      }

      if (currentVersion) {
        const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
        if (bulletMatch) {
          const [, indentation, bulletText] = bulletMatch;
          let cleanText = bulletText.trim();

          const commitHashMatch = cleanText.match(/^[a-f0-9]{7,}:\s*(.+)$/);
          if (commitHashMatch) {
            cleanText = commitHashMatch[1];
          }

          // Filter meaningful changes - be more lenient
          if (
            cleanText &&
            cleanText.length > 8 &&
            !cleanText.toLowerCase().includes('thanks @') &&
            !cleanText.startsWith('Updated dependencies') &&
            !cleanText.startsWith('@') &&
            !cleanText.match(/^[a-f0-9]{7,}/) &&
            cleanText !== '-'
          ) {
            // Look for meaningful content or just take first few items if nothing specific found
            const isMeaningful =
              cleanText.includes('feat') ||
              cleanText.includes('fix') ||
              cleanText.includes('add') ||
              cleanText.includes('improve') ||
              cleanText.includes('support') ||
              cleanText.includes('throw') ||
              cleanText.includes('when') ||
              cleanText.includes('error') ||
              cleanText.includes('callback') ||
              cleanText.includes('sent') ||
              cleanText.includes('remove') ||
              cleanText.includes('update') ||
              cleanText.includes('change');

            if (isMeaningful || changelog.split('\n').length < 4) {
              cleanText = cleanText
                .replace(/^(feat|fix|chore)\s*(\([^)]+\))?\s*:\s*/i, '')
                .replace(/^-\s*/, '')
                .trim();

              if (cleanText.length > 8) {
                const prefix = indentation.length > 0 ? '  • ' : '• ';
                currentChangelog += `${prefix}${cleanText}\n`;
              }
            }
          }
        }
      }
    }

    // If no version with changes was found during iteration, use the last one we processed
    if (!foundVersionWithChanges && currentChangelog.trim()) {
      version = currentVersion;
      changelog = currentChangelog;
    }

    if (!version) return null;

    const contentHash = crypto
      .createHash('sha256')
      .update(version + changelog)
      .digest('hex');
    const lastHash = await getLastValue(FILES.aiSdk);

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'ai sdk',
        changelog: changelog.trim(),
        link: 'https://github.com/vercel/ai/blob/main/packages/ai/CHANGELOG.md',
      });
      await saveValue(FILES.aiSdk, contentHash);
      return summary;
    }
  } catch (error) {
    console.error('AI SDK check error:', (error as Error).message);
  }
  return null;
}

async function checkCursor(): Promise<string | null> {
  const url = 'https://cursor.com/changelog';
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const entries = $('h2');
    if (entries.length === 0) return null;

    const latestTitle = $(entries[0]).text().trim();
    const changelog = $(entries[0]).next().text().trim();

    const contentHash = crypto
      .createHash('sha256')
      .update(latestTitle)
      .digest('hex');
    const lastHash = await getLastValue(FILES.cursor);

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'cursor',
        changelog: latestTitle,
        link: 'https://cursor.com/changelog',
      });
      await saveValue(FILES.cursor, contentHash);
      return summary;
    }
  } catch (error) {
    console.error('Cursor check error:', (error as Error).message);
  }
  return null;
}

async function checkV0(): Promise<string | null> {
  const url = 'https://vercel.com/changelog';
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const entries = $('article');
    let latestV0Entry: UpdateSummary | null = null;
    for (let i = 0; i < Math.min(5, entries.length); i++) {
      const entry = $(entries[i]);
      const titleElem = entry.find('h2:first');
      let title = titleElem.text().trim();
      if (title.includes('v0')) {
        const dateText = entry.find('p').text();
        const dateMatch = dateText.match(
          /(\w+ \d{1,2}(?:st|nd|rd|th)?, \d{4})/
        );
        const date = dateMatch
          ? dateMatch[0]
          : new Date().toISOString().slice(0, 10);
        const body = entry
          .find('p, ul > li')
          .map((_, el) => $(el).text().trim())
          .get()
          .join(' ')
          .slice(0, 300);
        latestV0Entry = {
          title: titleElem.text().trim(),
          date,
          changelog: body,
        };
        break;
      }
    }
    if (!latestV0Entry) return null;

    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(latestV0Entry))
      .digest('hex');
    const lastHash = await getLastValue(FILES.v0);

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'v0',
        changelog: latestV0Entry.title,
        link: 'https://vercel.com/changelog',
      });
      await saveValue(FILES.v0, contentHash);
      return summary;
    }
  } catch (error) {
    console.error('v0 check error:', (error as Error).message);
  }
  return null;
}

async function checkAIElements(): Promise<string | null> {
  const url = 'https://vercel.com/changelog';
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const entries = $('article');
    let latestElementsEntry: UpdateSummary | null = null;
    for (let i = 0; i < Math.min(10, entries.length); i++) {
      const entry = $(entries[i]);
      const titleElem = entry.find('h2:first');
      let title = titleElem.text().trim();
      if (
        title.includes('ai elements') ||
        title.includes('elements') ||
        title.includes('ai-elements')
      ) {
        const dateText = entry.find('p').text();
        const dateMatch = dateText.match(
          /(\w+ \d{1,2}(?:st|nd|rd|th)?, \d{4})/
        );
        const date = dateMatch
          ? dateMatch[0]
          : new Date().toISOString().slice(0, 10);
        const body = entry
          .find('p, ul > li')
          .map((_, el) => $(el).text().trim())
          .get()
          .join(' ')
          .slice(0, 300);
        latestElementsEntry = {
          title: titleElem.text().trim(),
          date,
          changelog: body,
        };
        break;
      }
    }
    if (!latestElementsEntry) return null;

    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(latestElementsEntry))
      .digest('hex');
    const lastHash = await getLastValue(FILES.elements);

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'ai elements',
        changelog: latestElementsEntry.title,
        link: 'https://vercel.com/changelog',
      });
      await saveValue(FILES.elements, contentHash);
      return summary;
    }
  } catch (error) {
    console.error('AI Elements check error:', (error as Error).message);
  }
  return null;
}

async function checkWagmiChangelog(): Promise<string | null> {
  const url =
    'https://raw.githubusercontent.com/wevm/wagmi/refs/heads/main/packages/core/CHANGELOG.md';
  try {
    const { data } = await axios.get(url);
    const lines = data.split('\n');
    let version = '';
    let changelog = '';
    let foundFirstEntry = false;

    for (const line of lines) {
      if (line.match(/^##\s+\d+\.\d+\.\d+/)) {
        if (foundFirstEntry) break;
        version = line.replace(/^##\s+/, '').trim();
        foundFirstEntry = true;
        continue;
      }

      if (foundFirstEntry) {
        const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
        if (bulletMatch) {
          const [, indentation, bulletText] = bulletMatch;
          let cleanText = bulletText.trim();

          // Remove commit hashes, pull request links, and thanks messages
          cleanText = cleanText
            .replace(/\[#\d+\]\([^)]+\)/g, '') // Remove PR links
            .replace(/\[`[a-f0-9]+`\]\([^)]+\)/g, '') // Remove commit hash links
            .replace(/Thanks \[@\w+\]\([^)]+\)!\s*-\s*/g, '') // Remove thanks messages
            .replace(/\[\`[a-f0-9]{7,}\`\]/g, '') // Remove commit hashes in backticks
            .replace(/\s+/g, ' ')
            .trim();

          // Filter meaningful changes
          if (
            cleanText &&
            cleanText.length > 8 &&
            !cleanText.toLowerCase().includes('thanks @') &&
            !cleanText.startsWith('Updated dependencies') &&
            !cleanText.startsWith('@') &&
            !cleanText.match(/^[a-f0-9]{7,}/) &&
            !cleanText.includes('core@') &&
            !cleanText.includes('connectors@') &&
            cleanText !== '-' &&
            !cleanText.match(/^#{1,6}\s/) &&
            !cleanText.match(/^\[.*\]:$/)
          ) {
            const prefix =
              indentation && indentation.length > 2 ? '  • ' : '• ';
            changelog += `${prefix}${cleanText}\n`;
          }
        }
      }
    }

    if (!version) return null;

    const contentHash = crypto
      .createHash('sha256')
      .update(version + changelog)
      .digest('hex');
    const lastHash = await getLastValue(FILES.wagmi);

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'wagmi',
        changelog: changelog.trim(),
        link: 'https://github.com/wevm/wagmi/blob/main/packages/core/CHANGELOG.md',
      });
      await saveValue(FILES.wagmi, contentHash);
      return summary;
    }
  } catch (error) {
    console.error('Wagmi check error:', (error as Error).message);
  }
  return null;
}

async function checkViemChangelog(): Promise<string | null> {
  const url =
    'https://raw.githubusercontent.com/wevm/viem/refs/heads/main/src/CHANGELOG.md';
  try {
    const { data } = await axios.get(url);
    const lines = data.split('\n');
    let version = '';
    let changelog = '';
    let foundFirstEntry = false;

    for (const line of lines) {
      if (line.match(/^##\s+\d+\.\d+\.\d+/)) {
        if (foundFirstEntry) break;
        version = line.replace(/^##\s+/, '').trim();
        foundFirstEntry = true;
        continue;
      }

      if (foundFirstEntry) {
        const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
        if (bulletMatch) {
          const [, indentation, bulletText] = bulletMatch;
          let cleanText = bulletText.trim();

          // Remove commit hashes, pull request links, and thanks messages
          cleanText = cleanText
            .replace(/\[#\d+\]\([^)]+\)/g, '') // Remove PR links
            .replace(/\[`[a-f0-9]+`\]\([^)]+\)/g, '') // Remove commit hash links
            .replace(/Thanks \[@\w+\]\([^)]+\)!\s*-\s*/g, '') // Remove thanks messages
            .replace(/\[\`[a-f0-9]{7,}\`\]/g, '') // Remove commit hashes in backticks
            .replace(/\s+/g, ' ')
            .trim();

          // Filter meaningful changes
          if (
            cleanText &&
            cleanText.length > 8 &&
            !cleanText.toLowerCase().includes('thanks @') &&
            !cleanText.startsWith('Updated dependencies') &&
            !cleanText.startsWith('@') &&
            !cleanText.match(/^[a-f0-9]{7,}/) &&
            cleanText !== '-' &&
            !cleanText.match(/^#{1,6}\s/) &&
            !cleanText.match(/^\[.*\]:$/)
          ) {
            const prefix =
              indentation && indentation.length > 2 ? '  • ' : '• ';
            changelog += `${prefix}${cleanText}\n`;
          }
        }
      }
    }

    if (!version) return null;

    const contentHash = crypto
      .createHash('sha256')
      .update(version + changelog)
      .digest('hex');
    const lastHash = await getLastValue(FILES.viem);

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'viem',
        changelog: changelog.trim(),
        link: 'https://github.com/wevm/viem/blob/main/src/CHANGELOG.md',
      });
      await saveValue(FILES.viem, contentHash);
      return summary;
    }
  } catch (error) {
    console.error('Viem check error:', (error as Error).message);
  }
  return null;
}

(async () => {
  const [
    claudeUpdate,
    cursorUpdate,
    v0Update,
    elementsUpdate,
    aiSdkUpdate,
    wagmiUpdate,
    viemUpdate,
  ] = await Promise.all([
    checkClaudeCode(),
    checkCursor(),
    checkV0(),
    checkAIElements(),
    checkAISDK(),
    checkWagmiChangelog(),
    checkViemChangelog(),
  ]);

  if (claudeUpdate) await sendTelegramMessage(claudeUpdate);
  if (cursorUpdate) await sendTelegramMessage(cursorUpdate);
  if (v0Update) await sendTelegramMessage(v0Update);
  if (elementsUpdate) await sendTelegramMessage(elementsUpdate);
  if (aiSdkUpdate) await sendTelegramMessage(aiSdkUpdate);
  if (wagmiUpdate) await sendTelegramMessage(wagmiUpdate);
  if (viemUpdate) await sendTelegramMessage(viemUpdate);
})().catch(console.error);
