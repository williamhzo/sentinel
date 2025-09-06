import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CHANGELOG_URLS, GITHUB_LINKS } from './constants';

export type TelegramPayload = {
  chat_id: string;
  text: string;
  parse_mode: string;
};

export type UpdateSummary = {
  title: string;
  date: string;
  changelog: string;
};

export type StorageProvider = {
  getValue: (key: string, defaultValue?: string) => Promise<string>;
  setValue: (key: string, value: string) => Promise<void>;
};

export type EnvironmentProvider = {
  getTelegramToken: () => string;
  getChatId: () => string;
};

type Message = {
  toolName: string;
  changelog: string;
  link: string;
};

type StoredValue = {
  value: string;
};

export function generateMessage({
  toolName,
  changelog,
  link,
}: Message): string {
  return `**${toolName} release**

${changelog.toLowerCase()}

${link}`;
}

export function createFileSystemStorage(
  basePath: string = path.join(__dirname, 'cache')
): StorageProvider {
  const getFilePath = (key: string): string => {
    return path.join(basePath, `last_${key}.json`);
  };

  return {
    async getValue(key: string, defaultValue: string = ''): Promise<string> {
      try {
        const filePath = getFilePath(key);
        const data = await fs.readFile(filePath, 'utf8');
        const parsed: StoredValue = JSON.parse(data);
        return parsed.value || defaultValue;
      } catch {
        return defaultValue;
      }
    },

    async setValue(key: string, value: string): Promise<void> {
      const filePath = getFilePath(key);
      const data: StoredValue = { value };
      await fs.writeFile(filePath, JSON.stringify(data), 'utf8');
    },
  };
}

export function createKVStorage(kv: KVNamespace): StorageProvider {
  return {
    async getValue(key: string, defaultValue: string = ''): Promise<string> {
      try {
        const value = await kv.get(key);
        return value || defaultValue;
      } catch {
        return defaultValue;
      }
    },

    async setValue(key: string, value: string): Promise<void> {
      await kv.put(key, value);
    },
  };
}

export async function sendTelegramMessage(
  message: string,
  env: EnvironmentProvider
): Promise<void> {
  const url = `https://api.telegram.org/bot${env.getTelegramToken()}/sendMessage`;
  const payload: TelegramPayload = {
    chat_id: env.getChatId(),
    text: message,
    parse_mode: 'Markdown',
  };
  try {
    await axios.post(url, payload);
  } catch (error) {
    console.error('Telegram send error:', (error as Error).message);
  }
}

export function createBunEnvironment(): EnvironmentProvider {
  return {
    getTelegramToken: () => Bun.env.TELEGRAM_TOKEN || '',
    getChatId: () => Bun.env.CHAT_ID || '',
  };
}

export function createWorkerEnvironment(env: {
  TELEGRAM_TOKEN: string;
  CHAT_ID: string;
}): EnvironmentProvider {
  return {
    getTelegramToken: () => env.TELEGRAM_TOKEN,
    getChatId: () => env.CHAT_ID,
  };
}

export async function checkClaudeCode(
  storage: StorageProvider
): Promise<string | null> {
  const url = CHANGELOG_URLS.CLAUDE;
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
    const lastHash = await storage.getValue('claude');

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'claude code',
        changelog: changelog.trim(),
        link: GITHUB_LINKS.CLAUDE,
      });
      await storage.setValue('claude', contentHash);
      return summary;
    }
  } catch (error) {
    console.error('Claude check error:', (error as Error).message);
  }
  return null;
}

export async function checkAISDK(
  storage: StorageProvider
): Promise<string | null> {
  const url = CHANGELOG_URLS.AI_SDK;
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
        if (currentChangelog.trim() && !foundVersionWithChanges) {
          version = currentVersion;
          changelog = currentChangelog;
          foundVersionWithChanges = true;
          break;
        }
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

          if (
            cleanText &&
            cleanText.length > 8 &&
            !cleanText.toLowerCase().includes('thanks @') &&
            !cleanText.startsWith('Updated dependencies') &&
            !cleanText.startsWith('@') &&
            !cleanText.match(/^[a-f0-9]{7,}/) &&
            cleanText !== '-'
          ) {
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

    if (!foundVersionWithChanges && currentChangelog.trim()) {
      version = currentVersion;
      changelog = currentChangelog;
    }

    if (!version) return null;

    const contentHash = crypto
      .createHash('sha256')
      .update(version + changelog)
      .digest('hex');
    const lastHash = await storage.getValue('aiSdk');

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'ai sdk',
        changelog: changelog.trim(),
        link: GITHUB_LINKS.AI_SDK,
      });
      await storage.setValue('aiSdk', contentHash);
      return summary;
    }
  } catch (error) {
    console.error('AI SDK check error:', (error as Error).message);
  }
  return null;
}

