import { describe, it, expect } from 'bun:test';
import { generateMessage } from './utils';
import {
  checkClaudeCode,
  checkAISDK,
  checkWagmiChangelog,
  checkViemChangelog,
  checkCursor,
  CONFIG,
} from './changelog-checks';

function createMockStorage(): any {
  return {
    getValue: async () => '',
    setValue: async () => {},
  };
}

describe('Changelog Parsers', () => {
  describe('Claude Code', () => {
    it('should parse Claude changelog correctly', async () => {
      const storage = createMockStorage();
      const result = await checkClaudeCode(storage);

      expect(result).toBeTruthy();
      expect(result).toContain('*claude code release*');
      expect(result).toContain('https://github.com/anthropics/claude-code');
    });
  });

  describe('AI SDK', () => {
    it('should parse AI SDK changelog correctly', async () => {
      const storage = createMockStorage();
      const result = await checkAISDK(storage);

      expect(result).toBeTruthy();
      expect(result).toContain('*ai sdk release*');
      expect(result).toContain('https://github.com/vercel/ai');
    });
  });

  describe('Wagmi', () => {
    it('should parse Wagmi changelog correctly', async () => {
      const storage = createMockStorage();
      const result = await checkWagmiChangelog(storage);

      expect(result).toBeTruthy();
      expect(result).toContain('*wagmi release*');
      expect(result).toContain('https://github.com/wevm/wagmi');
    });
  });

  describe('Viem', () => {
    it('should parse Viem changelog correctly', async () => {
      const storage = createMockStorage();
      const result = await checkViemChangelog(storage);

      expect(result).toBeTruthy();
      expect(result).toContain('*viem release*');
      expect(result).toContain('https://github.com/wevm/viem');
    });
  });

  describe('Cursor', () => {
    it('should parse Cursor changelog correctly', async () => {
      const storage = createMockStorage();
      const result = await checkCursor(storage);

      expect(result).toBeTruthy();
      expect(result).toContain('*cursor release*');
      expect(result).toContain('https://cursor.com/changelog');
    });
  });

  describe('generateMessage utility', () => {
    it('should generate consistent message format', () => {
      const result = generateMessage({
        toolName: 'test tool',
        changelog: '• Fixed bug\n• Added feature',
        link: 'https://example.com/changelog',
      });

      const expected = `*test tool release*

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

      const expected = `*test tool release*



https://example.com/changelog`;

      expect(result).toBe(expected);
    });

    it('should remove trailing periods from bullet points', () => {
      const result = generateMessage({
        toolName: 'test tool',
        changelog: '• Fixed bug.\n• Added feature.',
        link: 'https://example.com/changelog',
      });

      const expected = `*test tool release*

• fixed bug
• added feature

https://example.com/changelog`;

      expect(result).toBe(expected);
    });

    it('should clean "thanks @user" patterns consistently', () => {
      const result = generateMessage({
        toolName: 'test tool',
        changelog:
          '• thanks @user! - Added feature\n• Thanks @another-user - Fixed bug',
        link: 'https://example.com/changelog',
      });

      const expected = `*test tool release*

• added feature
• fixed bug

https://example.com/changelog`;

      expect(result).toBe(expected);
    });

    it('should clean "thanks @user" with GitHub links', () => {
      const result = generateMessage({
        toolName: 'test tool',
        changelog:
          '• thanks @yutaro-mori-eng (https://github.com/yutaro-mori-eng)! - added tea sepolia\n• Thanks @user (https://github.com/user) - Fixed bug',
        link: 'https://example.com/changelog',
      });

      const expected = `*test tool release*

• added tea sepolia
• fixed bug

https://example.com/changelog`;

      expect(result).toBe(expected);
    });

    it('should clean markdown thanks patterns with hyphens in usernames', () => {
      const result = generateMessage({
        toolName: 'test tool',
        changelog:
          '• Thanks [@Yutaro-Mori-eng](https://github.com/Yutaro-Mori-eng)! - Added Tea Sepolia\n• Thanks [@user-name](https://github.com/user-name) - Fixed bug',
        link: 'https://example.com/changelog',
      });

      const expected = `*test tool release*

• added tea sepolia
• fixed bug

https://example.com/changelog`;

      expect(result).toBe(expected);
    });
  });
});
