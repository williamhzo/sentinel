import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import type { StorageProvider, EnvironmentProvider } from './utils';
import { generateMessage } from './utils';

export const CONFIG = {
  CLAUDE: {
    url: 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md',
    link: 'https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md',
    name: 'claude code',
  },
  AI_SDK: {
    url: 'https://raw.githubusercontent.com/vercel/ai/main/packages/ai/CHANGELOG.md',
    link: 'https://github.com/vercel/ai/blob/main/packages/ai/CHANGELOG.md',
    name: 'ai sdk',
  },
  WAGMI: {
    url: 'https://raw.githubusercontent.com/wevm/wagmi/refs/heads/main/packages/core/CHANGELOG.md',
    link: 'https://github.com/wevm/wagmi/blob/main/packages/core/CHANGELOG.md',
    name: 'wagmi',
  },
  VIEM: {
    url: 'https://raw.githubusercontent.com/wevm/viem/refs/heads/main/src/CHANGELOG.md',
    link: 'https://github.com/wevm/viem/blob/main/src/CHANGELOG.md',
    name: 'viem',
  },
  CURSOR: {
    url: 'https://cursor.com/changelog',
    link: 'https://cursor.com/changelog',
    name: 'cursor',
  },
  VERCEL: {
    url: 'https://vercel.com/changelog',
    link: 'https://vercel.com/changelog',
    name: 'vercel',
  },
} as const;

