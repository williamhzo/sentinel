import {
  checkClaudeCode,
  checkAISDK,
  checkCursor,
  checkV0,
  checkAIElements,
  checkWagmiChangelog,
  checkViemChangelog,
  sendTelegramMessage,
  createKVStorage,
  createWorkerEnvironment,
} from './utils';

interface Env {
  SENTINEL_KV: KVNamespace;
  TELEGRAM_TOKEN: string;
  CHAT_ID: string;
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const storage = createKVStorage(env.SENTINEL_KV);
    const environment = createWorkerEnvironment(env);

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

    if (claudeUpdate) await sendTelegramMessage(claudeUpdate, environment);
    if (cursorUpdate) await sendTelegramMessage(cursorUpdate, environment);
    if (v0Update) await sendTelegramMessage(v0Update, environment);
    if (elementsUpdate) await sendTelegramMessage(elementsUpdate, environment);
    if (aiSdkUpdate) await sendTelegramMessage(aiSdkUpdate, environment);
    if (wagmiUpdate) await sendTelegramMessage(wagmiUpdate, environment);
    if (viemUpdate) await sendTelegramMessage(viemUpdate, environment);
  },
};
