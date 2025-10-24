addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

/* ---------- USER-PROVIDED SECRETS (placed directly as requested) ---------- */
// WARNING: These are exposed in source. Keep file private.
const MAIN_TELEGRAM_TOKEN = "8346530009:AAG6gd7P8yjtCyI4Tf258Fth7FayMJl0sr8";
const GOOGLE_API_KEY = "AIzaSyD7-VPQHG1q5-hS1pUfybggU4bgKAHAEmo";
const GOOGLE_MODEL = "gemini-2.0-flash";
const GOOGLE_BASE = "https://generativelanguage.googleapis.com";

/* ---------- Tele API base ---------- */
const MAIN_TELEGRAM_API = `https://api.telegram.org/bot${MAIN_TELEGRAM_TOKEN}`;

/* ---------- Simple in-memory fallback DB (if no KV provided) ---------- */
const MEMORY_DB = { users: {}, pending: {} };

/* ---------- KV wrapper (attempts to use USER_BOTS_KV if available) ---------- */
async function kvGet(key) {
  if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.get) {
    try { const v = await USER_BOTS_KV.get(key); return v ? JSON.parse(v) : null; } catch (e) {}
  }
  if (key.startsWith("user:")) return MEMORY_DB.users[key.split(":")[1]] || null;
  if (key.startsWith("pending:")) return MEMORY_DB.pending[key.split(":")[1]] || null;
  return null;
}
async function kvPut(key, value) {
  if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.put) {
    try { await USER_BOTS_KV.put(key, JSON.stringify(value)); return true; } catch (e) {}
  }
  if (key.startsWith("user:")) { MEMORY_DB.users[key.split(":")[1]] = value; return true; }
  if (key.startsWith("pending:")) { MEMORY_DB.pending[key.split(":")[1]] = value; return true; }
  return false;
}
async function kvDelete(key) {
  if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.delete) {
    try { await USER_BOTS_KV.delete(key); return true; } catch (e) {}
  }
  if (key.startsWith("user:")) { delete MEMORY_DB.users[key.split(":")[1]]; return true; }
  if (key.startsWith("pending:")) { delete MEMORY_DB.pending[key.split(":")[1]]; return true; }
  return false;
}

/* ---------- Utilities ---------- */
function isProbablyToken(text) { return /^\d+:[A-Za-z0-9_-]{35,}$/.test(text); }
function genPendingId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
function makeUniqueBotCode(user, botUser) {
  const base = (botUser.username || String(botUser.id || "bot")).toString().replace(/\W/g,'').slice(0,12);
  let code = base; let i = 1;
  while (user.bots && user.bots[code]) code = base + "" + i++;
  return code;
}

/* ---------- Simple Telegram API wrapper ---------- */
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

/* ---------- Messaging helpers ---------- */
async function sendMessage(chatId, text, options = {}) {
  const payload = { chat_id: chatId, text };
  if (options.inline_keyboard) payload.reply_markup = { inline_keyboard: options.inline_keyboard };
  if (options.reply_markup) payload.reply_markup = options.reply_markup;
  try { await fetch(`${MAIN_TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); }
  catch (e) { console.log("sendMessage error", e && e.message); }
}
async function answerCallback(callbackQueryId, text = "") {
  try { await fetch(`${MAIN_TELEGRAM_API}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }) }); }
  catch (e) { console.log("answerCallback error", e && e.message); }
}

