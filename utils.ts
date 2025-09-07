import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

export type StorageProvider = {
  getValue: (key: string, defaultValue?: string) => Promise<string>;
  setValue: (key: string, value: string) => Promise<void>;
};

export type EnvironmentProvider = {
  getTelegramToken: () => string;
  getChatId: () => string;
};

type TelegramPayload = {
  chat_id: string;
  text: string;
  parse_mode: string;
};

type Message = {
  toolName: string;
  changelog: string;
  link: string;
};

export function generateMessage({
  toolName,
  changelog,
  link,
}: Message): string {
  return `*${toolName} release*

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
        const parsed = JSON.parse(data);
        return parsed.value || defaultValue;
      } catch {
        return defaultValue;
      }
    },

    async setValue(key: string, value: string): Promise<void> {
      const filePath = getFilePath(key);
      await fs.writeFile(filePath, JSON.stringify({ value }), 'utf8');
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
