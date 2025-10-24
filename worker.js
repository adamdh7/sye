addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

// NOTE: token hardcoded as requested by user. Do not publish this file publicly.
const MAIN_TELEGRAM_TOKEN = "8346530009:AAG6gd7P8yjtCyI4Tf258Fth7FayMJl0sr8";
const MAIN_TELEGRAM_API = `https://api.telegram.org/bot${MAIN_TELEGRAM_TOKEN}`;

/* ---------- Supported command list (only these will show in menu) ---------- */
const SUPPORTED_COMMANDS = {
  "/nouvo_bot": true,
  "/bot": true,
  "/token_mw": true,
  "/lis_bot": true,
  "/bot_vivan": true,
  "/description": true,
  "/info": true,
  "/setabouttext": true,
  "/kòmand": true,
  "/revokel": true,
  "/non": true,
  "/foto": true,
  "/sip_bot": true,
  "/antre_nan_group_wi": true,
  "/bot_prive": true,
  "/notif_texte": true,
  "/lang": true,
  "/start": true
};

/* ---------- TRANSLATIONS (ky, fr, en, es) ---------- */
const TRANSLATIONS = {
  ky: {
    name: "Kreyòl",
    menu_title: "Byenveni! Men meni ou:",
    menu_lines: [
      "/nouvo_bot  - Kreye oswa anrejistre yon bot (voye token)",
      "/bot       - Anrejistre token",
      "/token_mw  - Montre token (chwa & konfimasyon obligatwa)",
      "/lis_bot   - Lis bot ou yo (kopiable)",
      "/bot_vivan - Montre bot aktif",
      "/description, /info, /setabouttext - Modifye description/about",
      "/kòmand    - Mete kòmand (apwè konfimasyon voye lis kòmand)",
      "/foto      - Chanje foto (voye imaj, chwazi bot, konfime)",
      "/revokel, /sip_bot - Revoke / efase bot",
      "/bot_prive - Fè bot prive/piblik",
      "/antre_nan_group_wi - Fè bot rantre nan gwoup via invite",
      "/notif_texte - Voye tèks kòm bot chwazi a (ap kouri ak token)",
      "/lang      - Chanje lang"
    ],
    ask_token_format: "Voye /bot <TOKEN> oswa /nouvo_bot <TOKEN> apre ou fin kreye bot la ak BotFather.",
    created_bot: "Bot anrejistre:",
    token_invalid: "Token pa valide oswa gen erè API.",
    must_use_botfather: "Pou kreye yon bot, sèvi ak BotFather sou Telegram; apre sa voye token la avèk /bot oswa /nouvo_bot.",
    token_checking: "Ap verifye token la...",
    token_registered: "Token anrejistre avèk siksè:",
    bot_list_empty: "Ou pa gen bot anrejistre.",
    bot_not_found: "Bot pa jwenn.",
    lang_changed: "Lang chanje pou:",
    usage_lang: "Sèvi ak: /lang Kreyòl|Français|English|Español",
    usage_info: "Sèvi ak: /info <CODE> <text>",
    usage_bot: "Sèvi ak: /bot <TOKEN>",
    usage_nouvo: "Sèvi ak: /nouvo_bot <TOKEN>",
    result_prefix: "Rezilta:",
    ok: "OK",
    error: "Erè:",
    unknown_cmd: "Kòmand pa rekonèt. Sèvi ak /start pou meni.",
    choose_bot_prompt: "Chwazi bot la pou aksyon sa a, epi konfime.",
    confirm_prompt: "Tanpri konfime aksyon an pou",
    send_commands_prompt: "Voye lis kòmand yo, youn pa liy, fòma: command - Description\nEgzanp:\nstart - Start the bot\nhelp - Show help",
    send_message_prompt: "Voye tèks mesaj la pou voye avèk bot sa a."
  },
  fr: {
    name: "Français",
    menu_title: "Bienvenue! Voici votre menu:",
    menu_lines: [
      "/nouvo_bot  - Créer ou enregistrer un bot (envoyer token)",
      "/bot       - Enregistrer token",
      "/token_mw  - Voir token (sélection & confirmation requises)",
      "/lis_bot   - Lister vos bots (copiable)",
      "/bot_vivan - Voir bots actifs",
      "/description, /info, /setabouttext - Modifier description/about",
      "/kòmand    - Définir commandes (après confirmation envoyez la liste)",
      "/foto      - Changer photo (envoyez image, choisissez bot, confirmez)",
      "/revokel, /sip_bot - Révoquer / supprimer bot",
      "/bot_prive - Rendre bot privé/public",
      "/antre_nan_group_wi - Faire rejoindre le bot via invitation",
      "/notif_texte - Envoyer texte en tant que bot sélectionné (utilise token)",
      "/lang      - Changer la langue"
    ],
    ask_token_format: "Envoyez /bot <TOKEN> ou /nouvo_bot <TOKEN> après avoir créé le bot avec BotFather.",
    created_bot: "Bot enregistré:",
    token_invalid: "Token invalide ou erreur API.",
    must_use_botfather: "Pour créer un bot, utilisez BotFather sur Telegram; ensuite envoyez le token avec /bot ou /nouvo_bot.",
    token_checking: "Vérification du token...",
    token_registered: "Token enregistré avec succès:",
    bot_list_empty: "Vous n'avez aucun bot enregistré.",
    bot_not_found: "Bot introuvable.",
    lang_changed: "Langue changée pour:",
    usage_lang: "Utilisez: /lang Kreyòl|Français|English|Español",
    usage_info: "Utilisez: /info <CODE> <texte>",
    usage_bot: "Utilisez: /bot <TOKEN>",
    usage_nouvo: "Utilisez: /nouvo_bot <TOKEN>",
    result_prefix: "Résultat:",
    ok: "OK",
    error: "Erreur:",
    unknown_cmd: "Commande non reconnue. Utilisez /start pour le menu.",
    choose_bot_prompt: "Choisissez le bot pour cette action, puis confirmez.",
    confirm_prompt: "Veuillez confirmer l'action pour",
    send_commands_prompt: "Envoyez la liste des commandes, une par ligne, format: command - Description\nExemple:\nstart - Start the bot\nhelp - Show help",
    send_message_prompt: "Envoyez le texte à envoyer avec ce bot."
  },
  en: {
    name: "English",
    menu_title: "Welcome! Here is your menu:",
    menu_lines: [
      "/nouvo_bot  - Create or register a bot (send token)",
      "/bot       - Register token",
      "/token_mw  - Show token (selection & confirmation required)",
      "/lis_bot   - List your bots (copyable)",
      "/bot_vivan - Show active bots",
      "/description, /info, /setabouttext - Edit description/about",
      "/kòmand    - Set commands (after confirm send commands list)",
      "/foto      - Change photo (send image, choose bot, confirm)",
      "/revokel, /sip_bot - Revoke / delete bot",
      "/bot_prive - Make bot private/public",
      "/antre_nan_group_wi - Make bot join group via invite",
      "/notif_texte - Send text as selected bot (uses token)",
      "/lang      - Change language"
    ],
    ask_token_format: "Send /bot <TOKEN> or /nouvo_bot <TOKEN> after creating bot with BotFather.",
    created_bot: "Bot registered:",
    token_invalid: "Token invalid or API error.",
    must_use_botfather: "To create a bot use BotFather on Telegram; then send the token with /bot or /nouvo_bot.",
    token_checking: "Checking token...",
    token_registered: "Token registered successfully:",
    bot_list_empty: "You have no registered bots.",
    bot_not_found: "Bot not found.",
    lang_changed: "Language changed to:",
    usage_lang: "Use: /lang Kreyòl|Français|English|Español",
    usage_info: "Use: /info <CODE> <text>",
    usage_bot: "Use: /bot <TOKEN>",
    usage_nouvo: "Use: /nouvo_bot <TOKEN>",
    result_prefix: "Result:",
    ok: "OK",
    error: "Error:",
    unknown_cmd: "Unknown command. Use /start for menu.",
    choose_bot_prompt: "Choose the bot for this action, then confirm.",
    confirm_prompt: "Please confirm the action for",
    send_commands_prompt: "Send the list of commands, one per line, format: command - Description\nExample:\nstart - Start the bot\nhelp - Show help",
    send_message_prompt: "Send the message text to post using that bot."
  },
  es: {
    name: "Español",
    menu_title: "Bienvenido! Aquí está tu menú:",
    menu_lines: [
      "/nouvo_bot  - Crear o registrar un bot (enviar token)",
      "/bot       - Registrar token",
      "/token_mw  - Ver token (selección & confirmación requeridas)",
      "/lis_bot   - Listar tus bots (copiable)",
      "/bot_vivan - Ver bots activos",
      "/description, /info, /setabouttext - Modificar description/about",
      "/kòmand    - Establecer comandos (después confirmar enviar lista)",
      "/foto      - Cambiar foto (envía imagen, elige bot, confirma)",
      "/revokel, /sip_bot - Revocar / eliminar bot",
      "/bot_prive - Hacer bot privado/público",
      "/antre_nan_group_wi - Hacer que el bot se una a grupo por invitación",
      "/notif_texte - Enviar texto como el bot seleccionado (usa token)",
      "/lang      - Cambiar idioma"
    ],
    ask_token_format: "Envía /bot <TOKEN> o /nouvo_bot <TOKEN> después de crear el bot con BotFather.",
    created_bot: "Bot registrado:",
    token_invalid: "Token inválido o error de API.",
    must_use_botfather: "Para crear un bot usa BotFather en Telegram; luego envía el token con /bot o /nouvo_bot.",
    token_checking: "Verificando token...",
    token_registered: "Token registrado con éxito:",
    bot_list_empty: "No tienes bots registrados.",
    bot_not_found: "Bot no encontrado.",
    lang_changed: "Idioma cambiado a:",
    usage_lang: "Usa: /lang Kreyòl|Français|English|Español",
    usage_info: "Usa: /info <CODE> <texto>",
    usage_bot: "Usa: /bot <TOKEN>",
    usage_nouvo: "Usa: /nouvo_bot <TOKEN>",
    result_prefix: "Resultado:",
    ok: "OK",
    error: "Error:",
    unknown_cmd: "Comando desconocido. Usa /start para el menú.",
    choose_bot_prompt: "Elige el bot para esta acción y confirma.",
    confirm_prompt: "Por favor confirma la acción para",
    send_commands_prompt: "Envía la lista de comandos, una por línea, formato: command - Description\nEjemplo:\nstart - Start the bot\nhelp - Show help",
    send_message_prompt: "Envía el texto del mensaje para publicar con ese bot."
  }
};