/* ---------- Simple translation strings (4 langs) ---------- */
const TRANSLATIONS = {
  ky: {
    name: "Kreyòl",
    menu_title: "Byenveni! Men meni ou:",
    menu_lines: [
      "/nouvo_bot  - Kreye oswa anrejistre yon bot (voye token)",
      "/bot       - Anrejistre token",
      "/lis_bot   - Lis bot ou yo",
      "/foto      - Chanje foto",
      "/description - Chanje description/about",
      "/kòmand    - Mete kòmand",
      "/aktive_sal_ye - Aktive bot (AI/BOT/AI&BOT)"
    ],
    token_checking: "Ap verifye token la...",
    token_invalid: "Token pa valide oswa erè API.",
    created_bot: "Bot anrejistre:",
    bot_list_empty: "Ou pa gen bot anrejistre.",
    choose_bot_prompt: "Chwazi bot la pou aksyon sa a, epi konfime.",
    confirm_prompt: "Tanpri konfime aksyon an pou",
    send_commands_prompt: "Voye lis kòmand yo, youn pa liy, fòma: command - Description",
    send_message_prompt: "Voye tèks mesaj la pou voye avèk bot sa a.",
    choose_activation_prompt: "Kisa ou vle aktive pou bot la? Chwazi yon opsyon:",
    activation_options: ["AI", "Bot", "AI & Bot"],
    ai_variant_prompt: "Chwazi vèsyon AI (eg Adam_D'H7 V1)",
    ask_ai_info: "Bay enfòmasyon pou konfig AI (prompt ak api_key) oswa tape 'default'.",
    ai_activated: "Bot lan aktive avèk konfig AI.",
    cannot_set_webhook: "Webhook pa mete otomatikman (WEBHOOK_BASE_URL pa defini).",
    choose_bot_after_ai: "Chwazi ki bot pou asiyen AI sa a",
    confirm_activate_bot: "Konfime aktyasyon bot la?"
  },
  fr: {
    name: "Français",
    menu_title: "Bienvenue! Voici votre menu:",
    menu_lines: [
      "/nouvo_bot  - Créer/enregistrer un bot",
      "/bot       - Enregistrer token",
      "/lis_bot   - Lister vos bots",
      "/foto      - Changer la photo",
      "/description - Modifier description",
      "/kòmand    - Définir commandes",
      "/aktive_sal_ye - Activer bot (AI/BOT/AI&BOT)"
    ],
    token_checking: "Vérification du token...",
    token_invalid: "Token invalide ou erreur API.",
    created_bot: "Bot enregistré:",
    bot_list_empty: "Vous n'avez aucun bot enregistré.",
    choose_bot_prompt: "Choisissez le bot pour cette action, puis confirmez.",
    confirm_prompt: "Veuillez confirmer l'action pour",
    send_commands_prompt: "Envoyez la liste des commandes, une par ligne, format: command - Description",
    send_message_prompt: "Envoyez le texte à poster avec ce bot.",
    choose_activation_prompt: "Que souhaitez-vous activer pour le bot ?",
    activation_options: ["AI", "Bot", "AI & Bot"],
    ai_variant_prompt: "Choisissez la version AI (ex Adam_D'H7 V1)",
    ask_ai_info: "Fournissez prompt/api_key ou tapez 'default'.",
    ai_activated: "Le bot est activé avec la config AI.",
    cannot_set_webhook: "Webhook non configuré (WEBHOOK_BASE_URL non défini).",
    choose_bot_after_ai: "Choisissez le bot à assigner",
    confirm_activate_bot: "Confirmez l'activation du bot ?"
  },
  en: {
    name: "English",
    menu_title: "Welcome! Here is your menu:",
    menu_lines: [
      "/nouvo_bot  - Create/register a bot",
      "/bot       - Register token",
      "/lis_bot   - List your bots",
      "/foto      - Change photo",
      "/description - Change description",
      "/kòmand    - Set commands",
      "/aktive_sal_ye - Activate bot (AI/BOT/AI&BOT)"
    ],
    token_checking: "Checking token...",
    token_invalid: "Token invalid or API error.",
    created_bot: "Bot registered:",
    bot_list_empty: "You have no registered bots.",
    choose_bot_prompt: "Choose the bot for this action, then confirm.",
    confirm_prompt: "Please confirm the action for",
    send_commands_prompt: "Send commands list, one per line: command - Description",
    send_message_prompt: "Send the message text to post with this bot.",
    choose_activation_prompt: "What do you want to activate for the bot?",
    activation_options: ["AI", "Bot", "AI & Bot"],
    ai_variant_prompt: "Choose AI variant (eg Adam_D'H7 V1)",
    ask_ai_info: "Provide prompt and/or api_key, or type 'default'.",
    ai_activated: "Bot activated with AI config.",
    cannot_set_webhook: "Webhook not set (WEBHOOK_BASE_URL missing).",
    choose_bot_after_ai: "Choose which bot to assign this AI to",
    confirm_activate_bot: "Confirm activation for this bot?"
  },
  es: {
    name: "Español",
    menu_title: "Bienvenido! Aquí está tu menú:",
    menu_lines: [
      "/nouvo_bot  - Crear/registrar un bot",
      "/bot       - Registrar token",
      "/lis_bot   - Listar tus bots",
      "/foto      - Cambiar foto",
      "/description - Cambiar descripción",
      "/kòmand    - Establecer comandos",
      "/aktive_sal_ye - Activar bot (AI/BOT/AI&BOT)"
    ],
    token_checking: "Verificando token...",
    token_invalid: "Token inválido o error de API.",
    created_bot: "Bot registrado:",
    bot_list_empty: "No tienes bots registrados.",
    choose_bot_prompt: "Elige el bot para esta acción y confirma.",
    confirm_prompt: "Por favor confirma la acción para",
    send_commands_prompt: "Envía la lista de comandos, uno por línea: command - Description",
    send_message_prompt: "Envía el texto del mensaje para publicar con ese bot.",
    choose_activation_prompt: "¿Qué quieres activar para el bot?",
    activation_options: ["AI", "Bot", "AI & Bot"],
    ai_variant_prompt: "Elige variante AI (ej Adam_D'H7 V1)",
    ask_ai_info: "Proporciona prompt/api_key o escribe 'default'.",
    ai_activated: "Bot activado con configuración AI.",
    cannot_set_webhook: "Webhook no configurado (WEBHOOK_BASE_URL falta).",
    choose_bot_after_ai: "Elige a qué bot asignar este AI",
    confirm_activate_bot: "¿Confirmas la activación?"
  }
};