export async function checkCursor(
  storage: StorageProvider
): Promise<string | null> {
  const url = CHANGELOG_URLS.CURSOR;
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const mainEntrySelector = 'h2';
    const entries = $(mainEntrySelector);

    if (entries.length === 0) return null;

    let changelog = '';

    const mainTitle = $(entries[0]).text().trim();
    if (mainTitle) {
      changelog += `${mainTitle}\n`;

      let currentElement = $(entries[0]).next();
      while (currentElement.length && !currentElement.is('h2')) {
        if (currentElement.is('h3')) {
          const h3Text = currentElement.text().trim();
          if (h3Text) {
            changelog += `• ${h3Text}\n`;
          }
        }
        currentElement = currentElement.next();
      }
    }

    changelog += '\n';

    let sectionElement = $(entries[0]).next();
    while (sectionElement.length && !sectionElement.is('h2')) {
      if (sectionElement.is('details')) {
        const summary = sectionElement.find('summary').text().toLowerCase();
        if (summary.includes('improvements')) {
          changelog += `Improvements\n`;
          sectionElement.find('li').each((_, li) => {
            const improvementText = $(li).text().trim();
            if (improvementText) {
              changelog += `  • ${improvementText}\n`;
            }
          });
          changelog += '\n';
        } else if (summary.includes('patches')) {
          changelog += `Patches\n`;
          sectionElement.find('li').each((_, li) => {
            const patchText = $(li).text().trim();
            const cleanPatchText = patchText.replace(
              /^\d+\.\d+(\.\d+)?:\s*/,
              ''
            );
            if (cleanPatchText) {
              changelog += `  • ${cleanPatchText}\n`;
            }
          });
        }
      }
      sectionElement = sectionElement.next();
    }

    const contentHash = crypto
      .createHash('sha256')
      .update(changelog)
      .digest('hex');
    const lastHash = await storage.getValue('cursor');

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'cursor',
        changelog: changelog.trim(),
        link: GITHUB_LINKS.CURSOR,
      });
      await storage.setValue('cursor', contentHash);
      return summary;
    }
  } catch (error) {
    console.error('Cursor check error:', (error as Error).message);
  }
  return null;
}

export async function checkV0(
  storage: StorageProvider
): Promise<string | null> {
  const url = CHANGELOG_URLS.VERCEL;
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
    const lastHash = await storage.getValue('v0');

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'v0',
        changelog: latestV0Entry.title,
        link: GITHUB_LINKS.VERCEL,
      });
      await storage.setValue('v0', contentHash);
      return summary;
    }
  } catch (error) {
    console.error('v0 check error:', (error as Error).message);
  }
  return null;
}

export async function checkAIElements(
  storage: StorageProvider
): Promise<string | null> {
  const url = CHANGELOG_URLS.VERCEL;
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
    const lastHash = await storage.getValue('elements');

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'ai elements',
        changelog: latestElementsEntry.title,
        link: GITHUB_LINKS.VERCEL,
      });
      await storage.setValue('elements', contentHash);
      return summary;
    }
  } catch (error) {
    console.error('AI Elements check error:', (error as Error).message);
  }
  return null;
}

export async function checkWagmiChangelog(
  storage: StorageProvider
): Promise<string | null> {
  const url = CHANGELOG_URLS.WAGMI_CORE;
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

          cleanText = cleanText
            .replace(/\[#\d+\]\([^)]+\)/g, '')
            .replace(/\[`[a-f0-9]+`\]\([^)]+\)/g, '')
            .replace(/Thanks \[@\w+\]\([^)]+\)!\s*-\s*/g, '')
            .replace(/\[\`[a-f0-9]{7,}\`\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

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
    const lastHash = await storage.getValue('wagmi');

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'wagmi',
        changelog: changelog.trim(),
        link: GITHUB_LINKS.WAGMI_CORE,
      });
      await storage.setValue('wagmi', contentHash);
      return summary;
    }
  } catch (error) {
    console.error('Wagmi check error:', (error as Error).message);
  }
  return null;
}

export async function checkViemChangelog(
  storage: StorageProvider
): Promise<string | null> {
  const url = CHANGELOG_URLS.VIEM;
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

          cleanText = cleanText
            .replace(/\[#\d+\]\([^)]+\)/g, '')
            .replace(/\[`[a-f0-9]+`\]\([^)]+\)/g, '')
            .replace(/Thanks \[@\w+\]\([^)]+\)!\s*-\s*/g, '')
            .replace(/\[\`[a-f0-9]{7,}\`\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

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
    const lastHash = await storage.getValue('viem');

    if (contentHash !== lastHash) {
      const summary = generateMessage({
        toolName: 'viem',
        changelog: changelog.trim(),
        link: GITHUB_LINKS.VIEM,
      });
      await storage.setValue('viem', contentHash);
      return summary;
    }
  } catch (error) {
    console.error('Viem check error:', (error as Error).message);
  }
  return null;
}