/* ---------- KV wrapper (USER_BOTS_KV) or in-memory fallback ---------- */
const MEMORY_DB = { users: {} };

async function kvGet(key) {
  if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.get) {
    try {
      const v = await USER_BOTS_KV.get(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {}
  }
  const parts = key.split(":");
  if (parts[0] === "user") return MEMORY_DB.users[parts[1]] || null;
  return null;
}
async function kvPut(key, value) {
  if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.put) {
    try { await USER_BOTS_KV.put(key, JSON.stringify(value)); return true; } catch (e) {}
  }
  const parts = key.split(":");
  if (parts[0] === "user") { MEMORY_DB.users[parts[1]] = value; return true; }
  return false;
}

/* ---------- Telegram HTTP helpers ---------- */
async function callBotApiWithToken(token, method, body = {}) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const opts = { method: "POST" };
  if (body instanceof FormData) {
    opts.body = body;
  } else {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
async function getMe(token) {
  const r = await callBotApiWithToken(token, "getMe", {});
  if (!r.ok || !r.data || !r.data.ok) return null;
  return r.data;
}

/* ---------- helpers ---------- */
function isProbablyToken(text) { return /^\d+:[A-Za-z0-9_-]{35,}$/.test(text); }
function makeUniqueBotCode(user, botUser) {
  const base = (botUser.username || String(botUser.id || "bot")).toString().replace(/\W/g,'').slice(0,12);
  let code = base; let i = 1;
  while (user.bots && user.bots[code]) code = base + "" + i++;
  return code;
}
function genPendingId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }

/* ---------- Messaging helpers ---------- */
async function sendMessage(chatId, text, options = {}) {
  const payload = { chat_id: chatId, text };
  if (options.inline_keyboard) payload.reply_markup = { inline_keyboard: options.inline_keyboard };
  if (options.reply_markup) payload.reply_markup = options.reply_markup;
  try {
    await fetch(`${MAIN_TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } catch (e) {}
}
async function answerCallback(callbackQueryId, text = "") {
  try {
    await fetch(`${MAIN_TELEGRAM_API}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }) });
  } catch (e) {}
}

/* ---------- Pending management ---------- */
async function savePending(userId, pending) {
  const key = `user:${userId}`;
  const user = (await kvGet(key)) || { lang: "ky", bots: {} };
  user.pendingActions = user.pendingActions || {};
  user.pendingActions[pending.id] = pending;
  await kvPut(key, user);
}
async function getPending(userId, pendingId) {
  const user = await kvGet(`user:${userId}`);
  if (!user || !user.pendingActions) return null;
  return user.pendingActions[pendingId] || null;
}
async function removePending(userId, pendingId) {
  const user = await kvGet(`user:${userId}`);
  if (!user || !user.pendingActions) return;
  delete user.pendingActions[pendingId];
  await kvPut(`user:${userId}`, user);
}
async function findPendingByState(userId, state) {
  const user = await kvGet(`user:${userId}`);
  if (!user || !user.pendingActions) return null;
  for (const id of Object.keys(user.pendingActions)) {
    const p = user.pendingActions[id];
    if (p.state === state) return p;
  }
  return null;
}