/* ---------- Minimal callback map to avoid long callback_data ---------- */
const CALLBACK_MAP = {};
function shortCallbackKey(pendingId, suffix) {
  const key = "p" + Math.random().toString(36).slice(2,8);
  CALLBACK_MAP[key] = { pendingId, suffix };
  return key;
}
function expandCallbackKey(key) { return CALLBACK_MAP[key] || null; }

/* ---------- Pending storage helpers (per-pending keys) ---------- */
async function savePending(userId, pending) { await kvPut(`pending:${pending.id}`, pending); }
async function getPending(userId, pendingId) { return await kvGet(`pending:${pendingId}`); }
async function removePending(userId, pendingId) { await kvDelete(`pending:${pendingId}`); }
async function findPendingByState(userId, state) {
  // memory-only scan fallback
  for (const id of Object.keys(MEMORY_DB.pending)) {
    const p = MEMORY_DB.pending[id];
    if (p && p.fromId === userId && p.state === state) return p;
  }
  return null;
}

/* ---------- Core flows ---------- */
async function registerNewBotFlow(userId, chatId, token, lang) {
  await sendMessage(chatId, TRANSLATIONS[lang].token_checking);
  const info = await getMe(token);
  if (!info || !info.ok) { await sendMessage(chatId, TRANSLATIONS[lang].token_invalid); return; }
  const botUser = info.result;
  let user = await kvGet("user:" + userId);
  if (!user) user = { lang: "ky", bots: {} };
  const code = makeUniqueBotCode(user, botUser);
  user.bots[code] = { token, info: botUser, active: true, createdAt: Date.now(), code, mode: "bot", aiConfig: null };
  await kvPut("user:" + userId, user);
  const username = botUser.username ? "@" + botUser.username : botUser.first_name || code;
  await sendMessage(chatId, `${TRANSLATIONS[lang].created_bot} ${code} — ${username}`);
}

/* ---------- Helper keyboards ---------- */
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
function buildActivationChoiceKeyboard(pendingId, lang) {
  const opts = TRANSLATIONS[lang].activation_options || ["AI", "Bot", "AI & Bot"];
  const rows = opts.map(o => [{ text: o, callback_data: `activate_choice:${shortCallbackKey(pendingId,o)}` }]);
  rows.push([{ text: "Cancel", callback_data: `cancel:${shortCallbackKey(pendingId,'cancel')}` }]);
  return rows;
}
function buildAiVariantKeyboard(pendingId) {
  return [ [{ text: "Adam_D'H7 V1", callback_data: `ai_variant:${shortCallbackKey(pendingId, "Adam_D'H7 V1")}` }], [{ text: "Cancel", callback_data: `cancel:${shortCallbackKey(pendingId,'cancel')}` }] ];
}

