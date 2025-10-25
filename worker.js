if (!globalThis.__TERGENE_WORKER_INITIALIZED) {
  globalThis.__TERGENE_WORKER_INITIALIZED = true;

  addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
  });

  const MAIN_TELEGRAM_TOKEN = (typeof globalThis.MAIN_TELEGRAM_TOKEN !== 'undefined') ? globalThis.MAIN_TELEGRAM_TOKEN : "8257458406:AAHSNSu6zv4XN80SXZgL8-ZooVn7N0JcchE";
  const GOOGLE_API_KEY = (typeof globalThis.GOOGLE_API_KEY !== 'undefined') ? globalThis.GOOGLE_API_KEY : "AIzaSyD7-VPQHG1q5-hS1pUfybggU4bgKAHAEmo";
  const GOOGLE_MODEL = "gemini-2.0";
  const GOOGLE_BASE = "https://generativelanguage.googleapis.com";
  const MAIN_TELEGRAM_API = `https://api.telegram.org/bot${MAIN_TELEGRAM_TOKEN}`;

  const MEMORY_DB = { users: {}, pending: {}, subscribers: [] };

  /* KV helpers (try bound USER_BOTS_KV; fallback memory) */
  async function kvGetRaw(key) {
    if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.get) {
      try { return await USER_BOTS_KV.get(key); } catch (e) { console.log('KV GET ERR', key, e && e.message); }
    }
    if (key === "subscribers") return JSON.stringify(MEMORY_DB.subscribers);
    if (key.startsWith("user:")) return JSON.stringify(MEMORY_DB.users[key.split(":")[1]] || null);
    if (key.startsWith("pending:")) return JSON.stringify(MEMORY_DB.pending[key.split(":")[1]] || null);
    if (key.startsWith("botByUsername:")) return JSON.stringify(MEMORY_DB.usersByUsername && MEMORY_DB.usersByUsername[key.split(":")[1]] || null);
    return null;
  }
  async function kvGet(key) {
    const raw = await kvGetRaw(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  async function kvPut(key, value) {
    if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.put) {
      try { await USER_BOTS_KV.put(key, JSON.stringify(value)); return true; } catch (e) { console.log('KV PUT ERR', key, e && e.message); }
    }
    if (key === "subscribers") { MEMORY_DB.subscribers = value; return true; }
    if (key.startsWith("user:")) { MEMORY_DB.users[key.split(":")[1]] = value; return true; }
    if (key.startsWith("pending:")) { MEMORY_DB.pending[key.split(":")[1]] = value; return true; }
    if (key.startsWith("botByUsername:")) {
      MEMORY_DB.usersByUsername = MEMORY_DB.usersByUsername || {};
      MEMORY_DB.usersByUsername[key.split(":")[1]] = value;
      return true;
    }
    return false;
  }
  async function kvDelete(key) {
    if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.delete) {
      try { await USER_BOTS_KV.delete(key); return true; } catch (e) { console.log('KV DELETE ERR', key, e && e.message); }
    }
    if (key === "subscribers") { MEMORY_DB.subscribers = []; return true; }
    if (key.startsWith("user:")) { delete MEMORY_DB.users[key.split(":")[1]]; return true; }
    if (key.startsWith("pending:")) { delete MEMORY_DB.pending[key.split(":")[1]]; return true; }
    if (key.startsWith("botByUsername:")) { if (MEMORY_DB.usersByUsername) delete MEMORY_DB.usersByUsername[key.split(":")[1]]; return true; }
    return false;
  }

  function isProbablyToken(text) { return /^\d+:[A-Za-z0-9_-]{35,}$/.test(text); }
  function genPendingId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
  function makeUniqueBotCode(user, botUser) {
    const base = (botUser.username || String(botUser.id || "bot")).toString().replace(/\W/g,'').slice(0,12);
    let code = base; let i = 1;
    while (user.bots && user.bots[code]) code = base + "" + i++;
    return code;
  }
  function escapeHtml(unsafe) { if (!unsafe) return ""; return unsafe.replace(/[&<>\"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[m]); }
  function findFirstUsername(text) { const m = text.match(/@([a-z0-9_]{5,})/i); return m ? m[1] : null; }
  function findAllUrls(text) { const r = text.match(/https?:\/\/\S+/ig); return r || []; }

  /* Telegram API helper with logging */
  async function callBotApiWithToken(token, method, body = {}) {
    const url = `https://api.telegram.org/bot${token}/${method}`;
    const opts = { method: "POST" };
    if (body instanceof FormData) opts.body = body;
    else { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify(body); }
    try {
      const res = await fetch(url, opts);
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      console.log('BOT API', method, 'status', res.status, 'ok', res.ok, 'data', data);
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      console.log('BOT API FETCH ERR', method, e && e.message);
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  }

  async function getMe(token) {
    const r = await callBotApiWithToken(token, "getMe", {});
    if (!r.ok || !r.data || !r.data.ok) return null;
    return r.data; // caller expects .result
  }

  async function sendMessageViaMain(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text };
    if (options.inline_keyboard) payload.reply_markup = { inline_keyboard: options.inline_keyboard };
    if (options.parse_mode) payload.parse_mode = options.parse_mode;
    try {
      const res = await fetch(`${MAIN_TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      try { const d = await res.json(); console.log('SEND MAIN', res.status, d); } catch(e){}
    } catch (e) { console.log("sendMessageViaMain error", e && e.message); }
  }

  async function answerCallback(callbackQueryId, text = "") {
    try {
      const res = await fetch(`${MAIN_TELEGRAM_API}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }) });
      try { const d = await res.json(); console.log('ANSWER CALLBACK', callbackQueryId, d); } catch(e){}
    } catch (e) { console.log("answerCallback error", e && e.message); }
  }

  const CALLBACK_MAP = {};
  function shortCallbackKey(pendingId, suffix, meta = {}) { const key = "p" + Math.random().toString(36).slice(2,8); CALLBACK_MAP[key] = { pendingId, suffix, meta }; return key; }
  function expandCallbackKey(k) { return CALLBACK_MAP[k] || null; }

  const TRANSLATIONS = {};

  async function savePending(userId, pending) { await kvPut(`pending:${pending.id}`, pending); }
  async function getPending(userId, pendingId) { return await kvGet(`pending:${pendingId}`); }
  async function removePending(userId, pendingId) { await kvDelete(`pending:${pendingId}`); }
  async function findPendingByState(userId, state) {
    for (const id of Object.keys(MEMORY_DB.pending)) {
      const p = MEMORY_DB.pending[id];
      if (p && p.fromId === userId && p.state === state) return p;
    }
    return null;
  }

  async function addSubscriberIfMissing(chatId) {
    const subs = (await kvGet("subscribers")) || [];
    const n = Number(chatId);
    if (!subs.includes(n)) { subs.push(n); await kvPut("subscribers", subs); }
  }
  async function getSubscribers() { return (await kvGet("subscribers")) || []; }

  /* Google AI call with logging */
  async function callGoogleAI(prompt, systemPrompt = "You are a helpful assistant.") {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith("<")) return { ok: false, error: "Google API key not configured" };
    try {
      const url = `${GOOGLE_BASE}/v1beta2/models/${GOOGLE_MODEL}:generateText?key=${GOOGLE_API_KEY}`;
      const body = { prompt: { text: `${systemPrompt}\n\n${prompt}` }, maxOutputTokens: 512 };
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const raw = await r.clone().text();
      console.log('GOOGLE AI HTTP', r.status, raw.slice(0,1000));
      const j = await r.json();
      if (!r.ok) return { ok: false, error: j };
      const txt = j.candidates && j.candidates[0] && j.candidates[0].content ? j.candidates[0].content : (j.output && j.output[0] && j.output[0].text ? j.output[0].text : '');
      return { ok: true, text: String(txt) };
    } catch (e) { console.log('GOOGLE AI ERR', e && e.message); return { ok: false, error: e && e.message ? e.message : String(e) }; }
  }

  /* Executor unchanged (keeps logging in callBotApiWithToken) */
  async function executeCommandAsBot(bot, ctx, cmdText) {
    try {
      const token = bot.token;
      const chatId = ctx.chatId;
      const replyTo = ctx.replyToMessageId;
      const parts = cmdText.split(/\s+/).filter(Boolean);
      const base = (parts[0]||'').toLowerCase();
      if (base === '/sip') {
        if (replyTo) return await callBotApiWithToken(token, 'deleteMessage', { chat_id: chatId, message_id: replyTo });
        return { ok:false, error:'No reply target to delete' };
      }
      if (base === '/sipli' || base === '/sipli@') {
        const target = parts[1] ? parts[1].replace(/^@/, '') : null;
        if (!target) return { ok:false, error:'No target specified' };
        if (/^\d+$/.test(target)) {
          return await callBotApiWithToken(token, 'banChatMember', { chat_id: chatId, user_id: Number(target) });
        }
        return { ok:false, error:'Username -> id resolution not implemented (provide numeric id or reply to the user)' };
      }
      if (base === '/sipyo') {
        const subs = await getSubscribers();
        for (const s of subs) { try { await callBotApiWithToken(token, 'banChatMember', { chat_id: chatId, user_id: s }); } catch(e){} }
        return { ok:true, data: 'Attempted bulk ban (best-effort).' };
      }
      if (base === '/lyen') {
        return await callBotApiWithToken(token, 'exportChatInviteLink', { chat_id: chatId });
      }
      return { ok:false, error:'Unknown command for executor' };
    } catch (e) { return { ok:false, error: e && e.message ? e.message : String(e) }; }
  }

  function buildCardKeyboardFromBody(body, pendingId) {
    const rows = [];
    const urls = findAllUrls(body);
    const username = findFirstUsername(body);
    if (username) rows.push([ { text: 'Lyen', url: `https://t.me/${username}` }, { text: 'Touch', callback_data: `touch:${shortCallbackKey(pendingId, 'touch@' + username)}` } ]);
    for (const u of urls.slice(0,3)) rows.push([ { text: 'Lyen', url: u }, { text: 'Touch', callback_data: `touch:${shortCallbackKey(pendingId, 'touch@' + u)}` } ]);
    rows.push([ { text: 'Yow', callback_data: `yow:${shortCallbackKey(pendingId, 'yow')}` } ]);
    return rows;
  }

  function buildCardText(title, body) {
    const lines = [];
    if (!body) body = '';
    if (body.includes('\n')) {
      const parts = body.split('\n').slice(0,6);
      for (const p of parts) { if (p.includes('|')) { const [l,r] = p.split('|'); lines.push([l.trim(), r.trim()]); } else lines.push([p.trim(), '']); }
    } else if (body.includes('|')) {
      const parts = body.split('|');
      for (let i=0;i<parts.length;i+=2) lines.push([ (parts[i]||'').trim(), (parts[i+1]||'').trim() ]);
    } else {
      const parts = body.split('.').map(s=>s.trim()).filter(Boolean).slice(0,4);
      for (let i=0;i<parts.length;i+=2) lines.push([parts[i]||'', parts[i+1]||'']);
    }
    if (!lines.length) lines.push(['','']);
    let txt = title ? `<b>${escapeHtml(title)}</b>\n\n<pre>` : '<pre>';
    const leftW = 16; const rightW = 24;
    for (const [l,r] of lines.slice(0,6)) { const left = (l||'').padEnd(leftW, ' '); const right = (r||'').slice(0,rightW); txt += `${escapeHtml(left)}${escapeHtml(right)}\n`; }
    txt += '</pre>'; return txt;
  }

  function formatResult(cmd, res, b) {
    const name = b && b.info && b.info.username ? "@" + b.info.username : (b && b.code ? b.code : "bot");
    if (res && res.ok && res.data && res.data.ok) {
      if (cmd === "notif_texte") return `Message sent as ${name}.`;
      return `Operation ${cmd} completed for ${name}.`;
    }
    const errMsg = (res && res.data && res.data.description) ? res.data.description : (res && res.error) ? res.error : "Unknown error";
    return `Error: ${errMsg}`;
  }

  async function executePending(userId, pending) {
    const chatId = pending.chatId;
    const user = await kvGet(`user:${userId}`);
    if (!user) { await sendMessageViaMain(chatId, "User storage missing."); return; }
    const code = pending.args && pending.args.code;
    if (!code || !user.bots || !user.bots[code]) { await sendMessageViaMain(chatId, TRANSLATIONS[user.lang]?.bot_list_empty || "No bots"); await removePending(userId, pending.id); return; }
    const b = user.bots[code];
    const cmd = pending.cmd;
    try {
      if (cmd === "notif_texte") {
        const textToSend = pending.args.text || "";
        if (!textToSend) { await sendMessageViaMain(chatId, TRANSLATIONS[user.lang]?.error + " no text"); await removePending(userId, pending.id); return; }
        const res = await callBotApiWithToken(b.token, "sendMessage", { chat_id: chatId, text: textToSend });
        await sendMessageViaMain(chatId, formatResult("notif_texte", res, b));
        await removePending(userId, pending.id);
        return;
      }
      if (cmd === "broadcast") {
        const mode = pending.args.broadcastMode;
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
          } catch (e) { console.log('BROADCAST SEND ERR', e && e.message); }
        }
        await sendMessageViaMain(chatId, TRANSLATIONS[user.lang]?.broadcast_done || "Broadcast done");
        await removePending(userId, pending.id);
        return;
      }
      await sendMessageViaMain(chatId, "Operation not implemented: " + cmd);
      await removePending(userId, pending.id);
    } catch (e) {
      await sendMessageViaMain(chatId, TRANSLATIONS[user.lang]?.error + " " + (e.message || String(e)));
      await removePending(userId, pending.id);
    }
  }

  async function sendBotList(chatId, user) {
    const lang = user.lang || "ky";
    const entries = Object.entries(user.bots || {});
    if (!entries.length) { await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.bot_list_empty || "No bots"); return; }
    const lines = entries.map(([code, b]) => { const uname = b.info?.username ? "@" + b.info.username : "(no username)"; return `${uname} — ${code}`; });
    const kb = entries.map(([code, b]) => (b.info?.username ? [{ text: `@${b.info.username}`, url: `https://t.me/${b.info.username}` }] : [{ text: `${code}`, callback_data: `noop:${code}` }]));
    await sendMessageViaMain(chatId, lines.join("\n"));
    await sendMessageViaMain(chatId, "Quick actions:", { inline_keyboard: kb });
  }

  async function handleCallbackQuery(cb) {
    const data = cb.data || "";
    const fromId = String(cb.from.id);
    const callbackId = cb.id;
    const chatId = cb.message?.chat?.id;
    console.log('CALLBACK', data, 'from', fromId);
    const firstColon = data.indexOf(':');
    let action = data; let payload = '';
    if (firstColon !== -1) { action = data.slice(0, firstColon); payload = data.slice(firstColon+1); }
    const expanded = expandCallbackKey(payload);
    let pendingId = expanded ? expanded.pendingId : null;
    let codeOrSuffix = expanded ? expanded.suffix : null;
    try {
      if (action === "cancel") { await removePending(fromId, pendingId || payload); await answerCallback(callbackId, "Cancelled"); if (chatId) await sendMessageViaMain(chatId, "Action cancelled."); return; }
      if (action === "noop") { await answerCallback(callbackId, "OK"); return; }
      // rest unchanged...
      await answerCallback(callbackId, "Unknown callback");
    } catch (e) { console.error('callback handler error', e); await answerCallback(callbackId, 'Error'); }
  }

  async function sendStartCard(chatId, fromId) {
    const user = await kvGet(`user:${fromId}`) || { lang: "ky" };
    const lang = user.lang || "ky";
    const kb = TRANSLATIONS[lang]?.start_buttons;
    await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.menu_title || "Menu", { inline_keyboard: kb });
  }

  async function sendHelp(chatId, fromId) {
    const user = await kvGet(`user:${fromId}`) || { lang: "ky" };
    const lang = user.lang || "ky";
    const tr = TRANSLATIONS[lang] || {};
    let text = `${tr.help_title || "Help"}\n\n${tr.help_intro || ""}\n\n`;
    for (const c of Object.keys(tr.help_commands || {})) text += `${c}\n${tr.help_commands[c]}\n\n`;
    await sendMessageViaMain(chatId, text);
  }

  async function handleTelegramMessage(update) {
    if (update.callback_query) return await handleCallbackQuery(update.callback_query);
    if (!update.message) return;
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = (msg.text || "").trim();
    console.log('INCOMING MSG', { chatId, userId, text, from: msg.from && (msg.from.username||msg.from.first_name) });
    await addSubscriberIfMissing(chatId);
    let user = await kvGet("user:" + userId);
    if (!user) { user = { lang: "ky", bots: {} }; await kvPut("user:" + userId, user); }
    const lang = user.lang || "ky";

    // pending flows + photo flows (unchanged) ...
    // (omitted for brevity in this snippet; keep same logic as original)

    // token registration
    if (isProbablyToken(text)) { return await registerNewBotFlow(userId, chatId, text, lang); }

    const parts = text.split(" ").filter(Boolean);
    const cmd = (parts[0] || "").toLowerCase();

    // simple commands (unchanged)...
    if (cmd === "/start") { await sendStartCard(chatId, userId); return; }
    if (cmd === "/lang") { const raw = parts.slice(1).join(" "); const mapped = mapLangInputToCode(raw); if (!mapped) { await sendMessageViaMain(chatId, "Use: /lang Kreyòl|Français|English|Español"); return; } user.lang = mapped; await kvPut("user:" + userId, user); await sendMessageViaMain(chatId, `${TRANSLATIONS[mapped]?.name || mapped} selected.`); return; }
    if (cmd === "/èd") { await sendHelp(chatId, userId); return; }
    if (cmd === "/bot" || cmd === "/nouvo_bot") { const token = parts[1] || ""; if (!token) { await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.ask_token_format || "Provide token"); return; } return await registerNewBotFlow(userId, chatId, token, lang); }
    if (cmd === "/lis_bot" || cmd === "/bot_mw") { await sendBotList(chatId, user); return; }
    if (cmd === "/mesaj") { const pendingId = genPendingId(); const pending = { id: pendingId, cmd: "broadcast", args: {}, fromId: userId, chatId, createdAt: Date.now() }; await savePending(userId, pending); if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.bot_list_empty || "No bots"); await removePending(userId, pendingId); return; } const kb = buildBotSelectionKeyboard(user.bots, pendingId); await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.choose_bot_prompt || "Choose bot:", { inline_keyboard: kb }); return; }

    // AI trigger: try KV mapping first
    const mentioned = findFirstUsername(text);
    let matchedBot = null;
    if (mentioned) {
      const rec = await kvGet(`botByUsername:${mentioned.toLowerCase()}`);
      if (rec && rec.owner) {
        const owner = await kvGet(`user:${rec.owner}`);
        if (owner && owner.bots && owner.bots[rec.code]) matchedBot = owner.bots[rec.code];
      } else {
        // fallback to memory scan (best-effort)
        for (const uid of Object.keys(MEMORY_DB.users)) {
          const u = MEMORY_DB.users[uid];
          if (!u || !u.bots) continue;
          for (const [code,b] of Object.entries(u.bots)) {
            if (b.info && b.info.username && b.info.username.toLowerCase() === mentioned.toLowerCase()) { matchedBot = b; break; }
          }
          if (matchedBot) break;
        }
      }
    }
    if (!matchedBot) {
      const lower = text.toLowerCase();
      // search KV index is better but fallback to memory
      for (const uid of Object.keys(MEMORY_DB.users)) {
        const u = MEMORY_DB.users[uid];
        if (!u || !u.bots) continue;
        for (const [code,b] of Object.entries(u.bots)) {
          const nameCandidates = [b.info?.first_name, b.info?.username, b.code].filter(Boolean).map(s=>String(s).toLowerCase());
          for (const cand of nameCandidates) if (cand && lower.includes(cand)) { matchedBot = b; break; }
          if (matchedBot) break;
        }
        if (matchedBot) break;
      }
    }

    if (matchedBot) {
      console.log('MATCHED BOT', matchedBot.code || matchedBot.info?.username);
      const aiConfig = matchedBot.aiConfig || { prompt: `Se yon asistan: reponn kout ak klè.`, name: (matchedBot.info?.username ? '@'+matchedBot.info.username : matchedBot.code) };
      const prompt = `User: ${msg.from.username || msg.from.first_name || msg.from.id} in chat ${chatId}\nMessage: ${text}\n\nRespond as ${aiConfig.name}. If you should perform an action on Telegram, output a single line starting with CMD: followed by the exact command (example: CMD:/sip reply). Otherwise reply normally.`;
      const aiRes = await callGoogleAI(prompt, aiConfig.prompt || `You are ${aiConfig.name} a Telegram bot helper.`);
      if (!aiRes.ok) { await sendMessageViaMain(chatId, `AI error: ${aiRes.error}`); return; }
      const replyText = String(aiRes.text || '').trim();
      console.log('AI REPLY', replyText.slice(0,1000));
      if (replyText.startsWith('CMD:')) {
        const cmdLine = replyText.split('\n')[0].slice(4).trim();
        const execCtx = { chatId, fromId: userId, messageId: msg.message_id, replyToMessageId: msg.reply_to_message && msg.reply_to_message.message_id };
        const execRes = await executeCommandAsBot(matchedBot, execCtx, cmdLine);
        await sendMessageViaMain(chatId, `AI executed: ${cmdLine} -> ${execRes && execRes.ok ? 'ok' : JSON.stringify(execRes)}`);
        return;
      }
      const sendRes = await callBotApiWithToken(matchedBot.token, 'sendMessage', { chat_id: chatId, text: replyText, reply_to_message_id: msg.message_id });
      if (!sendRes.ok) await sendMessageViaMain(chatId, 'Failed sending reply from bot (check token/rights)');
      return;
    }

    await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.unknown_cmd || "Unknown command");
  }

  async function registerNewBotFlow(userId, chatId, token, lang) {
    await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.token_checking || "Checking token...");
    const info = await getMe(token);
    if (!info || !info.ok) { await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.token_invalid || "Invalid token"); return; }
    const botUser = info.result;
    let user = await kvGet("user:" + userId);
    if (!user) user = { lang: "ky", bots: {} };
    const code = makeUniqueBotCode(user, botUser);
    user.bots[code] = { token, info: botUser, active: true, createdAt: Date.now(), code, mode: "bot", aiConfig: null };
    await kvPut("user:" + userId, user);
    if (botUser.username) await kvPut(`botByUsername:${botUser.username.toLowerCase()}`, { owner: userId, code });
    const username = botUser.username ? "@" + botUser.username : botUser.first_name || code;
    await sendMessageViaMain(chatId, `${TRANSLATIONS[lang]?.created_bot || "Created bot"} ${code} — ${username}`);
  }

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
  function buildConfirmKeyboard(pendingId, code) { const confirmKey = shortCallbackKey(pendingId, code); const cancelKey = shortCallbackKey(pendingId, "cancel"); return [[ { text: "Confirm", callback_data: `confirm:${confirmKey}` }, { text: "Cancel", callback_data: `cancel:${cancelKey}` } ]]; }
  function buildBroadcastTypeKeyboard(pendingId, lang) { const opts = TRANSLATIONS[lang]?.broadcast_options || ["Simple Text","Card"]; const rows = opts.map(o => [{ text: o, callback_data: `btype:${shortCallbackKey(pendingId,o)}` }]); rows.push([{ text: "Cancel", callback_data: `cancel:${shortCallbackKey(pendingId,'cancel')}` }]); return rows; }

  async function handleRequest(request) {
    if (request.method === "GET") return new Response("Telegram Worker active", { status: 200 });
    if (request.method === "POST") {
      try {
        const update = await request.json();
        await handleTelegramMessage(update);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      } catch (err) {
        console.log('HANDLE REQ ERR', err && err.message);
        return new Response(JSON.stringify({ ok: false, error: err && err.message ? err.message : String(err) }), { status: 500 });
      }
    }
    return new Response("Method not allowed", { status: 405 });
  }

  function mapLangInputToCode(input) {
    if (!input) return null;
    const s = input.trim().toLowerCase();
    if (["kreyòl","kreyol","ky"].includes(s)) return "ky";
    if (["français","francais","fr","french"].includes(s)) return "fr";
    if (["english","en","ang"].includes(s)) return "en";
    if (["español","espanol","es","spanish"].includes(s)) return "es";
    return null;
  }
  }