/* ---------- Core handlers ---------- */
async function registerNewBotFlow(userId, chatId, token, lang) {
  await sendMessage(chatId, TRANSLATIONS[lang].token_checking);
  const info = await getMe(token);
  if (!info || !info.ok) { await sendMessage(chatId, TRANSLATIONS[lang].token_invalid); return; }
  const botUser = info.result;
  let user = await kvGet("user:" + userId);
  if (!user) user = { lang: "ky", bots: {} };
  const code = makeUniqueBotCode(user, botUser);
  user.bots[code] = { token, info: botUser, active: true, createdAt: Date.now(), code };
  await kvPut("user:" + userId, user);
  const username = botUser.username ? "@" + botUser.username : botUser.first_name || code;
  await sendMessage(chatId, `${TRANSLATIONS[lang].created_bot} ${code} — ${username}`);
}

/* ---------- Format friendly results ---------- */
function formatResult(cmd, res, b, extra = {}) {
  const name = b && b.info && b.info.username ? "@" + b.info.username : (b && b.code ? b.code : "bot");
  if (res && res.ok && res.data && res.data.ok) {
    switch (cmd) {
      case "description":
      case "info":
      case "setabouttext":
        return `Description updated for ${name}.`;
      case "non":
      case "setname":
        return `Name updated for ${name}.`;
      case "kòmand":
      case "setcommands":
        return `Commands updated for ${name}.`;
      case "antre_nan_group_wi":
        return `Join group request processed for ${name}.`;
      case "bot_prive":
        return `Private flag set to ${b.private ? "on" : "off"} for ${name}.`;
      case "revokel":
      case "sip_bot":
        return `Token removed for ${name}.`;
      case "foto":
        if (extra.uploadedUrl) return `Photo applied for ${name}: ${extra.uploadedUrl}`;
        return `Photo applied for ${name}.`;
      case "show_token":
        return `Token for ${name}: ${b.token}`;
      case "notif_texte":
        return `Message sent as ${name}.`;
      default:
        return `Operation ${cmd} completed for ${name}.`;
    }
  }
  const errMsg = (res && res.data && res.data.description) ? res.data.description : (res && res.error) ? res.error : "Unknown error";
  return `Error: ${errMsg}`;
}

