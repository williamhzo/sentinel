import {
  sendTelegramMessage,
  createFileSystemStorage,
  createKVStorage,
  createBunEnvironment,
  createWorkerEnvironment,
} from './utils';
import {
  checkClaudeCode,
  checkAISDK,
  checkCursor,
  checkV0,
  checkAIElements,
  checkWagmiChangelog,
  checkViemChangelog,
} from './changelog-checks';

interface WorkerEnv {
  SENTINEL_KV: KVNamespace;
  TELEGRAM_TOKEN: string;
  CHAT_ID: string;
}

async function runChecks(storage: any, env: any): Promise<void> {
  const [
    claudeUpdate,
    cursorUpdate,
    v0Update,
    elementsUpdate,
    aiSdkUpdate,
    wagmiUpdate,
    viemUpdate,
  ] = await Promise.all([
    checkClaudeCode(storage),
    checkCursor(storage),
    checkV0(storage),
    checkAIElements(storage),
    checkAISDK(storage),
    checkWagmiChangelog(storage),
    checkViemChangelog(storage),
  ]);

  // PAUSED: Telegram notifications disabled. Uncomment to resume.
  // if (claudeUpdate) await sendTelegramMessage(claudeUpdate, env);
  // if (cursorUpdate) await sendTelegramMessage(cursorUpdate, env);
  // if (v0Update) await sendTelegramMessage(v0Update, env);
  // if (elementsUpdate) await sendTelegramMessage(elementsUpdate, env);
  // if (aiSdkUpdate) await sendTelegramMessage(aiSdkUpdate, env);
  // if (wagmiUpdate) await sendTelegramMessage(wagmiUpdate, env);
  // if (viemUpdate) await sendTelegramMessage(viemUpdate, env);
}

function isWorkerEnvironment(): boolean {
  return typeof (globalThis as any).ScheduledEvent !== 'undefined';
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    const storage = createKVStorage(env.SENTINEL_KV);
    const environment = createWorkerEnvironment(env);
    await runChecks(storage, environment);
  },
};

if (!isWorkerEnvironment()) {
  const storage = createFileSystemStorage();
  const env = createBunEnvironment();

  const TELEGRAM_TOKEN = env.getTelegramToken();
  const CHAT_ID = env.getChatId();

  if (!TELEGRAM_TOKEN || !CHAT_ID) {
    console.error(
      'Missing required environment variables: TELEGRAM_TOKEN and CHAT_ID'
    );
    process.exit(1);
  }

  runChecks(storage, env).catch(console.error);
}