/* ---------- Format result helper ---------- */
function formatResult(cmd, res, b, extra = {}) {
  const name = b && b.info && b.info.username ? "@" + b.info.username : (b && b.code ? b.code : "bot");
  if (res && res.ok && res.data && res.data.ok) {
    switch (cmd) {
      case "description": case "info": case "setabouttext": return `Description updated for ${name}.`;
      case "non": case "setname": return `Name updated for ${name}.`;
      case "kòmand": case "setcommands": return `Commands updated for ${name}.`;
      case "foto": if (extra.uploadedUrl) return `Photo applied for ${name}: ${extra.uploadedUrl}`; return `Photo applied for ${name}.`;
      case "show_token": return `Token for ${name}: ${b.token}`;
      case "notif_texte": return `Message sent as ${name}.`;
      default: return `Operation ${cmd} completed for ${name}.`;
    }
  }
  const errMsg = (res && res.data && res.data.description) ? res.data.description : (res && res.error) ? res.error : "Unknown error";
  return `Error: ${errMsg}`;
}

/* ---------- Execute pending ---------- */
async function executePending(userId, pending) {
  const chatId = pending.chatId;
  const user = await kvGet(`user:${userId}`);
  if (!user) { await sendMessage(chatId, "User storage missing."); return; }
  const code = pending.args && pending.args.code;
  if (!code || !user.bots || !user.bots[code]) { await sendMessage(chatId, TRANSLATIONS[user.lang].bot_list_empty); await removePending(userId, pending.id); return; }
  const b = user.bots[code];
  const cmd = pending.cmd;

  try {
    if (cmd === "description" || cmd === "info" || cmd === "setabouttext") {
      const rest = pending.args.rest || "";
      const res = await callBotApiWithToken(b.token, "setMyDescription", { description: rest });
      b.info = b.info || {}; b.info.description = rest;
      await kvPut(`user:${userId}`, user);
      await sendMessage(chatId, formatResult(cmd, res, b));
      await removePending(userId, pending.id);
      return;
    }

    if (cmd === "non" || cmd === "setname") {
      const rest = pending.args.rest || "";
      const res = await callBotApiWithToken(b.token, "setMyName", { name: rest });
      b.info = b.info || {}; b.info.first_name = rest;
      await kvPut(`user:${userId}`, user);
      await sendMessage(chatId, formatResult(cmd, res, b));
      await removePending(userId, pending.id);
      return;
    }

    if (cmd === "kòmand" || cmd === "setcommands") {
      const parsed = pending.args.parsedCommands;
      if (!parsed) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " JSON invalid."); await removePending(userId, pending.id); return; }
      const res = await callBotApiWithToken(b.token, "setMyCommands", { commands: parsed });
      await sendMessage(chatId, formatResult(cmd, res, b));
      await removePending(userId, pending.id);
      return;
    }

    if (cmd === "foto" || cmd === "setphoto") {
      const fileId = pending.args.file_id;
      if (!fileId) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " no file_id"); await removePending(userId, pending.id); return; }
      const gf = await callBotApiWithToken(MAIN_TELEGRAM_TOKEN, "getFile", { file_id: fileId });
      if (!gf.ok || !gf.data || !gf.data.ok || !gf.data.result || !gf.data.result.file_path) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " getFile failed"); await removePending(userId, pending.id); return; }
      const filePath = gf.data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${MAIN_TELEGRAM_TOKEN}/${filePath}`;
      const got = await fetch(fileUrl);
      if (!got.ok) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " could not download file"); await removePending(userId, pending.id); return; }
      const ab = await got.arrayBuffer();

      try {
        const form = new FormData();
        const blob = new Blob([ab], { type: "application/octet-stream" });
        form.append("photo", blob, "photo.jpg");
        let res = await callBotApiWithToken(b.token, "setUserProfilePhoto", form);
        if (res && res.ok && res.data && res.data.ok) {
          b.photo = "(set via API)";
          await kvPut(`user:${userId}`, user);
          await sendMessage(chatId, formatResult("foto", res, b));
          await removePending(userId, pending.id);
          return;
        }
        res = await callBotApiWithToken(b.token, "setMyProfilePhoto", form);
        if (res && res.ok && res.data && res.data.ok) {
          b.photo = "(set via API)";
          await kvPut(`user:${userId}`, user);
          await sendMessage(chatId, formatResult("foto", res, b));
          await removePending(userId, pending.id);
          return;
        }
        // fallback: don't upload to public uploader here (user didn't want external). Fail gracefully.
        await sendMessage(chatId, TRANSLATIONS[user.lang].error + " could not apply photo (API unsupported).");
        await removePending(userId, pending.id);
        return;
      } catch (e) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " upload exception: " + (e.message || e)); await removePending(userId, pending.id); return; }
    }

    if (cmd === "notif_texte") {
      const textToSend = pending.args.text || "";
      if (!textToSend) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " no text to send"); await removePending(userId, pending.id); return; }
      const res = await callBotApiWithToken(b.token, "sendMessage", { chat_id: chatId, text: textToSend });
      await sendMessage(chatId, formatResult("notif_texte", res, b));
      await removePending(userId, pending.id);
      return;
    }

    if (cmd === "activate_flow") {
      const mode = pending.args.mode;
      if (pending.args.aiConfig) b.aiConfig = pending.args.aiConfig;
      if (mode && mode.toLowerCase().startsWith("ai")) b.mode = "ai";
      else if (mode && mode.toLowerCase().startsWith("bot")) b.mode = "bot";
      else b.mode = "ai_bot";
      b.active = true;
      await kvPut(`user:${userId}`, user);

      // Try setting webhook if WEBHOOK_BASE_URL present in KV
      let webhookSet = false;
      try {
        if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.get) {
          const base = await USER_BOTS_KV.get("WEBHOOK_BASE_URL");
          if (base) {
            const webhookUrl = base.replace(/\/+$/,'') + "/telegram_webhook";
            const res = await callBotApiWithToken(b.token, "setWebhook", { url: webhookUrl });
            if (res && res.ok && res.data && res.data.ok) webhookSet = true;
          }
        }
      } catch (e) { webhookSet = false; }

      const userLang = user.lang || "ky";
      if (!webhookSet) {
        await sendMessage(chatId, TRANSLATIONS[userLang].ai_activated);
        await sendMessage(chatId, TRANSLATIONS[userLang].cannot_set_webhook);
      } else {
        await sendMessage(chatId, TRANSLATIONS[userLang].ai_activated + " Webhook set.");
      }
      await removePending(userId, pending.id);
      return;
    }

    await sendMessage(chatId, "Operation not implemented: " + cmd);
    await removePending(userId, pending.id);
  } catch (e) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " " + (e.message || String(e))); await removePending(userId, pending.id); }
}

/* ---------- Callback handler ---------- */
async function handleCallbackQuery(cb) {
  const data = cb.data || "";
  const fromId = String(cb.from.id);
  const callbackId = cb.id;
  const chatId = cb.message?.chat?.id;
  const parts = data.split(":");
  const action = parts[0];
  const payload = parts[1] || "";

  // resolve short key
  let pendingId = null;
  let codeOrSuffix = null;
  const expanded = expandCallbackKey(payload);
  if (expanded) { pendingId = expanded.pendingId; codeOrSuffix = expanded.suffix; }
  else { pendingId = payload; }

  if (action === "cancel") {
    await removePending(fromId, pendingId);
    await answerCallback(callbackId, "Cancelled");
    if (chatId) await sendMessage(chatId, "Action cancelled.");
    return;
  }
  if (action === "noop") { await answerCallback(callbackId, "OK"); if (chatId) await sendMessage(chatId, "Action noted."); return; }

  if (action === "pick") {
    const code = codeOrSuffix || parts[2];
    const pending = await getPending(fromId, pendingId);
    if (!pending) { await answerCallback(callbackId, "Pending expired"); return; }
    const user = await kvGet(`user:${fromId}`);
    const bot = user?.bots?.[code];
    const label = bot?.info?.username ? "@" + bot.info.username : code;
    const kb = buildConfirmKeyboard(pendingId, code);
    await answerCallback(callbackId, `Selected ${label}`);
    if (chatId) await sendMessage(chatId, `${TRANSLATIONS[user.lang].confirm_prompt} ${label}`, { inline_keyboard: kb });
    return;
  }

  if (action === "confirm") {
    const code = codeOrSuffix || parts[2];
    const pending = await getPending(fromId, pendingId);
    if (!pending) { await answerCallback(callbackId, "Pending expired"); return; }
    pending.args = pending.args || {}; pending.args.code = code;
    if (pending.cmd === "kòmand") {
      pending.state = "awaiting_commands"; await savePending(fromId, pending); await answerCallback(callbackId, "Confirmed");
      const user = await kvGet(`user:${fromId}`); await sendMessage(chatId, TRANSLATIONS[user.lang].send_commands_prompt); return;
    }
    if (pending.cmd === "notif_texte") {
      pending.state = "awaiting_text"; await savePending(fromId, pending); await answerCallback(callbackId, "Confirmed");
      const user = await kvGet(`user:${fromId}`); await sendMessage(chatId, TRANSLATIONS[user.lang].send_message_prompt); return;
    }
    await answerCallback(callbackId, "Confirmed"); await executePending(fromId, pending); return;
  }

  if (action === "activate_choice") {
    const exp = expandCallbackKey(payload);
    const pendingId2 = exp ? exp.pendingId : payload;
    const choice = exp ? exp.suffix : null;
    const pending = await getPending(fromId, pendingId2);
    if (!pending) { await answerCallback(callbackId, "Pending expired"); return; }
    pending.args = pending.args || {}; pending.args.mode = choice;
    if ((choice || '').toLowerCase().startsWith('ai')) {
      pending.state = "awaiting_ai_variant"; await savePending(fromId, pending); await answerCallback(callbackId, `Selected ${choice}`);
      const user = await kvGet(`user:${fromId}`); await sendMessage(chatId, TRANSLATIONS[user.lang].ai_variant_prompt, { inline_keyboard: buildAiVariantKeyboard(pending.id) }); return;
    }
    pending.state = "awaiting_bot_choice"; await savePending(fromId, pending);
    const u = await kvGet(`user:${fromId}`);
    if (!u || !u.bots || Object.keys(u.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[u?.lang || 'ky'].bot_list_empty); await removePending(fromId, pending.id); return; }
    await answerCallback(callbackId, `Selected ${choice}`); await sendMessage(chatId, TRANSLATIONS[u.lang].choose_bot_after_ai, { inline_keyboard: buildBotSelectionKeyboard(u.bots, pending.id) }); return;
  }

  if (action === "ai_variant") {
    const exp = expandCallbackKey(payload);
    const pendingId2 = exp ? exp.pendingId : payload;
    const variantName = exp ? exp.suffix : null;
    const pending = await getPending(fromId, pendingId2);
    if (!pending) { await answerCallback(callbackId, "Pending expired"); return; }
    // Adam_D'H7 V1 default
    if (variantName && variantName.includes("Adam_D'H7")) {
      pending.args = pending.args || {}; pending.args.aiConfig = { name: "Adam_D'H7 V1", model: GOOGLE_MODEL, base: GOOGLE_BASE, api_key: GOOGLE_API_KEY };
      pending.state = "awaiting_ai_info"; await savePending(fromId, pending);
      await answerCallback(callbackId, `Selected ${variantName}`); await sendMessage(chatId, TRANSLATIONS[(await kvGet(`user:${fromId}`)).lang].ask_ai_info); return;
    }
    await answerCallback(callbackId, "Variant unknown"); return;
  }

  await answerCallback(callbackId, "Unknown callback");
}

/* ---------- Main message handler ---------- */
async function handleTelegramMessage(update) {
  if (update.callback_query) return await handleCallbackQuery(update.callback_query);
  if (!update.message) return;
  const msg = update.message;
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = (msg.text || "").trim();

  let user = await kvGet("user:" + userId);
  if (!user) { user = { lang: "ky", bots: {} }; await kvPut("user:" + userId, user); }
  const lang = user.lang || "ky";

  // awaiting commands
  const awaitingCommands = await findPendingByState(userId, "awaiting_commands");
  if (!msg.photo && awaitingCommands && awaitingCommands.cmd === "kòmand" && text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const commands = [];
    for (const line of lines) {
      const idx = line.indexOf("-");
      if (idx === -1) continue;
      const commandName = line.slice(0, idx).trim();
      const desc = line.slice(idx + 1).trim();
      const cmdName = commandName.startsWith("/") ? commandName.slice(1) : commandName;
      if (!/^[a-z0-9_]+$/i.test(cmdName)) continue;
      commands.push({ command: cmdName, description: desc });
    }
    if (!commands.length) { await sendMessage(chatId, TRANSLATIONS[lang].error + " No valid commands parsed."); return; }
    awaitingCommands.args = awaitingCommands.args || {}; awaitingCommands.args.parsedCommands = commands; awaitingCommands.state = "confirmed";
    await savePending(userId, awaitingCommands); await executePending(userId, awaitingCommands); return;
  }

  const awaitingText = await findPendingByState(userId, "awaiting_text");
  if (!msg.photo && awaitingText && awaitingText.cmd === "notif_texte" && text) {
    awaitingText.args = awaitingText.args || {}; awaitingText.args.text = text; awaitingText.state = "confirmed";
    await savePending(userId, awaitingText); await executePending(userId, awaitingText); return;
  }

  const awaitingAiInfo = await findPendingByState(userId, "awaiting_ai_info");
  if (!msg.photo && awaitingAiInfo && awaitingAiInfo.cmd === "activate_flow" && text) {
    const p = awaitingAiInfo;
    if (text.toLowerCase() === "default") {
      // keep aiConfig already set to default
    } else {
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      const cfg = p.args.aiConfig || {};
      for (const line of lines) {
        if (line.toLowerCase().startsWith("apikey:")) cfg.api_key = line.split(":").slice(1).join(":").trim();
        else if (line.toLowerCase().startsWith("prompt:")) cfg.prompt = line.split(":").slice(1).join(":").trim();
        else cfg.prompt = cfg.prompt ? (cfg.prompt + "\n" + line) : line;
      }
      p.args.aiConfig = cfg;
    }
    p.state = "awaiting_bot_choice_for_ai"; await savePending(userId, p);
    const u = await kvGet(`user:${userId}`);
    if (!u || !u.bots || Object.keys(u.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, p.id); return; }
    await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_after_ai, { inline_keyboard: buildBotSelectionKeyboard(u.bots, p.id) }); return;
  }

  if (msg.photo && msg.photo.length) {
    const photoObj = msg.photo[msg.photo.length - 1];
    const fileId = photoObj.file_id;
    const pendingId = genPendingId();
    const pending = { id: pendingId, cmd: "foto", args: { file_id: fileId }, fromId: userId, chatId, createdAt: Date.now() };
    await savePending(userId, pending);
    if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; }
    const kb = buildBotSelectionKeyboard(user.bots, pendingId);
    await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb }); return;
  }

  if (isProbablyToken(text)) {
    return await registerNewBotFlow(userId, chatId, text, lang);
  }

  const parts = text.split(" ").filter(Boolean);
  const cmd = (parts[0] || "").toLowerCase();

  if (cmd === "/start") {
    const tr = TRANSLATIONS[user.lang] || TRANSLATIONS.ky;
    const body = [tr.menu_title, "", ...tr.menu_lines].join("\n");
    await sendMessage(chatId, body); return;
  }

  if (cmd === "/lang") {
    const raw = parts.slice(1).join(" ");
    const mapped = mapLangInputToCode(raw);
    if (!mapped) { await sendMessage(chatId, TRANSLATIONS[lang].usage_lang || "Use: /lang Kreyòl|Français|English|Español"); return; }
    user.lang = mapped; await kvPut("user:" + userId, user);
    await sendMessage(chatId, `${TRANSLATIONS[mapped].lang_changed || "Lang changed to:"} ${TRANSLATIONS[mapped].name}`); return;
  }

  const tokenRequiredCmds = {
    "/description":"description","/info":"info","/setabouttext":"setabouttext",
    "/non":"non","/kòmand":"kòmand","/antre_nan_group_wi":"antre_nan_group_wi",
    "/bot_prive":"bot_prive","/revokel":"revokel","/sip_bot":"sip_bot","/foto":"foto","/notif_texte":"notif_texte"
  };

  if (tokenRequiredCmds[cmd]) {
    const short = tokenRequiredCmds[cmd];
    let codeArg = parts[1] || "";
    let rest = parts.slice(2).join(" ");
    if (short === "notif_texte") {
      const textToSend = parts.slice(1).join(" ");
      const pendingId = genPendingId();
      const pending = { id: pendingId, cmd: "notif_texte", args: { text: textToSend || null }, fromId: userId, chatId, createdAt: Date.now() };
      await savePending(userId, pending);
      if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; }
      const kb = buildBotSelectionKeyboard(user.bots, pendingId);
      await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb }); return;
    }
    const pendingId = genPendingId();
    const pending = { id: pendingId, cmd: short, args: { code: codeArg || null, rest: rest || null }, fromId: userId, chatId, createdAt: Date.now() };
    await savePending(userId, pending);
    if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; }
    if (codeArg && user.bots[codeArg]) {
      const bot = user.bots[codeArg]; const label = bot.info && bot.info.username ? "@" + bot.info.username : codeArg;
      const kb = buildConfirmKeyboard(pendingId, codeArg);
      await sendMessage(chatId, `${TRANSLATIONS[lang].confirm_prompt} ${label}`, { inline_keyboard: kb }); return;
    }
    const kb = buildBotSelectionKeyboard(user.bots, pendingId);
    await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb }); return;
  }

  if (cmd === "/bot" || cmd === "/nouvo_bot" || cmd === "/newbot") {
    const token = parts[1] || "";
    if (!token) { await sendMessage(chatId, TRANSLATIONS[lang].ask_token_format || "Send /bot <TOKEN>"); return; }
    return await registerNewBotFlow(userId, chatId, token, lang);
  }

  if (cmd === "/token_mw") {
    const pendingId = genPendingId();
    const pending = { id: pendingId, cmd: "show_token", args: {}, fromId: userId, chatId, createdAt: Date.now() };
    await savePending(userId, pending);
    if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; }
    const kb = buildBotSelectionKeyboard(user.bots, pendingId);
    await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb }); return;
  }

  if (cmd === "/lis_bot" || cmd === "/bot_mw") {
    const entries = Object.entries(user.bots || {});
    if (!entries.length) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); return; }
    const lines = entries.map(([code, b]) => { const uname = b.info?.username ? "@" + b.info.username : "(no username)"; return `${uname} — ${code}`; });
    const kb = entries.map(([code, b]) => {
      if (b.info?.username) return [{ text: `Open ${"@" + b.info.username}`, url: `https://t.me/${b.info.username}` }];
      return [{ text: `${code}`, callback_data: `noop:${code}` }];
    });
    await sendMessage(chatId, lines.join("\n"));
    await sendMessage(chatId, "Quick actions:", { inline_keyboard: kb }); return;
  }

  if (cmd === "/bot_vivan") {
    const list = Object.entries(user.bots || {}).filter(([_, b]) => b.active).map(([c, b]) => `${b.info?.username ? "@" + b.info.username : c}`);
    await sendMessage(chatId, (list.length ? list.join("\n") : TRANSLATIONS[lang].bot_list_empty)); return;
  }

  // Activation start
  if (cmd === "/aktive_sal_ye") {
    const pendingId = genPendingId();
    const pending = { id: pendingId, cmd: "activate_flow", args: {}, fromId: userId, chatId, createdAt: Date.now() };
    await savePending(userId, pending);
    const kb = buildActivationChoiceKeyboard(pendingId, lang);
    await sendMessage(chatId, TRANSLATIONS[lang].choose_activation_prompt, { inline_keyboard: kb }); return;
  }

  await sendMessage(chatId, TRANSLATIONS[lang].unknown_cmd || "Unknown command. Use /start.");
}

/* ---------- Fetch handler ---------- */
async function handleRequest(request) {
  if (request.method === "GET") return new Response("Telegram Worker Bot Actif (gestion bots)", { status: 200 });
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

/* ---------- small util mapLangInputToCode ---------- */
function mapLangInputToCode(input) {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (["kreyòl","kreyol","ky"].includes(s)) return "ky";
  if (["français","francais","fr","french"].includes(s)) return "fr";
  if (["english","en","ang"].includes(s)) return "en";
  if (["español","espanol","es","spanish"].includes(s)) return "es";
  return null;
    }
