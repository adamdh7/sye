// index.js (Cloudflare Worker - Telegram webhook)
// Mete sekrè TELEGRAM_BOT_TOKEN (wrangler secret put TELEGRAM_BOT_TOKEN)
// Li reponn /ping ak "pong" epi /start ak mesaj akey.

export default {
  async fetch(request, env, ctx) {
    // Quick healthcheck for browser
    if (request.method === 'GET') return new Response('ok', { status: 200 });

    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response('invalid json', { status: 400 });
    }

    const update = body;
    // Telegram updates can have message / edited_message / channel_post
    const msg = update.message || update.edited_message || update.channel_post;
    if (!msg) return new Response('no message', { status: 200 });

    const chatId = msg.chat?.id;
    const text = (msg.text || '').trim();
    if (!chatId || !text) return new Response('no chat or empty text', { status: 200 });

    // Commands: accept /ping and /start (with optional @BotUsername)
    if (/^\/ping(@\w+)?$/i.test(text)) {
      // Use waitUntil so worker can return immediately while request to Telegram happens
      ctx.waitUntil(sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'pong'));
    } else if (/^\/start(@\w+)?$/i.test(text)) {
      const name = msg.from?.first_name || 'zanmi';
      ctx.waitUntil(sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `Bon vini ${name}! Voye /ping pou teste.`));
    }

    // Always respond quickly to Telegram with 200
    return new Response('ok', { status: 200 });
  }
};

// Helper pou rele Telegram API
async function sendMessage(token, chat_id, text) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        text
      })
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('sendMessage failed', res.status, body);
    }
  } catch (err) {
    console.error('sendMessage error', err);
  }
}
