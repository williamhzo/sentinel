import {
  sendTelegramMessage,
  createFileSystemStorage,
  checkClaudeCode,
  checkAISDK,
  checkCursor,
  checkV0,
  checkAIElements,
  checkWagmiChangelog,
  checkViemChangelog,
  createBunEnvironment,
} from './utils';

const storage = createFileSystemStorage();
const env = createBunEnvironment();

const TELEGRAM_TOKEN = env.getTelegramToken();
const TELEGRAM_CHAT_ID = env.getChatId();

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error(
    'Missing required environment variables: TELEGRAM_TOKEN and CHAT_ID'
  );
  process.exit(1);
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
    checkClaudeCode(storage),
    checkCursor(storage),
    checkV0(storage),
    checkAIElements(storage),
    checkAISDK(storage),
    checkWagmiChangelog(storage),
    checkViemChangelog(storage),
  ]);

  if (claudeUpdate) await sendTelegramMessage(claudeUpdate, env);
  if (cursorUpdate) await sendTelegramMessage(cursorUpdate, env);
  if (v0Update) await sendTelegramMessage(v0Update, env);
  if (elementsUpdate) await sendTelegramMessage(elementsUpdate, env);
  if (aiSdkUpdate) await sendTelegramMessage(aiSdkUpdate, env);
  if (wagmiUpdate) await sendTelegramMessage(wagmiUpdate, env);
  if (viemUpdate) await sendTelegramMessage(viemUpdate, env);
})().catch(console.error);
