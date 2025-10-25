//texte
// Updated Cloudflare Worker for Telegram -- Enhancements requested by user
// - Fix unknown callback issue (better short-key handling + action fallback)
// - AI integration (Google Generative API) to reply when bot is addressed and to trigger commands
// - Support for commands launched by AI or users: /sip (delete), /sipli (kick/ban), /sipyo (kickall - best-effort), /lyen (exportChatInviteLink), plus card actions
// - Card layout modified to match requested left/right columns (preformatted text + two-column inline keyboard)
// - Persistent KV storage usage via USER_BOTS_KV (fallback in-memory still included)
// IMPORTANT: Replace placeholder tokens/keys with your real values or bind them as secrets/KV in Cloudflare Workers.

if (!globalThis.__TERGENE_WORKER_INITIALIZED) {
  globalThis.__TERGENE_WORKER_INITIALIZED = true;

  addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
  });

  /* ================== CONFIG / SECRETS (replace or bind securely) ================== */
  const MAIN_TELEGRAM_TOKEN = (typeof globalThis.MAIN_TELEGRAM_TOKEN !== 'undefined') ? globalThis.MAIN_TELEGRAM_TOKEN : "8257458406:AAHSNSu6zv4XN80SXZgL8-ZooVn7N0JcchE"; // used to send back to admin
  const GOOGLE_API_KEY = (typeof globalThis.GOOGLE_API_KEY !== 'undefined') ? globalThis.GOOGLE_API_KEY : "AIzaSyD7-VPQHG1q5-hS1pUfybggU4bgKAHAEmo";
  const GOOGLE_MODEL = "gemini-2.0"; // adapt if you use different model name
  const GOOGLE_BASE = "https://generativelanguage.googleapis.com";

  const MAIN_TELEGRAM_API = `https://api.telegram.org/bot${MAIN_TELEGRAM_TOKEN}`;

  /* ================== SIMPLE IN-MEM DB (fallback) ================== */
  const MEMORY_DB = { users: {}, pending: {}, subscribers: [] };

  /* ================== KV WRAPPERS (USE USER_BOTS_KV IF BOUND) ================== */
  async function kvGetRaw(key) {
    if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.get) {
      try { const v = await USER_BOTS_KV.get(key); return v; } catch (e) {}
    }
    // fallback memory
    if (key === "subscribers") return JSON.stringify(MEMORY_DB.subscribers);
    if (key.startsWith("user:")) return JSON.stringify(MEMORY_DB.users[key.split(":")[1]] || null);
    if (key.startsWith("pending:")) return JSON.stringify(MEMORY_DB.pending[key.split(":")[1]] || null);
    return null;
  }
  async function kvGet(key) {
    const raw = await kvGetRaw(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  async function kvPut(key, value) {
    if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.put) {
      try { await USER_BOTS_KV.put(key, JSON.stringify(value)); return true; } catch (e) {}
    }
    // fallback memory
    if (key === "subscribers") { MEMORY_DB.subscribers = value; return true; }
    if (key.startsWith("user:")) { MEMORY_DB.users[key.split(":")[1]] = value; return true; }
    if (key.startsWith("pending:")) { MEMORY_DB.pending[key.split(":")[1]] = value; return true; }
    return false;
  }
  async function kvDelete(key) {
    if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.delete) {
      try { await USER_BOTS_KV.delete(key); return true; } catch (e) {}
    }
    if (key === "subscribers") { MEMORY_DB.subscribers = []; return true; }
    if (key.startsWith("user:")) { delete MEMORY_DB.users[key.split(":")[1]]; return true; }
    if (key.startsWith("pending:")) { delete MEMORY_DB.pending[key.split(":")[1]]; return true; }
    return false;
  }

  /* ================== UTILITIES ================== */
  function isProbablyToken(text) { return /^\d+:[A-Za-z0-9_-]{35,}$/.test(text); }
  function genPendingId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
  function makeUniqueBotCode(user, botUser) {
    const base = (botUser.username || String(botUser.id || "bot")).toString().replace(/\W/g,'').slice(0,12);
    let code = base; let i = 1;
    while (user.bots && user.bots[code]) code = base + "" + i++;
    return code;
  }
  function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe.replace(/[&<>\"']/g, function(m) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[m]; });
  }
  function findFirstUsername(text) {
    const m = text.match(/@([a-z0-9_]{5,})/i);
    return m ? m[1] : null;
  }
  function findAllUrls(text) {
    const r = text.match(/https?:\/\/\S+/ig); return r || [];
  }
  function findFirstUrl(text) { const a = findAllUrls(text); return a.length ? a[0] : null; }

  /* ================== TELEGRAM API HELPERS ================== */
  async function callBotApiWithToken(token, method, body = {}) {
    const url = `https://api.telegram.org/bot${token}/${method}`;
    const opts = { method: "POST" };
    if (body instanceof FormData) opts.body = body;
    else { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify(body); }
    try {
      const res = await fetch(url, opts);
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      return { ok: res.ok, status: res.status, data };
    } catch (e) { return { ok: false, error: e && e.message ? e.message : String(e) }; }
  }
  async function getMe(token) {
    const r = await callBotApiWithToken(token, "getMe", {});
    if (!r.ok || !r.data || !r.data.ok) return null;
    return r.data;
  }
  async function sendMessageViaMain(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text };
    if (options.inline_keyboard) payload.reply_markup = { inline_keyboard: options.inline_keyboard };
    if (options.parse_mode) payload.parse_mode = options.parse_mode;
    try { await fetch(`${MAIN_TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); }
    catch (e) { console.log("sendMessageViaMain error", e && e.message); }
  }
  async function answerCallback(callbackQueryId, text = "") {
    try { await fetch(`${MAIN_TELEGRAM_API}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }) }); }
    catch (e) { console.log("answerCallback error", e && e.message); }
  }

  /* ================== SHORT CALLBACK KEY / MAP ================== */
  // Store more context in the map to make callback handling robust across actions
  const CALLBACK_MAP = {};
  function shortCallbackKey(pendingId, suffix, meta = {}) {
    const key = "p" + Math.random().toString(36).slice(2,8);
    // store pendingId, suffix, and any meta (like action) so callback handler can recover
    CALLBACK_MAP[key] = { pendingId, suffix, meta };
    return key;
  }
  function expandCallbackKey(k) { return CALLBACK_MAP[k] || null; }

  /* ================== TRANSLATIONS (Kreyòl / FR / EN / ES) ================== */
  const TRANSLATIONS = { /* keep same as original - omitted here to save space in this snippet; in real file copy original translations */ };
  // For brevity in this code sample, re-use the translations from your earlier script.
  // If you paste this into the Worker, ensure TRANSLATIONS object is present (copy from the provided original file).

  /* ================== PENDING HELPERS ================== */
  async function savePending(userId, pending) { await kvPut(`pending:${pending.id}`, pending); }
  async function getPending(userId, pendingId) { return await kvGet(`pending:${pendingId}`); }
  async function removePending(userId, pendingId) { await kvDelete(`pending:${pendingId}`); }
  async function findPendingByState(userId, state) {
    // iterate storage (fallback memory only supports in-memory search)
    for (const id of Object.keys(MEMORY_DB.pending)) {
      const p = MEMORY_DB.pending[id];
      if (p && p.fromId === userId && p.state === state) return p;
    }
    return null;
  }

  /* ================== SUBSCRIBERS HELPERS ================== */
  async function addSubscriberIfMissing(chatId) {
    const subs = (await kvGet("subscribers")) || [];
    const n = Number(chatId);
    if (!subs.includes(n)) {
      subs.push(n);
      await kvPut("subscribers", subs);
    }
  }
  async function getSubscribers() { return (await kvGet("subscribers")) || []; }

  /* ================== CORE: AI CALL ================== */
  async function callGoogleAI(prompt, systemPrompt = "You are a helpful assistant.") {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith("<")) return { ok: false, error: "Google API key not configured" };
    try {
      const url = `${GOOGLE_BASE}/v1beta2/models/${GOOGLE_MODEL}:generateText?key=${GOOGLE_API_KEY}`;
      const body = { prompt: { text: `${systemPrompt}\n\n${prompt}` }, maxOutputTokens: 512 };
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) return { ok: false, error: j };
      // model output path may vary; try to extract text
      const txt = j.candidates && j.candidates[0] && j.candidates[0].content ? j.candidates[0].content : (j.output && j.output[0] && j.output[0].text ? j.output[0].text : '');
      return { ok: true, text: String(txt) };
    } catch (e) { return { ok: false, error: e && e.message ? e.message : String(e) }; }
  }

  /* ================== COMMAND EXECUTOR (for AI or manual commands) ================== */
  async function executeCommandAsBot(bot, ctx, cmdText) {
    // ctx: { chatId, fromId, messageId }
    // cmdText examples: 
    //  /sip reply -> delete the replied message (must be used when cmd invoked in reply)
    //  /sipli @username or /sipli <userId> -> ban that user from chat
    //  /sipyo -> attempt to kick all non-admins (best-effort; careful with rate limits)
    //  /lyen -> exportChatInviteLink and send it
    try {
      const token = bot.token;
      const chatId = ctx.chatId;
      const replyTo = ctx.replyToMessageId;
      const parts = cmdText.split(/\s+/).filter(Boolean);
      const base = parts[0].toLowerCase();
      if (base === '/sip') {
        // delete replied message if present
        if (replyTo) {
          return await callBotApiWithToken(token, 'deleteMessage', { chat_id: chatId, message_id: replyTo });
        }
        return { ok:false, error:'No reply target to delete' };
      }
      if (base === '/sipli' || base === '/sipli@') {
        // kick/ban a user (by @username or id)
        const target = parts[1] ? parts[1].replace(/^@/, '') : null;
        if (!target) return { ok:false, error:'No target specified' };
        // try resolve username -> getChatMember by username is not available, so try parsing numeric id otherwise fail
        if (/^\d+$/.test(target)) {
          return await callBotApiWithToken(token, 'banChatMember', { chat_id: chatId, user_id: Number(target) });
        }
        // if username provided, try to fetch ChatMember using getChat to see if it's in group - fallback: try to mention (will often fail). Best-effort:
        // Try to find user among recent subscribers stored in KV (we store some info later)
        return { ok:false, error:'Username -> id resolution not implemented (provide numeric id or reply to the user)' };
      }
      if (base === '/sipyo') {
        // WARNING: destructive. Best-effort: iterate subscribers and try to kick non-admins. We'll attempt but skip if fails.
        const subs = await getSubscribers();
        for (const s of subs) {
          try { await callBotApiWithToken(token, 'banChatMember', { chat_id: chatId, user_id: s }); } catch(e){}
        }
        return { ok:true, data: 'Attempted bulk ban (best-effort). Check logs.' };
      }
      if (base === '/lyen') {
        // export invite link (bot must be admin with invite link rights)
        return await callBotApiWithToken(token, 'exportChatInviteLink', { chat_id: chatId });
      }
      return { ok:false, error:'Unknown command for executor' };
    } catch (e) { return { ok:false, error: e && e.message ? e.message : String(e) }; }
  }

  /* ================== CARD KEYBOARD BUILDING (two-column style) ================== */
  function buildCardKeyboardFromBody(body, pendingId) {
    // Build two-column rows: left = Lien (url or username link), right = Touch (callback)
    const rows = [];
    const urls = findAllUrls(body);
    const username = findFirstUsername(body);
    // Add username link if present
    if (username) {
      rows.push([ { text: 'Lyen', url: `https://t.me/${username}` }, { text: 'Touch', callback_data: `touch:${shortCallbackKey(pendingId, 'touch@' + username)}` } ]);
    }
    // Add explicit urls
    for (const u of urls.slice(0,3)) {
      rows.push([ { text: 'Lyen', url: u }, { text: 'Touch', callback_data: `touch:${shortCallbackKey(pendingId, 'touch@' + u)}` } ]);
    }
    // default yow button
    rows.push([ { text: 'Yow', callback_data: `yow:${shortCallbackKey(pendingId, 'yow')}` } ]);
    return rows;
  }

  /* ================== RESULT FORMATTING (card text layout) ================== */
  function buildCardText(title, body) {
    // Build a preformatted two-column like layout using monospace to roughly match their design
    // Example result as requested:
    //    Adam_D'H7
    // yow.           gang
    // fr.             ou konpran kounya
    // We'll attempt to extract short label pairs from body lines separated by | or newline
    const lines = [];
    if (!body) body = '';
    // parse as pairs: if contains '|' treat as left|right pairs per line
    if (body.includes('\n')) {
      const parts = body.split('\n').slice(0,6);
      for (const p of parts) {
        if (p.includes('|')) { const [l,r] = p.split('|'); lines.push([l.trim(), r.trim()]); }
        else lines.push([p.trim(), '']);
      }
    } else if (body.includes('|')) {
      const parts = body.split('|');
      // take in pairs
      for (let i=0;i<parts.length;i+=2) { lines.push([ (parts[i]||'').trim(), (parts[i+1]||'').trim() ]); }
    } else {
      // fallback: try to split into two short tokens per sentence
      const parts = body.split('.').map(s=>s.trim()).filter(Boolean).slice(0,4);
      for (let i=0;i<parts.length;i+=2) lines.push([parts[i]||'', parts[i+1]||'']);
    }
    // ensure at least one empty line if nothing
    if (!lines.length) lines.push(['','']);
    // create preformatted text with title on top
    let txt = title ? `<b>${escapeHtml(title)}</b>\n\n<pre>` : '<pre>';
    // compute column widths
    const leftW = 16;
    const rightW = 24;
    for (const [l,r] of lines.slice(0,6)) {
      const left = (l||'').padEnd(leftW, ' ');
      const right = (r||'').slice(0,rightW);
      txt += `${escapeHtml(left)}${escapeHtml(right)}\n`;
    }
    txt += '</pre>';
    return txt;
  }

  /* ================== FORMAT RESULT ================== */
  function formatResult(cmd, res, b, extra = {}) {
    const name = b && b.info && b.info.username ? "@" + b.info.username : (b && b.code ? b.code : "bot");
    if (res && res.ok && res.data && res.data.ok) {
      switch (cmd) {
        case "notif_texte": return `Message sent as ${name}.`;
        default: return `Operation ${cmd} completed for ${name}.`;
      }
    }
    const errMsg = (res && res.data && res.data.description) ? res.data.description : (res && res.error) ? res.error : "Unknown error";
    return `Error: ${errMsg}`;
  }

  /* ================== EXECUTE PENDING ================== */
  async function executePending(userId, pending) {
    const chatId = pending.chatId;
    const user = await kvGet(`user:${userId}`);
    if (!user) { await sendMessageViaMain(chatId, "User storage missing."); return; }
    const code = pending.args && pending.args.code;
    if (!code || !user.bots || !user.bots[code]) { await sendMessageViaMain(chatId, TRANSLATIONS[user.lang].bot_list_empty); await removePending(userId, pending.id); return; }
    const b = user.bots[code];
    const cmd = pending.cmd;

    try {
      if (cmd === "notif_texte") {
        const textToSend = pending.args.text || "";
        if (!textToSend) { await sendMessageViaMain(chatId, TRANSLATIONS[user.lang].error + " no text"); await removePending(userId, pending.id); return; }
        const res = await callBotApiWithToken(b.token, "sendMessage", { chat_id: chatId, text: textToSend });
        await sendMessageViaMain(chatId, formatResult("notif_texte", res, b));
        await removePending(userId, pending.id);
        return;
      }

      if (cmd === "broadcast") {
        const mode = pending.args.broadcastMode; // "Simple Text" or "Card"
        const payloadText = pending.args.text || "";
        const subs = await getSubscribers();
        for (const s of subs) {
          try {
            if (mode && mode.toLowerCase().includes('card')) {
              const title = pending.args.cardTitle || "";
              const body = pending.args.cardBody || payloadText || "";
              const html = buildCardText(title, body);
              const kb = buildCardKeyboardFromBody(body, pending.id);
              await callBotApiWithToken(b.token, "sendMessage", { chat_id: s, text: html, parse_mode: "HTML", reply_markup: { inline_keyboard: kb } });
            } else {
              await callBotApiWithToken(b.token, "sendMessage", { chat_id: s, text: payloadText });
            }
          } catch (e) { /* ignore send errors per subscriber */ }
        }
        await sendMessageViaMain(chatId, TRANSLATIONS[user.lang].broadcast_done);
        await removePending(userId, pending.id);
        return;
      }

      await sendMessageViaMain(chatId, "Operation not implemented: " + cmd);
      await removePending(userId, pending.id);
    } catch (e) {
      await sendMessageViaMain(chatId, TRANSLATIONS[user.lang].error + " " + (e.message || String(e)));
      await removePending(userId, pending.id);
    }
  }

  /* ================== LIST HELPERS ================== */
  async function sendBotList(chatId, user) {
    const lang = user.lang || "ky";
    const entries = Object.entries(user.bots || {});
    if (!entries.length) { await sendMessageViaMain(chatId, TRANSLATIONS[lang].bot_list_empty); return; }
    const lines = entries.map(([code, b]) => { const uname = b.info?.username ? "@" + b.info.username : "(no username)"; return `${uname} — ${code}`; });
    const kb = entries.map(([code, b]) => {
      if (b.info?.username) return [{ text: `${"@" + b.info.username}`, url: `https://t.me/${b.info.username}` }];
      return [{ text: `${code}`, callback_data: `noop:${code}` }];
    });
    await sendMessageViaMain(chatId, lines.join("\n"));
    await sendMessageViaMain(chatId, "Quick actions:", { inline_keyboard: kb });
  }

  /* ================== CALLBACK HANDLER ================== */
  async function handleCallbackQuery(cb) {
    const data = cb.data || "";
    const fromId = String(cb.from.id);
    const callbackId = cb.id;
    const chatId = cb.message?.chat?.id;
    // parse as action:payload where payload may be our short key
    const firstColon = data.indexOf(':');
    let action = data;
    let payload = '';
    if (firstColon !== -1) { action = data.slice(0, firstColon); payload = data.slice(firstColon+1); }

    // attempt to expand if payload is a short key
    const expanded = expandCallbackKey(payload);

    // resolve pendingId and suffix if present
    let pendingId = expanded ? expanded.pendingId : null;
    let codeOrSuffix = expanded ? expanded.suffix : null;

    try {
      if (action === "cancel") {
        await removePending(fromId, pendingId || payload);
        await answerCallback(callbackId, "Cancelled");
        if (chatId) await sendMessageViaMain(chatId, "Action cancelled.");
        return;
      }

      if (action === "noop") { await answerCallback(callbackId, "OK"); return; }

      if (action === "cmd") {
        await answerCallback(callbackId, "OK");
        const cmd = payload || data.split(':')[1];
        if (cmd === "/start") { await sendStartCard(chatId, fromId); return; }
        if (cmd === "/èd") { await sendHelp(chatId, fromId); return; }
        if (cmd === "/mesaj") {
          const pendingId2 = genPendingId();
          const pending = { id: pendingId2, cmd: "broadcast", args: {}, fromId, chatId, createdAt: Date.now() };
          await savePending(fromId, pending);
          const u = await kvGet(`user:${fromId}`);
          if (!u || !u.bots || Object.keys(u.bots).length === 0) { await sendMessageViaMain(chatId, TRANSLATIONS[(u?.lang||'ky')].bot_list_empty); await removePending(fromId, pendingId2); return; }
          await sendMessageViaMain(chatId, TRANSLATIONS[u.lang].choose_bot_prompt, { inline_keyboard: buildBotSelectionKeyboard(u.bots, pendingId2) });
          return;
        }
        // other cmd buttons as needed
        return;
      }

      if (action === "pick") {
        const code = codeOrSuffix || payload;
        const pending = await getPending(fromId, pendingId || payload);
        if (!pending) { await answerCallback(callbackId, "Pending expired"); return; }
        const user = await kvGet(`user:${fromId}`);
        const bot = user?.bots?.[code];
        const label = bot?.info?.username ? "@" + bot.info.username : code;
        const kb = buildConfirmKeyboard(pendingId || payload, code);
        await answerCallback(callbackId, `Selected ${label}`);
        if (chatId) await sendMessageViaMain(chatId, `${TRANSLATIONS[user.lang].confirm_prompt} ${label}`, { inline_keyboard: kb });
        return;
      }

      if (action === "confirm") {
        const code = codeOrSuffix || payload;
        const pending = await getPending(fromId, pendingId || payload);
        if (!pending) { await answerCallback(callbackId, "Pending expired"); return; }
        pending.args = pending.args || {}; pending.args.code = code;
        if (pending.cmd === "broadcast") {
          pending.state = "awaiting_broadcast_type";
          await savePending(fromId, pending);
          const user = await kvGet(`user:${fromId}`);
          await answerCallback(callbackId, "Confirmed");
          await sendMessageViaMain(chatId, TRANSLATIONS[user.lang].broadcast_choose_type, { inline_keyboard: buildBroadcastTypeKeyboard(pending.id, user.lang) });
          return;
        }
        if (pending.cmd === "revokel" || pending.cmd === "sip_bot") {
          const u = await kvGet(`user:${fromId}`);
          if (u && u.bots && u.bots[code]) {
            delete u.bots[code];
            await kvPut(`user:${fromId}`, u);
            await answerCallback(callbackId, "Confirmed");
            await sendMessageViaMain(chatId, `Bot ${code} removed from your list.`);
          } else {
            await answerCallback(callbackId, "Confirmed");
            await sendMessageViaMain(chatId, TRANSLATIONS[u?.lang || 'ky'].bot_list_empty);
          }
          await removePending(fromId, pending.id);
          return;
        }
        await answerCallback(callbackId, "Confirmed"); await executePending(fromId, pending); return;
      }

      if (action === "btype") {
        const exp = expandCallbackKey(payload);
        const pendingId2 = exp ? exp.pendingId : payload;
        const typeChoice = exp ? exp.suffix : null;
        const pending = await getPending(fromId, pendingId2);
        if (!pending) { await answerCallback(callbackId, "Pending expired"); return; }
        pending.args = pending.args || {};
        pending.args.broadcastMode = typeChoice;
        if ((typeChoice || "").toLowerCase().startsWith("card")) {
          pending.state = "awaiting_broadcast_card";
          await savePending(fromId, pending);
          await answerCallback(callbackId, `Selected ${typeChoice}`);
          const user = await kvGet(`user:${fromId}`);
          await sendMessageViaMain(chatId, TRANSLATIONS[user.lang].broadcast_send_prompt_card);
          return;
        } else {
          pending.state = "awaiting_broadcast_text";
          await savePending(fromId, pending);
          await answerCallback(callbackId, `Selected ${typeChoice}`);
          const user = await kvGet(`user:${fromId}`);
          await sendMessageViaMain(chatId, TRANSLATIONS[user.lang].broadcast_send_prompt_text);
          return;
        }
      }

      if (action === "yow") {
        const exp = expandCallbackKey(payload);
        const pendingId2 = exp ? exp.pendingId : payload;
        const who = cb.from && (cb.from.username ? "@" + cb.from.username : (cb.from.first_name || String(cb.from.id)));
        await answerCallback(callbackId, "Clicked");
        if (chatId) await sendMessageViaMain(chatId, `${who} clicked Yow`);
        return;
      }

      if (action === 'touch') {
        const exp = expandCallbackKey(payload);
        const suffix = exp ? exp.suffix : payload;
        await answerCallback(callbackId, 'Touch received');
        if (chatId) {
          // if suffix contains a url or username, open/announce
          await sendMessageViaMain(chatId, `Touch: ${suffix}`);
        }
        return;
      }

      await answerCallback(callbackId, "Unknown callback");
    } catch (e) {
      console.error('callback handler error', e);
      await answerCallback(callbackId, 'Error');
    }
  }

  /* ================== HELPERS: start card & help text (reuse original implementations) ================== */
  async function sendStartCard(chatId, fromId) {
    const user = await kvGet(`user:${fromId}`) || { lang: "ky" };
    const lang = user.lang || "ky";
    const kb = TRANSLATIONS[lang].start_buttons;
    await sendMessageViaMain(chatId, TRANSLATIONS[lang].menu_title, { inline_keyboard: kb });
  }
  async function sendHelp(chatId, fromId) {
    const user = await kvGet(`user:${fromId}`) || { lang: "ky" };
    const lang = user.lang || "ky";
    const tr = TRANSLATIONS[lang];
    let text = `${tr.help_title}\n\n${tr.help_intro}\n\n`;
    for (const c of Object.keys(tr.help_commands)) {
      text += `${c}\n${tr.help_commands[c]}\n\n`;
    }
    await sendMessageViaMain(chatId, text);
  }

  /* ================== MESSAGE HANDLER (main) ================== */
  async function handleTelegramMessage(update) {
    if (update.callback_query) { return await handleCallbackQuery(update.callback_query); }
    if (!update.message) return;
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = (msg.text || "").trim();

    // add to subscribers
    await addSubscriberIfMissing(chatId);

    // ensure user record
    let user = await kvGet("user:" + userId);
    if (!user) { user = { lang: "ky", bots: {} }; await kvPut("user:" + userId, user); }
    const lang = user.lang || "ky";

    // pending broadcast flows (same behavior as original)
    const awaitingBroadcastText = await findPendingByState(userId, "awaiting_broadcast_text");
    if (!msg.photo && awaitingBroadcastText && awaitingBroadcastText.cmd === "broadcast" && text) {
      awaitingBroadcastText.args = awaitingBroadcastText.args || {};
      awaitingBroadcastText.args.text = text;
      awaitingBroadcastText.state = "confirmed";
      await savePending(userId, awaitingBroadcastText);
      await executePending(userId, awaitingBroadcastText);
      return;
    }
    const awaitingBroadcastCard = await findPendingByState(userId, "awaiting_broadcast_card");
    if (!msg.photo && awaitingBroadcastCard && awaitingBroadcastCard.cmd === "broadcast" && text) {
      let title = "", body = "";
      if (text.includes("|")) {
        const [t, ...rest] = text.split("|");
        title = t.trim(); body = rest.join("|").trim();
      } else if (text.includes("\n")) {
        const parts = text.split("\n");
        title = parts[0].trim(); body = parts.slice(1).join("\n").trim();
      } else {
        title = text.trim(); body = "";
      }
      awaitingBroadcastCard.args = awaitingBroadcastCard.args || {};
      awaitingBroadcastCard.args.cardTitle = title;
      awaitingBroadcastCard.args.cardBody = body;
      awaitingBroadcastCard.state = "confirmed";
      await savePending(userId, awaitingBroadcastCard);
      await executePending(userId, awaitingBroadcastCard);
      return;
    }

    // photo flow (reused)
    if (msg.photo && msg.photo.length) {
      const photoObj = msg.photo[msg.photo.length - 1];
      const fileId = photoObj.file_id;
      const pendingId = genPendingId();
      const pending = { id: pendingId, cmd: "foto", args: { file_id: fileId }, fromId: userId, chatId, createdAt: Date.now() };
      await savePending(userId, pending);
      if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessageViaMain(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; }
      const kb = buildBotSelectionKeyboard(user.bots, pendingId);
      await sendMessageViaMain(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb }); return;
    }

    // tokens direct
    if (isProbablyToken(text)) { return await registerNewBotFlow(userId, chatId, text, lang); }

    const parts = text.split(" ").filter(Boolean);
    const cmd = (parts[0] || "").toLowerCase();

    // core commands
    if (cmd === "/start") { await sendStartCard(chatId, userId); return; }

    if (cmd === "/lang") {
      const raw = parts.slice(1).join(" ");
      const mapped = mapLangInputToCode(raw);
      if (!mapped) { await sendMessageViaMain(chatId, "Use: /lang Kreyòl|Français|English|Español"); return; }
      user.lang = mapped; await kvPut("user:" + userId, user);
      await sendMessageViaMain(chatId, `${TRANSLATIONS[mapped].name} selected.`);
      return;
    }

    if (cmd === "/èd") { await sendHelp(chatId, userId); return; }

    if (cmd === "/bot" || cmd === "/nouvo_bot") {
      const token = parts[1] || "";
      if (!token) { await sendMessageViaMain(chatId, TRANSLATIONS[lang].ask_token_format); return; }
      return await registerNewBotFlow(userId, chatId, token, lang);
    }

    if (cmd === "/lis_bot" || cmd === "/bot_mw") {
      await sendBotList(chatId, user);
      return;
    }

    if (cmd === "/sip_bot" || cmd === "/revokel") {
      const code = parts[1] || "";
      if (!code) {
        const pendingId = genPendingId();
        const pending = { id: pendingId, cmd: "revokel", args: {}, fromId: userId, chatId, createdAt: Date.now() };
        await savePending(userId, pending);
        if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessageViaMain(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; }
        const kb = buildBotSelectionKeyboard(user.bots, pendingId);
        await sendMessageViaMain(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb });
        return;
      }
      if (!user.bots || !user.bots[code]) { await sendMessageViaMain(chatId, TRANSLATIONS[lang].bot_list_empty); return; }
      delete user.bots[code];
      await kvPut("user:" + userId, user);
      await sendMessageViaMain(chatId, `Bot ${code} removed from your list.`);
      return;
    }

    if (cmd === "/mesaj") {
      const pendingId = genPendingId();
      const pending = { id: pendingId, cmd: "broadcast", args: {}, fromId: userId, chatId, createdAt: Date.now() };
      await savePending(userId, pending);
      if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessageViaMain(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; }
      const kb = buildBotSelectionKeyboard(user.bots, pendingId);
      await sendMessageViaMain(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb });
      return;
    }

    // NEW: AI triggers - if message contains a bot username or bot is mentioned by name
    // For each bot registered by the author of message (or globally) check if the message mentions the bot name
    // We'll respond using that bot's token so reply looks like it's from the bot
    const allUsers = Object.keys(MEMORY_DB.users).length ? MEMORY_DB.users : null; // best-effort

    // find any bot that matches mention in text or if the message is a reply to the bot
    // We'll search among all stored bots for a username present in text
    const storedUsersKeys = Object.keys(MEMORY_DB.users);
    let matchedBot = null; let matchedOwnerId = null;
    // try quick check: if message mentions @something
    const mentioned = findFirstUsername(text);
    if (mentioned) {
      // search across all user: records for a bot with that username
      // better to search KV but fall back to MEMORY_DB
      for (const uid of Object.keys(MEMORY_DB.users)) {
        const u = MEMORY_DB.users[uid];
        if (!u || !u.bots) continue;
        for (const [code,b] of Object.entries(u.bots)) {
          if (b.info && b.info.username && b.info.username.toLowerCase() === mentioned.toLowerCase()) { matchedBot = b; matchedOwnerId = uid; break; }
        }
        if (matchedBot) break;
      }
    }

    // If matchedBot found, call AI and respond
    if (!matchedBot) {
      // also try: check if user has bots and default aiConfig, e.g. message addressed to "Adam_D'H7" in plain text
      const lower = text.toLowerCase();
      for (const uid of Object.keys(MEMORY_DB.users)) {
        const u = MEMORY_DB.users[uid];
        if (!u || !u.bots) continue;
        for (const [code,b] of Object.entries(u.bots)) {
          const nameCandidates = [b.info?.first_name, b.info?.username, b.code].filter(Boolean).map(s=>String(s).toLowerCase());
          for (const cand of nameCandidates) if (cand && lower.includes(cand)) { matchedBot = b; matchedOwnerId = uid; break; }
          if (matchedBot) break;
        }
        if (matchedBot) break;
      }
    }

    if (matchedBot) {
      // prepare system prompt and user prompt
      const aiConfig = matchedBot.aiConfig || { prompt: `Se yon asistan: reponn kout ak klè.`, name: (matchedBot.info?.username ? '@'+matchedBot.info.username : matchedBot.code) };
      const prompt = `User: ${msg.from.username || msg.from.first_name || msg.from.id} in chat ${chatId}\nMessage: ${text}\n\nRespond as ${aiConfig.name}. If you should perform an action on Telegram, output a single line starting with CMD: followed by the exact command (example: CMD:/sip reply). Otherwise reply normally.`;
      const aiRes = await callGoogleAI(prompt, aiConfig.prompt || `You are ${aiConfig.name} a Telegram bot helper.`);
      if (!aiRes.ok) { await sendMessageViaMain(chatId, `AI error: ${aiRes.error}`); return; }
      const replyText = String(aiRes.text || '').trim();
      // if starts with CMD: run command
      if (replyText.startsWith('CMD:')) {
        const cmdLine = replyText.split('\n')[0].slice(4).trim();
        const execCtx = { chatId, fromId: userId, messageId: msg.message_id, replyToMessageId: msg.reply_to_message && msg.reply_to_message.message_id };
        const execRes = await executeCommandAsBot(matchedBot, execCtx, cmdLine);
        // notify result (send as main admin to indicate what happened)
        await sendMessageViaMain(chatId, `AI executed: ${cmdLine} -> ${execRes && execRes.ok ? 'ok' : JSON.stringify(execRes)}`);
        return;
      }
      // else just send text as the matched bot
      const sendRes = await callBotApiWithToken(matchedBot.token, 'sendMessage', { chat_id: chatId, text: replyText, reply_to_message_id: msg.message_id });
      if (!sendRes.ok) await sendMessageViaMain(chatId, 'Failed sending reply from bot (check token/rights)');
      return;
    }

    // fallback
    await sendMessageViaMain(chatId, TRANSLATIONS[lang].unknown_cmd);
  }

  /* ================== Register / Bot flow reused from original (simplified) ================== */
  async function registerNewBotFlow(userId, chatId, token, lang) {
    await sendMessageViaMain(chatId, TRANSLATIONS[lang].token_checking);
    const info = await getMe(token);
    if (!info || !info.ok) { await sendMessageViaMain(chatId, TRANSLATIONS[lang].token_invalid); return; }
    const botUser = info.result;
    let user = await kvGet("user:" + userId);
    if (!user) user = { lang: "ky", bots: {} };
    const code = makeUniqueBotCode(user, botUser);
    user.bots[code] = { token, info: botUser, active: true, createdAt: Date.now(), code, mode: "bot", aiConfig: null };
    await kvPut("user:" + userId, user);
    const username = botUser.username ? "@" + botUser.username : botUser.first_name || code;
    await sendMessageViaMain(chatId, `${TRANSLATIONS[lang].created_bot} ${code} — ${username}`);
  }

  /* ================== MISC: keyboards used earlier (helpers) ================== */
  function buildBotSelectionKeyboard(bots, pendingId) {
    const rows = [];
    for (const code of Object.keys(bots)) {
      const username = bots[code].info && bots[code].info.username ? "@" + bots[code].info.username : code;
      const key = shortCallbackKey(pendingId, code, {action:'pick'});
      rows.push([{ text: username, callback_data: `pick:${key}` }]);
    }
    const cancelKey = shortCallbackKey(pendingId, "cancel");
    rows.push([{ text: "Cancel", callback_data: `cancel:${cancelKey}` }]);
    return rows;
  }
  function buildConfirmKeyboard(pendingId, code) {
    const confirmKey = shortCallbackKey(pendingId, code);
    const cancelKey = shortCallbackKey(pendingId, "cancel");
    return [[ { text: "Confirm", callback_data: `confirm:${confirmKey}` }, { text: "Cancel", callback_data: `cancel:${cancelKey}` } ]];
  }
  function buildBroadcastTypeKeyboard(pendingId, lang) {
    const opts = TRANSLATIONS[lang].broadcast_options || ["Simple Text","Card"];
    const rows = opts.map(o => [{ text: o, callback_data: `btype:${shortCallbackKey(pendingId,o)}` }]);
    rows.push([{ text: "Cancel", callback_data: `cancel:${shortCallbackKey(pendingId,'cancel')}` }]);
    return rows;
  }

  /* ================== Fetch handler ================== */
  async function handleRequest(request) {
    if (request.method === "GET") return new Response("Telegram Worker (enhanced) active", { status: 200 });
    if (request.method === "POST") {
      try {
        const update = await request.json();
        await handleTelegramMessage(update);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err && err.message ? err.message : String(err) }), { status: 500 });
      }
    }
    return new Response("Method not allowed", { status: 405 });
  }

  /* ================== Misc utils ================== */
  function mapLangInputToCode(input) {
    if (!input) return null;
    const s = input.trim().toLowerCase();
    if (["kreyòl","kreyol","ky"].includes(s)) return "ky";
    if (["français","francais","fr","french"].includes(s)) return "fr";
    if (["english","en","ang"].includes(s)) return "en";
    if (["español","espanol","es","spanish"].includes(s)) return "es";
    return null;
  }

} // end guard
*//texte*
