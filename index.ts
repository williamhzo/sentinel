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

function generateMessage(
  toolName: string,
  title: string,
  changelog: string,
  link: string
): string {
  const currentDateTime = new Date().toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `new ${toolName} release

📅 ${currentDateTime}

${title} - ${changelog}

🔗 ${link}`;
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

type PyPIResponse = {
  info: { version: string; release_notes?: string };
  releases: Record<string, Array<{ upload_time: string }>>;
};

type GitHubRelease = {
  tag_name: string;
  published_at: string;
  body: string;
};

async function checkClaudeCode(): Promise<string | null> {
  const url = 'https://pypi.org/pypi/claude-code-sdk/json';
  try {
    const { data }: { data: PyPIResponse } = await axios.get(url);
    const latestVersion = data.info.version;
    const lastVersion = await getLastValue(FILES.claude);

    if (latestVersion !== lastVersion) {
      const releases = data.releases[latestVersion];
      let releaseDate = new Date().toISOString().slice(0, 10);
      let changelog =
        'Check https://docs.anthropic.com/en/docs/claude-code for full details.';
      if (releases && releases.length > 0 && releases[0]) {
        releaseDate = releases[0].upload_time.slice(0, 10);
        if (data.info.release_notes) changelog = data.info.release_notes;
      }
      const summary = generateMessage(
        'Claude Code',
        `v${latestVersion}`,
        `${changelog.slice(0, 200)}...`,
        'https://docs.anthropic.com/en/docs/claude-code'
      );
      await saveValue(FILES.claude, latestVersion);
      return summary;
    }
  } catch (error) {
    console.error('Claude check error:', (error as Error).message);
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
    let bodyText = '';
    let current = $(entries[0]).next();
    while (current.length && current[0] && current[0].name !== 'h2') {
      if (['h3', 'p', 'ul', 'li'].includes(current[0].name || '')) {
        bodyText += current.text().trim() + ' ';
      }
      current = current.next();
    }
    bodyText = bodyText.trim().slice(0, 500);

    const contentHash = crypto
      .createHash('sha256')
      .update(latestTitle + bodyText)
      .digest('hex');
    const lastHash = await getLastValue(FILES.cursor);

    if (contentHash !== lastHash) {
      const summary = generateMessage(
        'Cursor',
        latestTitle,
        `${bodyText}...`,
        'https://cursor.com/changelog'
      );
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
      let title = titleElem.text().trim().toLowerCase();
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
      const summary = generateMessage(
        'v0',
        latestV0Entry.title,
        `${latestV0Entry.changelog}...`,
        'https://vercel.com/changelog'
      );
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
      let title = titleElem.text().trim().toLowerCase();
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
      const summary = generateMessage(
        'AI Elements',
        latestElementsEntry.title,
        `${latestElementsEntry.changelog}...`,
        'https://vercel.com/changelog'
      );
      await saveValue(FILES.elements, contentHash);
      return summary;
    }
  } catch (error) {
    console.error('AI Elements check error:', (error as Error).message);
  }
  return null;
}

async function checkGitHubRepo(
  repo: string,
  fileKey: keyof typeof FILES,
  name: string
): Promise<string | null> {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  try {
    const { data }: { data: GitHubRelease } = await axios.get(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    const latestTag = data.tag_name;
    const lastTag = await getLastValue(FILES[fileKey]);

    if (latestTag !== lastTag) {
      const changelog = data.body.replace(/\n/g, ' ').slice(0, 300);
      const summary = generateMessage(
        name,
        latestTag,
        `${changelog}...`,
        `https://github.com/${repo}/releases/tag/${latestTag}`
      );
      await saveValue(FILES[fileKey], latestTag);
      return summary;
    }
  } catch (error) {
    console.error(`${name} check error:`, (error as Error).message);
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
    checkGitHubRepo('vercel/ai', 'aiSdk', 'Vercel AI SDK'),
    checkGitHubRepo('wevm/wagmi', 'wagmi', 'wagmi'),
    checkGitHubRepo('wevm/viem', 'viem', 'viem'),
  ]);

  if (claudeUpdate) await sendTelegramMessage(claudeUpdate);
  if (cursorUpdate) await sendTelegramMessage(cursorUpdate);
  if (v0Update) await sendTelegramMessage(v0Update);
  if (elementsUpdate) await sendTelegramMessage(elementsUpdate);
  if (aiSdkUpdate) await sendTelegramMessage(aiSdkUpdate);
  if (wagmiUpdate) await sendTelegramMessage(wagmiUpdate);
  if (viemUpdate) await sendTelegramMessage(viemUpdate);
})().catch(console.error);
