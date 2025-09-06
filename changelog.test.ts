import { describe, it, expect } from 'bun:test';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { generateMessage } from './utils';
import { CHANGELOG_URLS, GITHUB_LINKS } from './constants';

describe('Changelog Parsers', () => {
  describe('Claude Code', () => {
    it('should parse Claude changelog correctly', async () => {
      const url = CHANGELOG_URLS.CLAUDE;

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

      expect(version).toBeTruthy();
      expect(version).toMatch(/^\d+\.\d+(\.\d+)?$/);
      expect(changelog.trim()).toBeTruthy();

      const message = generateMessage({
        toolName: 'claude code',
        changelog: changelog.trim(),
        link: GITHUB_LINKS.CLAUDE,
      });

      expect(message).toContain('claude code release');
      expect(message).toContain('https://github.com/anthropics/claude-code');
    });
  });

  describe('AI SDK', () => {
    it('should parse AI SDK changelog correctly', async () => {
      const url = CHANGELOG_URLS.AI_SDK;

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

              if (isMeaningful || currentChangelog.split('\n').length < 4) {
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

      expect(version).toBeTruthy();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);

      const message = generateMessage({
        toolName: 'ai sdk',
        changelog: changelog.trim() || 'No significant changes found',
        link: GITHUB_LINKS.AI_SDK,
      });

      expect(message).toContain('ai sdk release');
      expect(message).toContain('https://github.com/vercel/ai');
    });
  });

  describe('Wagmi', () => {
    it('should parse Wagmi changelog correctly', async () => {
      const url = CHANGELOG_URLS.WAGMI_CORE;

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

      expect(version).toBeTruthy();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(changelog.trim()).toBeTruthy();

      const message = generateMessage({
        toolName: 'wagmi',
        changelog: changelog.trim(),
        link: GITHUB_LINKS.WAGMI_CORE,
      });

      expect(message).toContain('wagmi release');
      expect(message).toContain('https://github.com/wevm/wagmi');
    });
  });

  describe('Viem', () => {
    it('should parse Viem changelog correctly', async () => {
      const url = CHANGELOG_URLS.VIEM;

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

      expect(version).toBeTruthy();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(changelog.trim()).toBeTruthy();

      const message = generateMessage({
        toolName: 'viem',
        changelog: changelog.trim(),
        link: GITHUB_LINKS.VIEM,
      });

      expect(message).toContain('viem release');
      expect(message).toContain('https://github.com/wevm/viem');
    });
  });

  describe('Cursor', () => {
    it('should parse Cursor changelog correctly', async () => {
      const url = CHANGELOG_URLS.CURSOR;

      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      const mainEntrySelector = 'h2';
      const entries = $(mainEntrySelector);

      if (entries.length === 0) {
        expect.unreachable('No changelog entries found');
      }

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

      // Add blank line before summary sections
      changelog += '\n';

      // Find improvements and patches sections that come after the first h2 but before the next h2
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

      expect(mainTitle).toBeTruthy();
      expect(changelog.trim()).toBeTruthy();
      expect(changelog).toContain('•');

      const message = generateMessage({
        toolName: 'cursor',
        changelog: changelog.trim(),
        link: GITHUB_LINKS.CURSOR,
      });

      expect(message).toContain('cursor release');
      expect(message).toContain('https://cursor.com/changelog');
    });
  });

  describe('generateMessage utility', () => {
    it('should generate consistent message format', () => {
      const result = generateMessage({
        toolName: 'test tool',
        changelog: '• Fixed bug\n• Added feature',
        link: 'https://example.com/changelog',
      });

      const expected = `test tool release

• fixed bug
• added feature

https://example.com/changelog`;

      expect(result).toBe(expected);
    });

    it('should handle empty changelog', () => {
      const result = generateMessage({
        toolName: 'test tool',
        changelog: '',
        link: 'https://example.com/changelog',
      });

      const expected = `test tool release



https://example.com/changelog`;

      expect(result).toBe(expected);
    });
  });
});
