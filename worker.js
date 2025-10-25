// Telegram Worker — korije & amelyore (AI + commands + cards + kv fallback)
if (!globalThis.__TERGENE_WORKER_INITIALIZED) {
  globalThis.__TERGENE_WORKER_INITIALIZED = true;

  addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
  });

  /* ========== CONFIG / SECRETS ========== */
  // NOTE: If these are exposed publicly, regenerate them now.
  const MAIN_TELEGRAM_TOKEN = (typeof globalThis.MAIN_TELEGRAM_TOKEN !== 'undefined') ? globalThis.MAIN_TELEGRAM_TOKEN : "8346530009:AAG6gd7P8yjtCyI4Tf258Fth7FayMJl0sr8";
  const GOOGLE_API_KEY = (typeof globalThis.GOOGLE_API_KEY !== 'undefined') ? globalThis.GOOGLE_API_KEY : "AIzaSyD7-VPQHG1q5-hS1pUfybggU4bgKAHAEmo";
  const GOOGLE_MODEL = "gemini-2.0-flash";
  const GOOGLE_BASE = "https://generativelanguage.googleapis.com";
  const MAIN_TELEGRAM_API = `https://api.telegram.org/bot${MAIN_TELEGRAM_TOKEN}`;

  /* ========== IN-MEM Fallback DB ========== */
  const MEMORY_DB = { users: {}, pending: {}, subscribers: [], botByUsername: {} };

  /* ========== KV WRAPPERS (USER_BOTS_KV optional) ========== */
  async function kvGetRaw(key) {
    if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.get) {
      try { return await USER_BOTS_KV.get(key); } catch (e) { console.log('KV GET ERR', key, e && e.message); }
    }
    if (key === "subscribers") return JSON.stringify(MEMORY_DB.subscribers);
    if (key.startsWith("user:")) return JSON.stringify(MEMORY_DB.users[key.split(":")[1]] || null);
    if (key.startsWith("pending:")) return JSON.stringify(MEMORY_DB.pending[key.split(":")[1]] || null);
    if (key.startsWith("botByUsername:")) return JSON.stringify(MEMORY_DB.botByUsername[key.split(":")[1]] || null);
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
    if (key.startsWith("botByUsername:")) { MEMORY_DB.botByUsername[key.split(":")[1]] = value; return true; }
    return false;
  }
  async function kvDelete(key) {
    if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.delete) {
      try { await USER_BOTS_KV.delete(key); return true; } catch (e) { console.log('KV DELETE ERR', key, e && e.message); }
    }
    if (key === "subscribers") { MEMORY_DB.subscribers = []; return true; }
    if (key.startsWith("user:")) { delete MEMORY_DB.users[key.split(":")[1]]; return true; }
    if (key.startsWith("pending:")) { delete MEMORY_DB.pending[key.split(":")[1]]; return true; }
    if (key.startsWith("botByUsername:")) { delete MEMORY_DB.botByUsername[key.split(":")[1]]; return true; }
    return false;
  }

  /* ========== UTILITIES ========== */
  function isProbablyToken(text) { return /^\d+:[A-Za-z0-9_-]{35,}$/.test(text); }
  function genPendingId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
  function makeUniqueBotCode(user, botUser) {
    const base = (botUser.username || String(botUser.id || "bot")).toString().replace(/\W/g,'').slice(0,12);
    let code = base; let i = 1;
    while (user.bots && user.bots[code]) code = base + "" + i++;
    return code;
  }
  function escapeHtml(unsafe) { if (!unsafe) return ""; return unsafe.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[m]); }
  function findFirstUsername(text) { const m = text.match(/@([a-z0-9_]{5,})/i); return m ? m[1] : null; }
  function findAllUrls(text) { const r = text.match(/https?:\/\/\S+/ig); return r || []; }
  function findFirstUrl(text) { const m = text.match(/https?:\/\/\S+/i); return m ? m[0] : null; }

  /* ========== TELEGRAM API HELPERS (with logs) ========== */
  async function callBotApiWithToken(token, method, body = {}) {
    const url = `https://api.telegram.org/bot${token}/${method}`;
    const opts = { method: "POST" };
    if (body instanceof FormData) opts.body = body;
    else { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify(body); }
    try {
      const res = await fetch(url, opts);
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      console.log('BOT API', method, 'status', res.status, 'ok', res.ok, 'desc', data && data.description);
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      console.log('BOT API FETCH ERR', method, e && e.message);
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  }

  async function getMe(token) {
    return await callBotApiWithToken(token, "getMe", {});
  }

  async function sendMessageViaMain(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text };
    if (options.inline_keyboard) payload.reply_markup = { inline_keyboard: options.inline_keyboard };
    if (options.parse_mode) payload.parse_mode = options.parse_mode;
    try {
      const res = await fetch(`${MAIN_TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      try { const d = await res.json(); console.log('SEND MAIN', res.status, d && d.description); } catch(e){}
    } catch (e) { console.log("sendMessageViaMain error", e && e.message); }
  }

  async function answerCallback(callbackQueryId, text = "") {
    try {
      const res = await fetch(`${MAIN_TELEGRAM_API}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }) });
      try { const d = await res.json(); console.log('ANSWER CALLBACK', callbackQueryId, d && d.description); } catch(e){}
    } catch (e) { console.log("answerCallback error", e && e.message); }
  }

  /* ========== TRANSLATIONS (same as you gave, trimmed if needed) ========== */
  const TRANSLATIONS = {
    ky: {
      name: "Kreyòl",
      menu_title: "Men meni prensipal la:",
      start_buttons: [
        [ { text: "/lang", callback_data: "cmd:/lang" }, { text: "/aktive", callback_data: "cmd:/aktive" } ],
        [ { text: "/èd", callback_data: "cmd:/èd" }, { text: "/bot", callback_data: "cmd:/bot" } ],
        [ { text: "/sip_bot", callback_data: "cmd:/sip_bot" }, { text: "/lis_bot", callback_data: "cmd:/lis_bot" } ],
        [ { text: "/mesaj", callback_data: "cmd:/mesaj" } ]
      ],
      ask_token_format: "Voye /bot <TOKEN> apre ou kreye bot la ak BotFather.",
      token_checking: "Ap verifye token la...",
      token_invalid: "Token pa valide oswa gen erè API.",
      created_bot: "Bot anrejistre:",
      bot_list_empty: "Ou pa gen bot anrejistre.",
      choose_bot_prompt: "Chwazi bot la pou aksyon sa a, epi konfime.",
      confirm_prompt: "Tanpri konfime aksyon an pou",
      broadcast_choose_type: "Kouman ou vle voye mesaj la? Simple Text oswa Card?",
      broadcast_options: ["Simple Text","Card"],
      broadcast_send_prompt_text: "Voye tèks la kounye a (sa wap voye bay tout abonnés).",
      broadcast_send_prompt_card: "Voye card la kòm: Tit|Body (eg: Tit|Sa se kò a).",
      broadcast_done: "Mesaj voye bay tout abonnés.",
      unknown_cmd: "Kòmand pa rekonèt. Sèvi ak /start pou meni."
    },
    en: { name:"English", menu_title:"Main menu:", start_buttons: [], token_checking:"Checking token...", token_invalid:"Token invalid or API error.", created_bot:"Bot registered:", bot_list_empty:"You have no registered bots.", choose_bot_prompt:"Choose bot for this action.", confirm_prompt:"Please confirm action for", broadcast_choose_type:"How do you want to send the message? Simple Text or Card?", broadcast_options:["Simple Text","Card"], broadcast_send_prompt_text:"Send the text now.", broadcast_send_prompt_card:"Send the card as: Title|Body", broadcast_done:"Message sent.", unknown_cmd:"Unknown command. Use /start." }
  };

  /* ========== CALLBACK SHORT-KEY MAP ========== */
  const CALLBACK_MAP = {};
  function shortCallbackKey(pendingId, suffix, meta = {}) {
    const key = "k" + Math.random().toString(36).slice(2,8);
    CALLBACK_MAP[key] = { pendingId, suffix, meta };
    return key;
  }
  function expandCallbackKey(k) { return CALLBACK_MAP[k] || null; }

  /* ========== PENDING HELPERS ========== */
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

  /* ========== SUBSCRIBERS HELPERS ========== */
  async function addSubscriberIfMissing(chatId) {
    const subs = (await kvGet("subscribers")) || [];
    const n = Number(chatId);
    if (!subs.includes(n)) { subs.push(n); await kvPut("subscribers", subs); }
  }
  async function getSubscribers() { return (await kvGet("subscribers")) || []; }

  /* ========== GOOGLE AI CALL (robust) ========== */
  async function callGoogleAI(prompt, systemPrompt = "You are a helpful assistant.") {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith("<")) return { ok: false, error: "Google API key not configured" };
    try {
      const url = `${GOOGLE_BASE}/v1beta2/models/${GOOGLE_MODEL}:generateText?key=${GOOGLE_API_KEY}`;
      const body = { prompt: { text: `${systemPrompt}\n\n${prompt}` }, maxOutputTokens: 512 };
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const raw = await r.clone().text();
      console.log('GOOGLE AI HTTP', r.status, raw.slice(0,1200));
      let j;
      try { j = await r.json(); } catch(e){ return { ok:false, error: 'Invalid JSON from Google' }; }
      if (!r.ok) return { ok:false, error: j };
      // extract text (many shapes)
      let txt = "";
      if (j.candidates && j.candidates[0]) {
        const c = j.candidates[0].content;
        if (typeof c === 'string') txt = c;
        else if (Array.isArray(c) && c.length && c[0].text) txt = c[0].text;
      }
      if (!txt && j.output && Array.isArray(j.output) && j.output[0]) {
        if (j.output[0].text) txt = j.output[0].text;
        else if (j.output_text) txt = j.output_text;
      }
      if (!txt && j.generated_text) txt = j.generated_text;
      if (!txt && j.text) txt = j.text;
      if (!txt) txt = JSON.stringify(j).slice(0,2000);
      return { ok: true, text: String(txt) };
    } catch (e) { console.log('GOOGLE AI ERR', e && e.message); return { ok:false, error: e && e.message ? e.message : String(e) }; }
  }

  /* ========== EXECUTE COMMANDS AS BOT (supports /sip /sipli /sipyo /lyen) ========== */
  async function executeCommandAsBot(bot, ctx, cmdText) {
    try {
      const token = bot.token;
      const chatId = ctx.chatId;
      const replyTo = ctx.replyToMessageId;
      const parts = cmdText.split(/\s+/).filter(Boolean);
      const base = (parts[0] || '').toLowerCase();
      console.log('EXEC CMD AS BOT', base, 'ctx', ctx);
      if (base === '/sip') {
        if (replyTo) return await callBotApiWithToken(token, 'deleteMessage', { chat_id: chatId, message_id: replyTo });
        return { ok:false, error:'No reply target to delete' };
      }
      if (base === '/sipli' || base === '/sipli@') {
        // /sipli <id|@username> or reply
        let target = parts[1] ? parts[1].replace(/^@/, '') : null;
        if (!target && ctx.replyToUserId) return await callBotApiWithToken(token, 'banChatMember', { chat_id: chatId, user_id: ctx.replyToUserId });
        if (!target) return { ok:false, error:'No target specified' };
        // if numeric id
        if (/^\d+$/.test(target)) {
          return await callBotApiWithToken(token, 'banChatMember', { chat_id: chatId, user_id: Number(target) });
        }
        // try resolve username via getChat (best-effort)
        try {
          const r = await callBotApiWithToken(token, 'getChat', { chat_id: `@${target}` });
          if (r.ok && r.data && r.data.result && r.data.result.id) {
            const uid = r.data.result.id;
            return await callBotApiWithToken(token, 'banChatMember', { chat_id: chatId, user_id: uid });
          }
        } catch(e){}
        return { ok:false, error:'Could not resolve username to id. Use numeric id or reply to user.' };
      }
      if (base === '/sipyo') {
        // best-effort kick all non-admins in chat — DANGEROUS. iterate members is limited; we will attempt for stored subscribers
        const subs = await getSubscribers();
        let okCount = 0;
        for (const s of subs) {
          try { await callBotApiWithToken(token, 'banChatMember', { chat_id: chatId, user_id: s }); okCount++; } catch(e){}
        }
        return { ok:true, data: `Attempted bulk ban for ${okCount} users (best-effort)` };
      }
      if (base === '/lyen') {
        return await callBotApiWithToken(token, 'exportChatInviteLink', { chat_id: chatId });
      }
      // add more commands (setname, setdescription, setcommands) if needed
      return { ok:false, error:'Unknown command for executor' };
    } catch (e) { return { ok:false, error: e && e.message ? e.message : String(e) }; }
  }

  /* ========== CARD BUILDERS (two-column preformatted) ========== */
  function buildCardText(title, body) {
    // Build two-column preformatted card:
    // Title centered on top (bold), then pre block with left col width and right col content
    const leftW = 12;
    const rightW = 30;
    const lines = [];
    if (!body) body = '';
    // parse body lines using '|' pairs or newline
    if (body.includes('\n')) {
      const parts = body.split('\n').slice(0,6);
      for (const p of parts) {
        if (p.includes('|')) {
          const [l,r] = p.split('|'); lines.push([l.trim(), r.trim()]);
        } else {
          const tokens = p.split(/\s{2,}|\t/).slice(0,2);
          lines.push([tokens[0] ? tokens[0].trim() : '', tokens[1] ? tokens[1].trim() : '']);
        }
      }
    } else if (body.includes('|')) {
      const parts = body.split('|');
      for (let i=0;i<parts.length;i+=2) lines.push([ (parts[i]||'').trim(), (parts[i+1]||'').trim() ]);
    } else {
      // split into sentences pairs
      const parts = body.split('.').map(s=>s.trim()).filter(Boolean).slice(0,6);
      for (let i=0;i<parts.length;i+=2) lines.push([parts[i]||'', parts[i+1]||'']);
    }
    if (!lines.length) lines.push(['','']);
    let out = title ? `<b>${escapeHtml(title)}</b>\n\n<pre>` : '<pre>';
    for (const [L,R] of lines.slice(0,6)) {
      const left = (L||'').slice(0,leftW).padEnd(leftW,' ');
      const right = (R||'').slice(0,rightW);
      out += `${escapeHtml(left)} ${escapeHtml(right)}\n`;
    }
    out += '</pre>';
    return out;
  }

  function buildCardKeyboardFromBody(body, pendingId) {
    // Left column -> url buttons (Lyen). Right column -> callback buttons (Touch)
    // We'll produce rows of two buttons when possible.
    const urls = findAllUrls(body);
    const username = findFirstUsername(body);
    const rows = [];
    // prefer username link first
    if (username) {
      const key = shortCallbackKey(pendingId, `touch@${username}`);
      rows.push([ { text: 'Lyen', url: `https://t.me/${username}` }, { text: 'Touch', callback_data: `touch:${key}` } ]);
    }
    // add urls in pairs
    for (const u of urls.slice(0,3)) {
      const key = shortCallbackKey(pendingId, `touch@${u}`);
      rows.push([ { text: 'Lyen', url: u }, { text: 'Touch', callback_data: `touch:${key}` } ]);
    }
    // default single-row Yow button
    const yk = shortCallbackKey(pendingId, 'yow');
    rows.push([ { text: 'Yow', callback_data: `yow:${yk}` } ]);
    return rows;
  }

  /* ========== FORMAT RESULT ========== */
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

  /* ========== EXECUTE PENDING ========== */
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
        const mode = pending.args.broadcastMode || "Simple Text";
        const payloadText = pending.args.text || "";
        const subs = await getSubscribers();
        for (const s of subs) {
          try {
            if ((mode||'').toLowerCase().includes('card')) {
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

  /* ========== LIST HELPERS ========== */
  async function sendBotList(chatId, user) {
    const lang = user.lang || "ky";
    const entries = Object.entries(user.bots || {});
    if (!entries.length) { await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.bot_list_empty || "No bots"); return; }
    const lines = entries.map(([code, b]) => { const uname = b.info?.username ? "@" + b.info.username : "(no username)"; return `${uname} — ${code}`; });
    const kb = entries.map(([code, b]) => (b.info?.username ? [{ text: `@${b.info.username}`, url: `https://t.me/${b.info.username}` }] : [{ text: `${code}`, callback_data: `noop:${code}` }]));
    await sendMessageViaMain(chatId, lines.join("\n"));
    await sendMessageViaMain(chatId, "Quick actions:", { inline_keyboard: kb });
  }

  /* ========== CALLBACK HANDLER ========== */
  async function handleCallbackQuery(cb) {
    const data = cb.data || "";
    const fromId = String(cb.from.id);
    const callbackId = cb.id;
    const chatId = cb.message?.chat?.id;
    console.log('CALLBACK DATA', data, 'from', fromId);
    const firstColon = data.indexOf(':');
    let action = data;
    let payload = '';
    if (firstColon !== -1) { action = data.slice(0, firstColon); payload = data.slice(firstColon+1); }
    // expand if short key
    const expanded = expandCallbackKey(payload);
    const pendingId = expanded ? expanded.pendingId : payload;
    const suffix = expanded ? expanded.suffix : null;
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
        if (cmd === "/bot") {
          const u = await kvGet(`user:${fromId}`) || { lang: "ky" };
          await sendMessageViaMain(chatId, TRANSLATIONS[u.lang].ask_token_format);
          return;
        }
        return;
      }
      if (action === "pick") {
        const code = suffix || payload;
        const pending = await getPending(fromId, pendingId);
        if (!pending) { await answerCallback(callbackId, "Pending expired"); return; }
        const user = await kvGet(`user:${fromId}`);
        const bot = user?.bots?.[code];
        const label = bot?.info?.username ? "@" + bot.info.username : code;
        const kb = buildConfirmKeyboard(pendingId, code);
        await answerCallback(callbackId, `Selected ${label}`);
        if (chatId) await sendMessageViaMain(chatId, `${TRANSLATIONS[user.lang].confirm_prompt} ${label}`, { inline_keyboard: kb });
        return;
      }
      if (action === "confirm") {
        const code = suffix || payload;
        const pending = await getPending(fromId, pendingId);
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
        const who = cb.from && (cb.from.username ? "@" + cb.from.username : (cb.from.first_name || String(cb.from.id)));
        await answerCallback(callbackId, "Clicked");
        if (chatId) await sendMessageViaMain(chatId, `${who} clicked Yow`);
        return;
      }
      if (action === "touch") {
        const exp = expandCallbackKey(payload);
        const suffix = exp ? exp.suffix : payload;
        await answerCallback(callbackId, 'Touch received');
        if (chatId) await sendMessageViaMain(chatId, `Touch: ${suffix}`);
        return;
      }
      await answerCallback(callbackId, "Unknown callback");
    } catch (e) {
      console.error('callback handler error', e);
      await answerCallback(callbackId, 'Error');
    }
  }

  /* ========== START CARD & HELP ========== */
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
    let text = `${tr.help_title || "Help"}\n\n${tr.help_intro || ""}\n\n`;
    for (const c of Object.keys(tr.help_commands || {})) {
      text += `${c}\n${tr.help_commands[c]}\n\n`;
    }
    await sendMessageViaMain(chatId, text);
  }

  /* ========== MESSAGE HANDLER (main) ========== */
  async function handleTelegramMessage(update) {
    if (update.callback_query) { return await handleCallbackQuery(update.callback_query); }
    if (!update.message) return;

    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = (msg.text || "").trim();

    console.log('INCOMING MSG', { chatId, userId, text });

    // store subscribers
    await addSubscriberIfMissing(chatId);

    // ensure user storage
    let user = await kvGet("user:" + userId);
    if (!user) { user = { lang: "ky", bots: {} }; await kvPut("user:" + userId, user); }
    const lang = user.lang || "ky";

    // handle pending broadcast flows
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
        const [t,...rest] = text.split("|");
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

    // photo flow
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

    // token direct (register)
    if (isProbablyToken(text)) { return await registerNewBotFlow(userId, chatId, text, lang); }

    const parts = text.split(" ").filter(Boolean);
    const cmd = (parts[0] || "").toLowerCase();

    // basic commands
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

    if (cmd === "/lis_bot" || cmd === "/bot_mw") { await sendBotList(chatId, user); return; }

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

    /* ========== AI TRIGGER / BOT MENTION HANDLING ========== */
    // Find a bot by @mention or by name in the text (search KV first)
    const mentioned = findFirstUsername(text);
    let matchedBot = null, matchedOwner = null;
    if (mentioned) {
      const rec = await kvGet(`botByUsername:${mentioned.toLowerCase()}`);
      if (rec && rec.owner && rec.code) {
        const owner = await kvGet(`user:${rec.owner}`);
        if (owner && owner.bots && owner.bots[rec.code]) { matchedBot = owner.bots[rec.code]; matchedOwner = rec.owner; }
      } else {
        // fallback to in-memory scan
        for (const uid of Object.keys(MEMORY_DB.users)) {
          const u = MEMORY_DB.users[uid];
          if (!u || !u.bots) continue;
          for (const [code,b] of Object.entries(u.bots)) {
            if (b.info && b.info.username && b.info.username.toLowerCase() === mentioned.toLowerCase()) { matchedBot = b; matchedOwner = uid; break; }
          }
          if (matchedBot) break;
        }
      }
    }

    // also match by bot's first_name or code inside text
    if (!matchedBot) {
      const lower = text.toLowerCase();
      // scan KV would be better but we fallback to memory
      for (const uid of Object.keys(MEMORY_DB.users)) {
        const u = MEMORY_DB.users[uid];
        if (!u || !u.bots) continue;
        for (const [code,b] of Object.entries(u.bots)) {
          const nameCandidates = [b.info?.first_name, b.info?.username, b.code].filter(Boolean).map(s=>String(s).toLowerCase());
          for (const cand of nameCandidates) if (cand && lower.includes(cand)) { matchedBot = b; matchedOwner = uid; break; }
          if (matchedBot) break;
        }
        if (matchedBot) break;
      }
    }

    // If a registered bot was mentioned, call AI and reply as that bot
    if (matchedBot) {
      console.log('MATCHED BOT FOR AI:', matchedBot.info?.username || matchedBot.code);
      // build aiConfig from bot.aiConfig or default (we add identity + available commands)
      const botName = matchedBot.info?.username ? '@' + matchedBot.info.username : (matchedBot.info?.first_name || matchedBot.code);
      const commandsHelp = [
        '/sip — delete replied message',
        '/sipli — ban user (use numeric id or reply)',
        '/sipyo — best-effort kick all (dangerous)',
        '/lyen — export invite link'
      ].join('\n');
      const aiPromptBase = (matchedBot.aiConfig && matchedBot.aiConfig.prompt) ? matchedBot.aiConfig.prompt : `Ou se ${botName}, yon Telegram bot. Ou konnen kòmand sa yo:\n${commandsHelp}\nRepon kout, klè. Si ou dwe egzekite yon kòmand sou Telegram, retounen yon sèl liy ki kòmanse ak CMD: e suiv pa kòmand egzak la (eg CMD:/sip reply). Sinon repon ak tèks nòmal.`;
      const prompt = `User: ${msg.from.username || msg.from.first_name || msg.from.id}\nChat: ${chatId}\nMessage: ${text}\n\n${aiPromptBase}`;

      const aiRes = await callGoogleAI(prompt, aiPromptBase);
      if (!aiRes.ok) { console.log('AI CALL FAILED', aiRes.error); await sendMessageViaMain(chatId, `AI error: ${String(aiRes.error).slice(0,800)}`); return; }
      const replyText = String(aiRes.text || '').trim();
      if (!replyText) { console.log('AI returned empty text', aiRes); await sendMessageViaMain(chatId, 'AI returned empty response'); return; }
      console.log('AI REPLY', replyText.slice(0,1200));

      // if AI instructs CMD:, run it
      if (replyText.startsWith('CMD:')) {
        const cmdLine = replyText.split('\n')[0].slice(4).trim();
        // Prepare exec context: include replyToUserId if message is a reply
        const execCtx = { chatId, fromId: userId, messageId: msg.message_id, replyToMessageId: msg.reply_to_message && msg.reply_to_message.message_id, replyToUserId: msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.id };
        const execRes = await executeCommandAsBot(matchedBot, execCtx, cmdLine);
        await sendMessageViaMain(chatId, `AI executed: ${cmdLine} -> ${execRes && execRes.ok ? 'ok' : JSON.stringify(execRes)}`);
        return;
      }

      // otherwise send reply as the matched bot
      const sendRes = await callBotApiWithToken(matchedBot.token, 'sendMessage', { chat_id: chatId, text: replyText, reply_to_message_id: msg.message_id });
      if (!sendRes.ok) {
        console.log('SEND AS BOT FAILED', sendRes);
        await sendMessageViaMain(chatId, 'Failed sending reply from bot (check token/rights)');
      }
      return;
    }

    // fallback unknown
    await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.unknown_cmd || "Unknown command");
  }

  /* ========== REGISTER NEW BOT FLOW (adds aiConfig & kv index) ========== */
  async function registerNewBotFlow(userId, chatId, token, lang) {
    await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.token_checking || "Checking token...");
    const info = await getMe(token);
    if (!info || !info.ok || !info.data) { await sendMessageViaMain(chatId, TRANSLATIONS[lang]?.token_invalid || "Invalid token"); return; }
    const botUser = info.data.result;
    let user = await kvGet("user:" + userId);
    if (!user) user = { lang: "ky", bots: {} };
    const code = makeUniqueBotCode(user, botUser);

    // default AI config so bot can answer: you can override later by /aktive flow
    const defaultAi = {
      prompt: `Se yon asistan kout; reponn kout, klè. Ou se ${botUser.username ? '@'+botUser.username : botUser.first_name || code}. Si bezwen fè aksyon sou Telegram, retounen 'CMD:/sip reply' oswa 'CMD:/sipli <id>'.`,
      name: botUser.username ? '@' + botUser.username : code
    };

    user.bots[code] = { token, info: botUser, active: true, createdAt: Date.now(), code, mode: "bot", aiConfig: defaultAi };
    await kvPut("user:" + userId, user);
    if (botUser.username) await kvPut(`botByUsername:${botUser.username.toLowerCase()}`, { owner: userId, code });

    // also populate in-memory fallback for immediate availability
    MEMORY_DB.users[userId] = user;
    if (botUser.username) MEMORY_DB.botByUsername[botUser.username.toLowerCase()] = { owner: userId, code };

    const username = botUser.username ? "@" + botUser.username : botUser.first_name || code;
    await sendMessageViaMain(chatId, `${TRANSLATIONS[lang]?.created_bot || "Created bot"} ${code} — ${username}`);
  }

  /* ========== BUTTON / KEYBOARD HELPERS ========== */
  function buildBotSelectionKeyboard(bots, pendingId) {
    const rows = [];
    for (const code of Object.keys(bots)) {
      const username = bots[code].info && bots[code].info.username ? "@" + bots[code].info.username : code;
      const key = shortCallbackKey(pendingId, code);
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

  /* ========== FETCH / ENTRY ========== */
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

  /* ========== MISC ========== */
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