function cleanChangelogText(text: string): string {
  return text
    .replace(/\[#\d+\]\([^)]+\)/g, '')
    .replace(/\[`[a-f0-9]+`\]\([^)]+\)/g, '')
    .replace(/Thanks \[@[\w-]+\]\([^)]+\)!?\s*-\s*/g, '')
    .replace(/thanks @[\w-]+(\s*\([^)]+\))?\s*!?\s*-\s*/gi, '')
    .replace(/\[\`[a-f0-9]{7,}\`\]/g, '')
    .replace(/^(feat|fix|chore)\s*(\([^)]+\))?\s*:\s*/i, '')
    .replace(/^-\s*/, '')
    .replace(/\.\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidChangelogEntry(text: string): boolean {
  return (
    text.length > 8 &&
    !text.toLowerCase().includes('thanks @') &&
    !text.startsWith('Updated dependencies') &&
    !text.startsWith('@') &&
    !text.match(/^[a-f0-9]{7,}/) &&
    !text.includes('core@') &&
    !text.includes('connectors@') &&
    text !== '-' &&
    !text.match(/^#{1,6}\s/) &&
    !text.match(/^\[.*\]:$/)
  );
}

function isMeaningfulChange(text: string): boolean {
  const meaningfulWords = [
    'feat',
    'fix',
    'add',
    'improve',
    'support',
    'throw',
    'when',
    'error',
    'callback',
    'sent',
    'remove',
    'update',
    'change',
  ];
  return meaningfulWords.some((word) => text.includes(word));
}

async function parseMarkdownChangelog(
  url: string,
  storageKey: string,
  storage: StorageProvider,
  options: {
    versionPattern?: RegExp;
    simpleFormat?: boolean;
    complexFiltering?: boolean;
  } = {}
): Promise<{ version: string; changelog: string } | null> {
  try {
    const { data } = await axios.get(url);
    const lines = data.split('\n');
    const versionPattern = options.versionPattern || /^##\s+\d+\.\d+\.\d+/;

    if (options.simpleFormat) {
      return parseSimpleChangelog(lines);
    }

    if (options.complexFiltering) {
      return parseComplexChangelog(lines, versionPattern);
    }

    return parseStandardChangelog(lines, versionPattern);
  } catch (error) {
    console.error(
      `Changelog parse error for ${storageKey}:`,
      (error as Error).message
    );
    return null;
  }
}

function parseSimpleChangelog(lines: string[]) {
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

  return version ? { version, changelog } : null;
}

function parseStandardChangelog(lines: string[], versionPattern: RegExp) {
  let version = '';
  let changelog = '';
  let foundFirstEntry = false;

  for (const line of lines) {
    if (line.match(versionPattern)) {
      if (foundFirstEntry) break;
      version = line.replace(/^##\s+/, '').trim();
      foundFirstEntry = true;
      continue;
    }

    if (foundFirstEntry) {
      const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
      if (bulletMatch && bulletMatch[2]) {
        const [, indentation = '', bulletText] = bulletMatch;
        const cleanText = cleanChangelogText(bulletText);

        if (isValidChangelogEntry(cleanText)) {
          const prefix = indentation.length > 2 ? '  • ' : '• ';
          changelog += `${prefix}${cleanText}\n`;
        }
      }
    }
  }

  return version ? { version, changelog } : null;
}

function parseComplexChangelog(lines: string[], versionPattern: RegExp) {
  let version = '';
  let changelog = '';
  let currentVersion = '';
  let currentChangelog = '';
  let foundVersionWithChanges = false;

  for (const line of lines) {
    if (line.match(versionPattern)) {
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
      if (bulletMatch && bulletMatch[2]) {
        const [, indentation = '', bulletText] = bulletMatch;
        let cleanText = bulletText.trim();

        const commitHashMatch = cleanText.match(/^[a-f0-9]{7,}:\s*(.+)$/);
        if (commitHashMatch && commitHashMatch[1]) {
          cleanText = commitHashMatch[1];
        }

        if (isValidChangelogEntry(cleanText)) {
          const shouldInclude =
            isMeaningfulChange(cleanText) ||
            currentChangelog.split('\n').length < 4;

          if (shouldInclude) {
            cleanText = cleanChangelogText(cleanText);
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

  return version ? { version, changelog } : null;
}

function createChangelogChecker(
  config: (typeof CONFIG)[keyof typeof CONFIG],
  storageKey: string,
  parseOptions?: Parameters<typeof parseMarkdownChangelog>[3]
) {
  return async (storage: StorageProvider): Promise<string | null> => {
    const result = await parseMarkdownChangelog(
      config.url,
      storageKey,
      storage,
      parseOptions
    );
    if (!result) return null;

    const contentHash = crypto
      .createHash('sha256')
      .update(result.version + result.changelog)
      .digest('hex');
    const lastHash = await storage.getValue(storageKey);

    if (contentHash !== lastHash) {
      await storage.setValue(storageKey, contentHash);
      return generateMessage({
        toolName: config.name,
        changelog: result.changelog.trim(),
        link: config.link,
      });
    }
    return null;
  };
}

export const checkClaudeCode = createChangelogChecker(CONFIG.CLAUDE, 'claude', {
  versionPattern: /^##\s+\d+\.\d+(\.\d+)?$/,
  simpleFormat: true,
});

export const checkAISDK = createChangelogChecker(CONFIG.AI_SDK, 'aiSdk', {
  complexFiltering: true,
});

export const checkWagmiChangelog = createChangelogChecker(
  CONFIG.WAGMI,
  'wagmi'
);

export const checkViemChangelog = createChangelogChecker(CONFIG.VIEM, 'viem');

export async function checkCursor(
  storage: StorageProvider
): Promise<string | null> {
  try {
    const { data } = await axios.get(CONFIG.CURSOR.url);
    const $ = cheerio.load(data);

    const entries = $('h2');
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
      await storage.setValue('cursor', contentHash);
      return generateMessage({
        toolName: CONFIG.CURSOR.name,
        changelog: changelog.trim(),
        link: CONFIG.CURSOR.link,
      });
    }
  } catch (error) {
    console.error('Cursor check error:', (error as Error).message);
  }
  return null;
}

function parseVercelChangelog(
  data: string,
  targetKeywords: string[]
): { title: string; date: string; changelog: string } | null {
  const $ = cheerio.load(data);
  const entries = $('article');

  for (let i = 0; i < Math.min(10, entries.length); i++) {
    const entry = $(entries[i]);
    const titleElem = entry.find('h2:first');
    const title = titleElem.text().trim();

    if (
      targetKeywords.some((keyword) => title.toLowerCase().includes(keyword))
    ) {
      const dateText = entry.find('p').text();
      const dateMatch = dateText.match(/(\w+ \d{1,2}(?:st|nd|rd|th)?, \d{4})/);
      const date = dateMatch
        ? dateMatch[0]
        : new Date().toISOString().slice(0, 10);
      const body = entry
        .find('p, ul > li')
        .map((_, el) => $(el).text().trim())
        .get()
        .join(' ')
        .slice(0, 300);

      return { title: titleElem.text().trim(), date, changelog: body };
    }
  }

  return null;
}

export async function checkV0(
  storage: StorageProvider
): Promise<string | null> {
  try {
    const { data } = await axios.get(CONFIG.VERCEL.url);
    const latestEntry = parseVercelChangelog(data, ['v0']);
    if (!latestEntry) return null;

    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(latestEntry))
      .digest('hex');
    const lastHash = await storage.getValue('v0');

    if (contentHash !== lastHash) {
      await storage.setValue('v0', contentHash);
      return generateMessage({
        toolName: 'v0',
        changelog: latestEntry.title,
        link: CONFIG.VERCEL.link,
      });
    }
  } catch (error) {
    console.error('v0 check error:', (error as Error).message);
  }
  return null;
}

export async function checkAIElements(
  storage: StorageProvider
): Promise<string | null> {
  try {
    const { data } = await axios.get(CONFIG.VERCEL.url);
    const latestEntry = parseVercelChangelog(data, [
      'ai elements',
      'elements',
      'ai-elements',
    ]);
    if (!latestEntry) return null;

    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(latestEntry))
      .digest('hex');
    const lastHash = await storage.getValue('elements');

    if (contentHash !== lastHash) {
      await storage.setValue('elements', contentHash);
      return generateMessage({
        toolName: 'ai elements',
        changelog: latestEntry.title,
        link: CONFIG.VERCEL.link,
      });
    }
  } catch (error) {
    console.error('AI Elements check error:', (error as Error).message);
  }
  return null;
}