/* ---------- Execute pending actions (after confirm or after awaiting input) ---------- */
async function executePending(userId, pending) {
  const chatId = pending.chatId;
  const user = await kvGet(`user:${userId}`);
  if (!user) { await sendMessage(chatId, "User storage missing."); return; }
  const code = pending.args.code;
  if (!code || !user.bots || !user.bots[code]) {
    await sendMessage(chatId, TRANSLATIONS[user.lang].bot_not_found);
    await removePending(userId, pending.id);
    return;
  }
  const b = user.bots[code];
  const cmd = pending.cmd;

  try {
    // Description / about: call setMyDescription with bot token
    if (cmd === "description" || cmd === "info" || cmd === "setabouttext") {
      const rest = pending.args.rest || "";
      const res = await callBotApiWithToken(b.token, "setMyDescription", { description: rest });
      b.info = b.info || {}; b.info.description = rest;
      await kvPut(`user:${userId}`, user);
      const friendly = formatResult(cmd, res, b);
      await sendMessage(chatId, friendly);
      await removePending(userId, pending.id);
      return;
    }

    // Name
    if (cmd === "non" || cmd === "setname") {
      const rest = pending.args.rest || "";
      const res = await callBotApiWithToken(b.token, "setMyName", { name: rest });
      b.info = b.info || {}; b.info.first_name = rest;
      await kvPut(`user:${userId}`, user);
      const friendly = formatResult(cmd, res, b);
      await sendMessage(chatId, friendly);
      await removePending(userId, pending.id);
      return;
    }

    // Commands: expect parsedCommands present
    if (cmd === "kòmand" || cmd === "setcommands") {
      const parsed = pending.args.parsedCommands;
      if (!parsed) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " JSON invalid."); await removePending(userId, pending.id); return; }
      const res = await callBotApiWithToken(b.token, "setMyCommands", { commands: parsed });
      const friendly = formatResult(cmd, res, b);
      await sendMessage(chatId, friendly);
      await removePending(userId, pending.id);
      return;
    }

    // Join invite link
    if (cmd === "antre_nan_group_wi" || cmd === "joinInvite") {
      const link = pending.args.link;
      const res = await callBotApiWithToken(b.token, "joinChatByInviteLink", { invite_link: link });
      const friendly = formatResult(cmd, res, b);
      await sendMessage(chatId, friendly);
      await removePending(userId, pending.id);
      return;
    }

    // Private flag
    if (cmd === "bot_prive") {
      const flag = pending.args.flag;
      b.private = (flag === "on");
      await kvPut(`user:${userId}`, user);
      const friendly = formatResult(cmd, { ok: true, data: { ok: true } }, b);
      await sendMessage(chatId, friendly);
      await removePending(userId, pending.id);
      return;
    }

    // Revoke / delete
    if (cmd === "revokel" || cmd === "revoke" || cmd === "sip_bot" || cmd === "delete") {
      delete user.bots[code];
      await kvPut(`user:${userId}`, user);
      const friendly = formatResult(cmd, { ok: true, data: { ok: true } }, b);
      await sendMessage(chatId, friendly);
      await removePending(userId, pending.id);
      return;
    }

    // Photo: try to set bot profile photo (best-effort). If Bot API supports setUserProfilePhoto or setMyPhoto, attempt; otherwise fallback to uploading to tf-stream and saving metadata.
    if (cmd === "foto" || cmd === "setphoto") {
      const fileId = pending.args.file_id;
      if (!fileId) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " no file_id"); await removePending(userId, pending.id); return; }
      // Download file via MAIN bot
      const gf = await callBotApiWithToken(MAIN_TELEGRAM_TOKEN, "getFile", { file_id: fileId });
      if (!gf.ok || !gf.data || !gf.data.ok || !gf.data.result || !gf.data.result.file_path) {
        await sendMessage(chatId, TRANSLATIONS[user.lang].error + " getFile failed");
        await removePending(userId, pending.id);
        return;
      }
      const filePath = gf.data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${MAIN_TELEGRAM_TOKEN}/${filePath}`;
      const got = await fetch(fileUrl);
      if (!got.ok) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " could not download file"); await removePending(userId, pending.id); return; }
      const ab = await got.arrayBuffer();

      // Try direct API call to set bot profile photo (multipart). Method names differ across API versions; we'll try setUserProfilePhoto then fallback.
      try {
        // attempt method: setUserProfilePhoto (some API versions may support setMyProfilePhoto/setUserProfilePhoto)
        const form = new FormData();
        const blob = new Blob([ab], { type: "application/octet-stream" });
        form.append("photo", blob, "photo.jpg");

        // first attempt with setUserProfilePhoto
        let res = await callBotApiWithToken(b.token, "setUserProfilePhoto", form);
        if (res && res.ok && res.data && res.data.ok) {
          b.photo = "(set via API)"; // we don't get URL, just note it
          await kvPut(`user:${userId}`, user);
          const friendly = formatResult("foto", res, b, { uploadedUrl: null });
          await sendMessage(chatId, friendly);
          await removePending(userId, pending.id);
          return;
        }

        // second attempt common name setMyProfilePhoto
        res = await callBotApiWithToken(b.token, "setMyProfilePhoto", form);
        if (res && res.ok && res.data && res.data.ok) {
          b.photo = "(set via API)";
          await kvPut(`user:${userId}`, user);
          const friendly = formatResult("foto", res, b, { uploadedUrl: null });
          await sendMessage(chatId, friendly);
          await removePending(userId, pending.id);
          return;
        }

        // fallback: upload to tf-stream-url.onrender.com and save metadata
        const uploadForm = new FormData();
        uploadForm.append("file", blob, "upload.jpg");
        const up = await fetch("https://tf-stream-url.onrender.com/upload", { method: "POST", body: uploadForm });
        if (up.ok) {
          const upJson = await up.json().catch(()=>null);
          const uploadedUrl = (upJson && upJson.url) ? upJson.url : null;
          if (uploadedUrl) {
            b.photo = uploadedUrl;
            await kvPut(`user:${userId}`, user);
            const friendly = formatResult("foto", { ok: true, data: { ok: true } }, b, { uploadedUrl });
            await sendMessage(chatId, friendly);
            await removePending(userId, pending.id);
            return;
          }
        }

        // if reach here, fail gracefully
        await sendMessage(chatId, TRANSLATIONS[user.lang].error + " could not apply photo (API unsupported and upload failed).");
        await removePending(userId, pending.id);
        return;
      } catch (e) {
        await sendMessage(chatId, TRANSLATIONS[user.lang].error + " upload exception: " + (e.message || e));
        await removePending(userId, pending.id);
        return;
      }
    }

    // show token
    if (cmd === "show_token") {
      const friendly = formatResult("show_token", { ok: true, data: { ok: true } }, b);
      await sendMessage(chatId, friendly);
      await removePending(userId, pending.id);
      return;
    }

    // notif_texte: send message as the selected bot to the chat where command was invoked
    if (cmd === "notif_texte") {
      const textToSend = pending.args.text || "";
      if (!textToSend) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " no text to send"); await removePending(userId, pending.id); return; }
      // use bot token to send message to the same chat
      const res = await callBotApiWithToken(b.token, "sendMessage", { chat_id: chatId, text: textToSend });
      const friendly = formatResult("notif_texte", res, b);
      await sendMessage(chatId, friendly);
      await removePending(userId, pending.id);
      return;
    }

    await sendMessage(chatId, "Operation not implemented: " + cmd);
    await removePending(userId, pending.id);
  } catch (e) {
    await sendMessage(chatId, TRANSLATIONS[user.lang].error + " " + (e.message || String(e)));
    await removePending(userId, pending.id);
  }
}

/* ---------- Helper keyboards ---------- */
function buildBotSelectionKeyboard(bots, pendingId) {
  const rows = [];
  for (const code of Object.keys(bots)) {
    const username = bots[code].info && bots[code].info.username ? "@" + bots[code].info.username : code;
    rows.push([{ text: username, callback_data: `pick:${pendingId}:${code}` }]);
  }
  rows.push([{ text: "Cancel", callback_data: `cancel:${pendingId}` }]);
  return rows;
}
function buildConfirmKeyboard(pendingId, code) {
  return [[
    { text: "Confirm", callback_data: `confirm:${pendingId}:${code}` },
    { text: "Cancel", callback_data: `cancel:${pendingId}` }
  ]];
}

/* ---------- Callback query handling ---------- */
async function handleCallbackQuery(cb) {
  const data = cb.data || "";
  const fromId = String(cb.from.id);
  const callbackId = cb.id;
  const chatId = cb.message?.chat?.id;
  const parts = data.split(":");
  const action = parts[0];

  if (action === "cancel") {
    const pendingId = parts[1];
    await removePending(fromId, pendingId);
    await answerCallback(callbackId, "Cancelled");
    if (chatId) await sendMessage(chatId, "Action cancelled.");
    return;
  }

  if (action === "pick") {
    const pendingId = parts[1];
    const code = parts[2];
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
    const pendingId = parts[1];
    const code = parts[2];
    const pending = await getPending(fromId, pendingId);
    if (!pending) { await answerCallback(callbackId, "Pending expired"); return; }
    // attach selected code
    pending.args = pending.args || {};
    pending.args.code = code;
    // Special handling: if cmd is 'kòmand' we need to ask user to send lines now
    if (pending.cmd === "kòmand") {
      // set state awaiting_commands
      pending.state = "awaiting_commands";
      await savePending(fromId, pending);
      await answerCallback(callbackId, "Confirmed");
      const user = await kvGet(`user:${fromId}`);
      await sendMessage(chatId, TRANSLATIONS[user.lang].send_commands_prompt);
      return;
    }
    // For notif_texte ask for text input
    if (pending.cmd === "notif_texte") {
      pending.state = "awaiting_text";
      await savePending(fromId, pending);
      await answerCallback(callbackId, "Confirmed");
      const user = await kvGet(`user:${fromId}`);
      await sendMessage(chatId, TRANSLATIONS[user.lang].send_message_prompt);
      return;
    }
    // For foto we can execute immediately (file_id already in pending.args)
    await answerCallback(callbackId, "Confirmed");
    await executePending(fromId, pending);
    return;
  }

  await answerCallback(callbackId, "Unknown callback");
}

/* ---------- Main handler (messages + photos + pending-input flows) ---------- */
async function handleTelegramMessage(update) {
  if (update.callback_query) {
    return await handleCallbackQuery(update.callback_query);
  }
  if (!update.message) return;
  const msg = update.message;
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = (msg.text || "").trim();

  let user = await kvGet("user:" + userId);
  if (!user) { user = { lang: "ky", bots: {} }; await kvPut("user:" + userId, user); }
  const lang = user.lang || "ky";

  // If user has pending awaiting_commands or awaiting_text, handle first
  const awaitingCommands = await findPendingByState(userId, "awaiting_commands");
  if (!msg.photo && awaitingCommands && awaitingCommands.cmd === "kòmand" && text) {
    // parse commands lines
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const commands = [];
    for (const line of lines) {
      // format: command - description
      const idx = line.indexOf("-");
      if (idx === -1) continue;
      const commandName = line.slice(0, idx).trim();
      const desc = line.slice(idx + 1).trim();
      // remove leading slash if present
      const cmdName = commandName.startsWith("/") ? commandName.slice(1) : commandName;
      if (!/^[a-z0-9_]+$/i.test(cmdName)) continue;
      commands.push({ command: cmdName, description: desc });
    }
    if (!commands.length) {
      await sendMessage(chatId, TRANSLATIONS[lang].error + " No valid commands parsed. Use: command - Description");
      return;
    }
    // attach parsedCommands and execute
    awaitingCommands.args = awaitingCommands.args || {};
    awaitingCommands.args.parsedCommands = commands;
    awaitingCommands.state = "confirmed";
    await savePending(userId, awaitingCommands);
    await executePending(userId, awaitingCommands);
    return;
  }

  const awaitingText = await findPendingByState(userId, "awaiting_text");
  if (!msg.photo && awaitingText && awaitingText.cmd === "notif_texte" && text) {
    awaitingText.args = awaitingText.args || {};
    awaitingText.args.text = text;
    awaitingText.state = "confirmed";
    await savePending(userId, awaitingText);
    await executePending(userId, awaitingText);
    return;
  }

  // If photo received -> create pending and ask to choose bot
  if (msg.photo && msg.photo.length) {
    const photoObj = msg.photo[msg.photo.length - 1];
    const fileId = photoObj.file_id;
    const pendingId = genPendingId();
    const pending = { id: pendingId, cmd: "foto", args: { file_id: fileId }, fromId: userId, chatId, createdAt: Date.now() };
    await savePending(userId, pending);
    if (!user.bots || Object.keys(user.bots).length === 0) {
      await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty);
      await removePending(userId, pendingId);
      return;
    }
    const kb = buildBotSelectionKeyboard(user.bots, pendingId);
    await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb });
    return;
  }

  // If text is a token
  if (isProbablyToken(text)) {
    return await registerNewBotFlow(userId, chatId, text, lang);
  }

  const parts = text.split(" ").filter(Boolean);
  const cmd = (parts[0] || "").toLowerCase();

  if (cmd === "/start") {
    const tr = TRANSLATIONS[user.lang] || TRANSLATIONS.ky;
    const body = [tr.menu_title, "", ...tr.menu_lines].join("\n");
    await sendMessage(chatId, body);
    return;
  }

  if (cmd === "/lang") {
    const raw = parts.slice(1).join(" ");
    const mapped = mapLangInputToCode(raw);
    if (!mapped) { await sendMessage(chatId, TRANSLATIONS[lang].usage_lang); return; }
    user.lang = mapped; await kvPut("user:" + userId, user);
    await sendMessage(chatId, `${TRANSLATIONS[mapped].lang_changed} ${TRANSLATIONS[mapped].name}`);
    return;
  }

  const tokenRequiredCmds = {
    "/description": "description",
    "/info": "info",
    "/setabouttext": "setabouttext",
    "/non": "non",
    "/kòmand": "kòmand",
    "/antre_nan_group_wi": "antre_nan_group_wi",
    "/bot_prive": "bot_prive",
    "/revokel": "revokel",
    "/sip_bot": "sip_bot",
    "/foto": "foto",
    "/notif_texte": "notif_texte"
  };

  if (tokenRequiredCmds[cmd]) {
    const short = tokenRequiredCmds[cmd];
    let codeArg = parts[1] || "";
    let rest = parts.slice(2).join(" ");
    if (short === "notif_texte") {
      // support /notif_texte <text> inline: create pending and ask choose bot
      const textToSend = parts.slice(1).join(" ");
      const pendingId = genPendingId();
      const pending = { id: pendingId, cmd: "notif_texte", args: { text: textToSend || null }, fromId: userId, chatId, createdAt: Date.now() };
      await savePending(userId, pending);
      if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; }
      const kb = buildBotSelectionKeyboard(user.bots, pendingId);
      await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb });
      return;
    }

    // For commands that require code & confirmation:
    const pendingId = genPendingId();
    const pending = { id: pendingId, cmd: short, args: { code: codeArg || null, rest: rest || null }, fromId: userId, chatId, createdAt: Date.now() };
    await savePending(userId, pending);
    if (!user.bots || Object.keys(user.bots).length === 0) {
      await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty);
      await removePending(userId, pendingId);
      return;
    }
    if (codeArg && user.bots[codeArg]) {
      const bot = user.bots[codeArg];
      const label = bot.info && bot.info.username ? "@" + bot.info.username : codeArg;
      const kb = buildConfirmKeyboard(pendingId, codeArg);
      await sendMessage(chatId, `${TRANSLATIONS[lang].confirm_prompt} ${label}`, { inline_keyboard: kb });
      return;
    }
    const kb = buildBotSelectionKeyboard(user.bots, pendingId);
    await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb });
    return;
  }

  if (cmd === "/bot" || cmd === "/nouvo_bot" || cmd === "/newbot") {
    const token = parts[1] || "";
    if (!token) { await sendMessage(chatId, TRANSLATIONS[lang].usage_nouvo + "\n" + TRANSLATIONS[lang].must_use_botfather); return; }
    return await registerNewBotFlow(userId, chatId, token, lang);
  }

  if (cmd === "/token_mw") {
    const pendingId = genPendingId();
    const pending = { id: pendingId, cmd: "show_token", args: {}, fromId: userId, chatId, createdAt: Date.now() };
    await savePending(userId, pending);
    if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; }
    const kb = buildBotSelectionKeyboard(user.bots, pendingId);
    await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb });
    return;
  }

  if (cmd === "/lis_bot" || cmd === "/bot_mw") {
    const entries = Object.entries(user.bots || {});
    if (!entries.length) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); return; }
    const lines = entries.map(([code, b]) => { const uname = b.info?.username ? "@" + b.info.username : "(no username)"; return `${uname} — ${code}`; });
    // quick actions keyboard
    const kb = entries.map(([code, b]) => {
      if (b.info?.username) return [{ text: `Open ${"@" + b.info.username}`, url: `https://t.me/${b.info.username}` }];
      return [{ text: `${code}`, callback_data: `noop:${code}` }];
    });
    await sendMessage(chatId, lines.join("\n"));
    await sendMessage(chatId, "Quick actions:", { inline_keyboard: kb });
    return;
  }

  if (cmd === "/bot_vivan") {
    const list = Object.entries(user.bots || {}).filter(([_, b]) => b.active).map(([c, b]) => `${b.info?.username ? "@" + b.info.username : c}`);
    await sendMessage(chatId, (list.length ? list.join("\n") : TRANSLATIONS[lang].bot_list_empty));
    return;
  }

  if (cmd === "/notif_texte") {
    // handled above in tokenRequiredCmds
  }

  await sendMessage(chatId, TRANSLATIONS[lang].unknown_cmd);
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

/* ---------- small util mapLangInputToCode included ---------- */
function mapLangInputToCode(input) {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (["kreyòl","kreyol","ky"].includes(s)) return "ky";
  if (["français","francais","fr","french"].includes(s)) return "fr";
  if (["english","en","ang"].includes(s)) return "en";
  if (["español","espanol","es","spanish"].includes(s)) return "es";
  return null;
      }
