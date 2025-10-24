addEventListener("fetch", event => { event.respondWith(handleRequest(event.request)); });

// NOTE: In production DO NOT keep secrets in source. This file includes a dev fallback to keep // functionality local during testing only. Replace with KV/Secrets before deploy.

/* ---------- CONFIG (use KV keys in production) ---------- */ let MAIN_TELEGRAM_TOKEN = null; // read from KV at startup (if available) const DEFAULT_ADAM_AI_CONFIG = { name: "Adam_D'H7 V1", model: "gemini-2.0-flash", base: "https://generativelanguage.googleapis.com", // You provided this key for local use. In production: set in KV and remove from code. api_key: "AIzaSyD7-VPQHG1q5-hS1pUfybggU4bgKAHAEmo" };

async function initSecrets() { if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.get) { try { MAIN_TELEGRAM_TOKEN = await USER_BOTS_KV.get("MAIN_TELEGRAM_TOKEN"); } catch(e){} // ensure string if (!MAIN_TELEGRAM_TOKEN) { // dev fallback: if not present, keep hardcoded token for local dev (REMOVE before public deploy) MAIN_TELEGRAM_TOKEN = "8346530009:AAG6gd7P8yjtCyI4Tf258Fth7FayMJl0sr8"; } } else { // no KV available — fallback (dev only) MAIN_TELEGRAM_TOKEN = "8346530009:AAG6gd7P8yjtCyI4Tf258Fth7FayMJl0sr8"; } }

/* ---------- Supported commands list (kept for menu) ---------- */ const SUPPORTED_COMMANDS = { "/nouvo_bot": true, "/bot": true, "/token_mw": true, "/lis_bot": true, "/bot_vivan": true, "/description": true, "/info": true, "/setabouttext": true, "/kòmand": true, "/revokel": true, "/non": true, "/foto": true, "/sip_bot": true, "/antre_nan_group_wi": true, "/bot_prive": true, "/notif_texte": true, "/lang": true, "/start": true, "/aktive_sal_ye": true // new activation flow command };

/* ---------- TRANSLATIONS (ky, fr, en, es) ---------- */ const TRANSLATIONS = { ky: { name: "Kreyòl", menu_title: "Byenveni! Men meni ou:", menu_lines: [ "/nouvo_bot  - Kreye oswa anrejistre yon bot (voye token)", "/bot       - Anrejistre token", "/token_mw  - Montre token (chwa & konfimasyon obligatwa)", "/lis_bot   - Lis bot ou yo (kopiable)", "/bot_vivan - Montre bot aktif", "/description, /info, /setabouttext - Modifye description/about", "/kòmand    - Mete kòmand (apwè konfimasyon voye lis kòmand)", "/foto      - Chanje foto (voye imaj, chwazi bot, konfime)", "/revokel, /sip_bot - Revoke / efase bot", "/bot_prive - Fè bot prive/piblik", "/antre_nan_group_wi - Fè bot rantre nan gwoup via invite", "/notif_texte - Voye tèks kòm bot chwazi a (ap kouri ak token)", "/lang      - Chanje lang", "/aktive_sal_ye - Aktive yon bòt (AI/BOT/AI+BOT)" ], ask_token_format: "Voye /bot <TOKEN> oswa /nouvo_bot <TOKEN> apre ou fin kreye bot la ak BotFather.", created_bot: "Bot anrejistre:", token_invalid: "Token pa valide oswa gen erè API.", must_use_botfather: "Pou kreye yon bot, sèvi ak BotFather sou Telegram; apre sa voye token la avèk /bot oswa /nouvo_bot.", token_checking: "Ap verifye token la...", token_registered: "Token anrejistre avèk siksè:", bot_list_empty: "Ou pa gen bot anrejistre.", bot_not_found: "Bot pa jwenn.", lang_changed: "Lang chanje pou:", usage_lang: "Sèvi ak: /lang Kreyòl|Français|English|Español", usage_info: "Sèvi ak: /info <CODE> <text>", usage_bot: "Sèvi ak: /bot <TOKEN>", usage_nouvo: "Sèvi ak: /nouvo_bot <TOKEN>", result_prefix: "Rezilta:", ok: "OK", error: "Erè:", unknown_cmd: "Kòmand pa rekonèt. Sèvi ak /start pou meni.", choose_bot_prompt: "Chwazi bot la pou aksyon sa a, epi konfime.", confirm_prompt: "Tanpri konfime aksyon an pou", send_commands_prompt: "Voye lis kòmand yo, youn pa liy, fòma: command - Description\nEgzanp:\nstart - Start the bot\nhelp - Show help", send_message_prompt: "Voye tèks mesaj la pou voye avèk bot sa a.", choose_activation_prompt: "Kisa ou vle aktive pou bot la? Chwazi yon opsyon:", activation_options: ["AI", "Bot", "AI & Bot"], ai_variant_prompt: "Chwazi vèsyon AI (eg Adam_D'H7 V1)", ask_ai_info: "Bay enfòmasyon pou konfigirasyon AI (prompt, api_key). Ou ka tape 'default' pou itilize Adam_D'H7 V1 default.", ai_config_saved: "Konfig AI an sove (san montre kle piblik la).", ai_activated: "Bot lan aktive avèk konfig AI. Si ou vle webhook pou resevwa mesaj otomatikman, mete WEBHOOK_BASE_URL nan KV ak URL worker ou.", activate_usage: "Sèvi ak: /aktive_sal_ye", cannot_set_webhook: "Pa kapab mete webhook otomatikman (pa gen WEBHOOK_BASE_URL defini). Mete li nan KV kòm 'WEBHOOK_BASE_URL' si ou vle webhook otomatik.", bot_mode_set: "Mode bot mete pou", choose_bot_after_ai: "Chwazi ki bot pou asiyen AI sa a", confirm_activate_bot: "Konfime aktyasyon bot la?" }, fr: { name: "Français", menu_title: "Bienvenue! Voici votre menu:", menu_lines: [ "/nouvo_bot  - Créer ou enregistrer un bot (envoyer token)", "/bot       - Enregistrer token", "/token_mw  - Voir token (sélection & confirmation requises)", "/lis_bot   - Lister vos bots (copiable)", "/bot_vivan - Voir bots actifs", "/description, /info, /setabouttext - Modifier description/about", "/kòmand    - Définir commandes (après confirmation envoyez la liste)", "/foto      - Changer photo (envoyez image, choisissez bot, confirmez)", "/revokel, /sip_bot - Révoquer / supprimer bot", "/bot_prive - Rendre bot privé/public", "/antre_nan_group_wi - Faire rejoindre le bot via invitation", "/notif_texte - Envoyer texte en tant que bot sélectionné (utilise token)", "/lang      - Changer la langue", "/aktive_sal_ye - Activer un bot (AI/BOT/AI+BOT)" ], ask_token_format: "Envoyez /bot <TOKEN> ou /nouvo_bot <TOKEN> après avoir créé le bot avec BotFather.", created_bot: "Bot enregistré:", token_invalid: "Token invalide ou erreur API.", must_use_botfather: "Pour créer un bot, utilisez BotFather sur Telegram; ensuite envoyez le token avec /bot ou /nouvo_bot.", token_checking: "Vérification du token...", token_registered: "Token enregistré avec succès:", bot_list_empty: "Vous n'avez aucun bot enregistré.", bot_not_found: "Bot introuvable.", lang_changed: "Langue changée pour:", usage_lang: "Utilisez: /lang Kreyòl|Français|English|Español", usage_info: "Utilisez: /info <CODE> <texte>", usage_bot: "Utilisez: /bot <TOKEN>", usage_nouvo: "Utilisez: /nouvo_bot <TOKEN>", result_prefix: "Résultat:", ok: "OK", error: "Erreur:", unknown_cmd: "Commande non reconnue. Utilisez /start pour le menu.", choose_bot_prompt: "Choisissez le bot pour cette action, puis confirmez.", confirm_prompt: "Veuillez confirmer l'action pour", send_commands_prompt: "Envoyez la liste des commandes, une par ligne, format: command - Description\nExemple:\nstart - Start the bot\nhelp - Show help", send_message_prompt: "Envoyez le texte à envoyer avec ce bot.", choose_activation_prompt: "Que souhaitez-vous activer pour le bot? Choisissez:", activation_options: ["AI", "Bot", "AI & Bot"], ai_variant_prompt: "Choisissez la version AI (ex Adam_D'H7 V1)", ask_ai_info: "Fournissez les informations pour configurer l'AI (prompt, api_key). Tapez 'default' pour utiliser Adam_D'H7 V1 par défaut.", ai_config_saved: "Configuration AI enregistrée (clé non affichée).", ai_activated: "Le bot a été activé avec la configuration AI. Pour recevoir des messages automatiquement, définissez WEBHOOK_BASE_URL en KV avec l'URL de votre worker.", activate_usage: "Utilisez: /aktive_sal_ye", cannot_set_webhook: "Impossible de définir le webhook automatiquement (WEBHOOK_BASE_URL non défini). Définissez-le en KV sous 'WEBHOOK_BASE_URL' si vous voulez le webhook automatique.", bot_mode_set: "Mode du bot défini pour", choose_bot_after_ai: "Choisissez quel bot assigner à cet AI", confirm_activate_bot: "Confirmez l'activation du bot?" }, en: { name: "English", menu_title: "Welcome! Here is your menu:", menu_lines: [ "/nouvo_bot  - Create or register a bot (send token)", "/bot       - Register token", "/token_mw  - Show token (selection & confirmation required)", "/lis_bot   - List your bots (copyable)", "/bot_vivan - Show active bots", "/description, /info, /setabouttext - Edit description/about", "/kòmand    - Set commands (after confirm send commands list)", "/foto      - Change photo (send image, choose bot, confirm)", "/revokel, /sip_bot - Revoke / delete bot", "/bot_prive - Make bot private/public", "/antre_nan_group_wi - Make bot join group via invite", "/notif_texte - Send text as selected bot (uses token)", "/lang      - Change language", "/aktive_sal_ye - Activate a bot (AI/BOT/AI+BOT)" ], ask_token_format: "Send /bot <TOKEN> or /nouvo_bot <TOKEN> after creating bot with BotFather.", created_bot: "Bot registered:", token_invalid: "Token invalid or API error.", must_use_botfather: "To create a bot use BotFather on Telegram; then send the token with /bot or /nouvo_bot.", token_checking: "Checking token...", token_registered: "Token registered successfully:", bot_list_empty: "You have no registered bots.", bot_not_found: "Bot not found.", lang_changed: "Language changed to:", usage_lang: "Use: /lang Kreyòl|Français|English|Español", usage_info: "Use: /info <CODE> <text>", usage_bot: "Use: /bot <TOKEN>", usage_nouvo: "Use: /nouvo_bot <TOKEN>", result_prefix: "Result:", ok: "OK", error: "Error:", unknown_cmd: "Unknown command. Use /start for menu.", choose_bot_prompt: "Choose the bot for this action, then confirm.", confirm_prompt: "Please confirm the action for", send_commands_prompt: "Send the list of commands, one per line, format: command - Description\nExample:\nstart - Start the bot\nhelp - Show help", send_message_prompt: "Send the message text to post using that bot.", choose_activation_prompt: "What do you want to activate for the bot? Choose:", activation_options: ["AI", "Bot", "AI & Bot"], ai_variant_prompt: "Choose AI variant (eg Adam_D'H7 V1)", ask_ai_info: "Provide information to configure the AI (prompt, api_key). Type 'default' to use Adam_D'H7 V1 defaults.", ai_config_saved: "AI config saved (api key not shown).", ai_activated: "Bot activated with AI config. If you want automatic webhook messages, set WEBHOOK_BASE_URL in KV to your worker URL.", activate_usage: "Use: /aktive_sal_ye", cannot_set_webhook: "Cannot set webhook automatically (WEBHOOK_BASE_URL not defined). Set it in KV as 'WEBHOOK_BASE_URL' if you want the webhook.", bot_mode_set: "Bot mode set for", choose_bot_after_ai: "Choose which bot to assign this AI to", confirm_activate_bot: "Confirm activation for this bot?" }, es: { name: "Español", menu_title: "Bienvenido! Aquí está tu menú:", menu_lines: [ "/nouvo_bot  - Crear o registrar un bot (enviar token)", "/bot       - Registrar token", "/token_mw  - Ver token (selección & confirmación requeridas)", "/lis_bot   - Listar tus bots (copiable)", "/bot_vivan - Ver bots activos", "/description, /info, /setabouttext - Modificar description/about", "/kòmand    - Establecer comandos (después confirmar enviar lista)", "/foto      - Cambiar foto (envía imagen, elige bot, confirma)", "/revokel, /sip_bot - Revocar / eliminar bot", "/bot_prive - Hacer bot privado/público", "/antre_nan_group_wi - Hacer que el bot se una a grupo por invitación", "/notif_texte - Enviar texto como el bot seleccionado (usa token)", "/lang      - Cambiar idioma", "/aktive_sal_ye - Activar un bot (AI/BOT/AI+BOT)" ], ask_token_format: "Envía /bot <TOKEN> o /nouvo_bot <TOKEN> después de crear el bot con BotFather.", created_bot: "Bot registrado:", token_invalid: "Token inválido o error de API.", must_use_botfather: "Para crear un bot usa BotFather en Telegram; luego envía el token con /bot o /nouvo_bot.", token_checking: "Verificando token...", token_registered: "Token registrado con éxito:", bot_list_empty: "No tienes bots registrados.", bot_not_found: "Bot no encontrado.", lang_changed: "Idioma cambiado a:", usage_lang: "Usa: /lang Kreyòl|Français|English|Español", usage_info: "Usa: /info <CODE> <texto>", usage_bot: "Usa: /bot <TOKEN>", usage_nouvo: "Usa: /nouvo_bot <TOKEN>", result_prefix: "Resultado:", ok: "OK", error: "Error:", unknown_cmd: "Comando desconocido. Usa /start para el menú.", choose_bot_prompt: "Elige el bot para esta acción y confirma.", confirm_prompt: "Por favor confirma la acción para", send_commands_prompt: "Envía la lista de comandos, una por línea, formato: command - Description\nEjemplo:\nstart - Start the bot\nhelp - Show help", send_message_prompt: "Envía el texto del mensaje para publicar con ese bot.", choose_activation_prompt: "¿Qué quieres activar para el bot? Elige:", activation_options: ["AI", "Bot", "AI & Bot"], ai_variant_prompt: "Elige la versión AI (ej Adam_D'H7 V1)", ask_ai_info: "Proporciona la información para configurar la AI (prompt, api_key). Escribe 'default' para usar Adam_D'H7 V1 por defecto.", ai_config_saved: "Configuración AI guardada (clave no mostrada).", ai_activated: "Bot activado con configuración AI. Si quieres webhooks automáticos, define WEBHOOK_BASE_URL en KV con la URL de tu worker.", activate_usage: "Usa: /aktive_sal_ye", cannot_set_webhook: "No se puede establecer webhook automáticamente (WEBHOOK_BASE_URL no definido). Defínelo en KV como 'WEBHOOK_BASE_URL' si quieres webhook automático.", bot_mode_set: "Modo bot establecido para", choose_bot_after_ai: "Elige qué bot asignar a este AI", confirm_activate_bot: "¿Confirmas la activación de este bot?" } };

/* ---------- KV wrapper (USER_BOTS_KV) or in-memory fallback ---------- */ const MEMORY_DB = { users: {}, pending: {} };

async function kvGet(key) { if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.get) { try { const v = await USER_BOTS_KV.get(key); return v ? JSON.parse(v) : null; } catch (e) {} } // fallback memory if (key.startsWith("user:")) return MEMORY_DB.users[key.split(":")[1]] || null; if (key.startsWith("pending:")) return MEMORY_DB.pending[key.split(":")[1]] || null; return null; } async function kvPut(key, value) { if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.put) { try { await USER_BOTS_KV.put(key, JSON.stringify(value)); return true; } catch (e) {} } if (key.startsWith("user:")) { MEMORY_DB.users[key.split(":")[1]] = value; return true; } if (key.startsWith("pending:")) { MEMORY_DB.pending[key.split(":")[1]] = value; return true; } return false; } async function kvDelete(key) { if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.delete) { try { await USER_BOTS_KV.delete(key); return true; } catch (e) {} } if (key.startsWith("user:")) { delete MEMORY_DB.users[key.split(":")[1]]; return true; } if (key.startsWith("pending:")) { delete MEMORY_DB.pending[key.split(":")[1]]; return true; } return false; }

/* ---------- Telegram HTTP helpers ---------- */ async function callBotApiWithToken(token, method, body = {}) { const url = https://api.telegram.org/bot${token}/${method}; const opts = { method: "POST" }; if (body instanceof FormData) { opts.body = body; } else { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify(body); } try { const res = await fetch(url, opts); let data = null; try { data = await res.json(); } catch (e) { data = null; } return { ok: res.ok, status: res.status, data }; } catch (e) { return { ok: false, error: (e && e.message) ? e.message : String(e) }; } } async function getMe(token) { const r = await callBotApiWithToken(token, "getMe", {}); if (!r.ok || !r.data || !r.data.ok) return null; return r.data; }

/* ---------- helpers ---------- */ function isProbablyToken(text) { return /^\d+:[A-Za-z0-9_-]{35,}$/.test(text); } function makeUniqueBotCode(user, botUser) { const base = (botUser.username || String(botUser.id || "bot")).toString().replace(/\W/g,'').slice(0,12); let code = base; let i = 1; while (user.bots && user.bots[code]) code = base + "" + i++; return code; } function genPendingId() { return ${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}; }

/* ---------- Callback short-map helpers (avoid long callback_data) ---------- */ const CALLBACK_MAP = {}; function shortCallbackKey(pendingId, suffix) { const key = "p" + Math.random().toString(36).slice(2,8); CALLBACK_MAP[key] = { pendingId, suffix }; return key; } function expandCallbackKey(key) { return CALLBACK_MAP[key] || null; }

/* ---------- Messaging helpers ---------- */ async function sendMessage(chatId, text, options = {}) { const payload = { chat_id: chatId, text }; if (options.inline_keyboard) payload.reply_markup = { inline_keyboard: options.inline_keyboard }; if (options.reply_markup) payload.reply_markup = options.reply_markup; try { await fetch(${MAIN_TELEGRAM_API}/sendMessage, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); } catch (e) { console.log('sendMessage error', e && e.message); } } async function answerCallback(callbackQueryId, text = "") { try { await fetch(${MAIN_TELEGRAM_API}/answerCallbackQuery, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }) }); } catch (e) { console.log('answerCallback error', e && e.message); } }

/* ---------- Pending management (per-pending keys for safety) ---------- */ async function savePending(userId, pending) { // store under pending:{id} await kvPut(pending:${pending.id}, pending); } async function getPending(userId, pendingId) { const p = await kvGet(pending:${pendingId}); return p || null; } async function removePending(userId, pendingId) { await kvDelete(pending:${pendingId}); } async function findPendingByState(userId, state) { // in-memory fallback only: scan MEMORY_DB.pending for (const id of Object.keys(MEMORY_DB.pending)) { const p = MEMORY_DB.pending[id]; if (p && p.fromId === userId && p.state === state) return p; } // KV case: no listing API implemented here - return null return null; }

/* ---------- Core handlers ---------- */ async function registerNewBotFlow(userId, chatId, token, lang) { await sendMessage(chatId, TRANSLATIONS[lang].token_checking); const info = await getMe(token); if (!info || !info.ok) { await sendMessage(chatId, TRANSLATIONS[lang].token_invalid); return; } const botUser = info.result; let user = await kvGet("user:" + userId); if (!user) user = { lang: "ky", bots: {} }; const code = makeUniqueBotCode(user, botUser); user.bots[code] = { token, info: botUser, active: true, createdAt: Date.now(), code, mode: "bot", aiConfig: null }; await kvPut("user:" + userId, user); const username = botUser.username ? "@" + botUser.username : botUser.first_name || code; await sendMessage(chatId, ${TRANSLATIONS[lang].created_bot} ${code} — ${username}); }

/* ---------- Format friendly results ---------- */ function formatResult(cmd, res, b, extra = {}) { const name = b && b.info && b.info.username ? "@" + b.info.username : (b && b.code ? b.code : "bot"); if (res && res.ok && res.data && res.data.ok) { switch (cmd) { case "description": case "info": case "setabouttext": return Description updated for ${name}.; case "non": case "setname": return Name updated for ${name}.; case "kòmand": case "setcommands": return Commands updated for ${name}.; case "antre_nan_group_wi": return Join group request processed for ${name}.; case "bot_prive": return Private flag set to ${b.private ? "on" : "off"} for ${name}.; case "revokel": case "sip_bot": return Token removed for ${name}.; case "foto": if (extra.uploadedUrl) return Photo applied for ${name}: ${extra.uploadedUrl}; return Photo applied for ${name}.; case "show_token": return Token for ${name}: ${b.token}; case "notif_texte": return Message sent as ${name}.; default: return Operation ${cmd} completed for ${name}.; } } const errMsg = (res && res.data && res.data.description) ? res.data.description : (res && res.error) ? res.error : "Unknown error"; return Error: ${errMsg}; }

/* ---------- Execute pending actions (after confirm or after awaiting input) ---------- */ async function executePending(userId, pending) { const chatId = pending.chatId; const user = await kvGet(user:${userId}); if (!user) { await sendMessage(chatId, "User storage missing."); return; } const code = pending.args && pending.args.code; if (!code || !user.bots || !user.bots[code]) { await sendMessage(chatId, TRANSLATIONS[user.lang].bot_not_found); await removePending(userId, pending.id); return; } const b = user.bots[code]; const cmd = pending.cmd;

try { // Description / about: call setMyDescription with bot token if (cmd === "description" || cmd === "info" || cmd === "setabouttext") { const rest = pending.args.rest || ""; const res = await callBotApiWithToken(b.token, "setMyDescription", { description: rest }); b.info = b.info || {}; b.info.description = rest; await kvPut(user:${userId}, user); const friendly = formatResult(cmd, res, b); await sendMessage(chatId, friendly); await removePending(userId, pending.id); return; }

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

  try {
    const form = new FormData();
    const blob = new Blob([ab], { type: "application/octet-stream" });
    form.append("photo", blob, "photo.jpg");

    let res = await callBotApiWithToken(b.token, "setUserProfilePhoto", form);
    if (res && res.ok && res.data && res.data.ok) {
      b.photo = "(set via API)";
      await kvPut(`user:${userId}`, user);
      const friendly = formatResult("foto", res, b, { uploadedUrl: null });
      await sendMessage(chatId, friendly);
      await removePending(userId, pending.id);
      return;
    }

    res = await callBotApiWithToken(b.token, "setMyProfilePhoto", form);
    if (res && res.ok && res.data && res.data.ok) {
      b.photo = "(set via API)";
      await kvPut(`user:${userId}`, user);
      const friendly = formatResult("foto", res, b, { uploadedUrl: null });
      await sendMessage(chatId, friendly);
      await removePending(userId, pending.id);
      return;
    }

    // fallback: upload to external uploader
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
  const res = await callBotApiWithToken(b.token, "sendMessage", { chat_id: chatId, text: textToSend });
  const friendly = formatResult("notif_texte", res, b);
  await sendMessage(chatId, friendly);
  await removePending(userId, pending.id);
  return;
}

// Activation flow: set bot mode and aiConfig
if (cmd === "activate_flow") {
  const mode = pending.args.mode; // "AI" | "Bot" | "AI&BOT"
  // attach ai config if provided
  if (pending.args.aiConfig) {
    b.aiConfig = pending.args.aiConfig;
  }
  // set mode mapping
  if (mode === "AI") b.mode = "ai";
  else if (mode === "Bot") b.mode = "bot";
  else if (mode === "AI&BOT" || mode === "AI & Bot" ) b.mode = "ai_bot";
  b.active = true;
  await kvPut(`user:${userId}`, user);

  // Try to set webhook automatically if WEBHOOK_BASE_URL in KV
  let webhookSet = false;
  try {
    if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.get) {
      const base = await USER_BOTS_KV.get("WEBHOOK_BASE_URL");
      if (base) {
        const webhookUrl = base.replace(/\/+$/,'') + "/telegram_webhook"; // user should route to worker path
        const res = await callBotApiWithToken(b.token, "setWebhook", { url: webhookUrl });
        if (res && res.ok && res.data && res.data.ok) webhookSet = true;
      }
    }
  } catch (e) { webhookSet = false; }

  const userLang = user.lang || 'ky';
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

} catch (e) { await sendMessage(chatId, TRANSLATIONS[user.lang].error + " " + (e.message || String(e))); await removePending(userId, pending.id); } }

/* ---------- Helper keyboards ---------- */ function buildBotSelectionKeyboard(bots, pendingId) { const rows = []; for (const code of Object.keys(bots)) { const username = bots[code].info && bots[code].info.username ? "@" + bots[code].info.username : code; const key = shortCallbackKey(pendingId, code); rows.push([{ text: username, callback_data: pick:${key} }]); } const cancelKey = shortCallbackKey(pendingId, "cancel"); rows.push([{ text: "Cancel", callback_data: cancel:${cancelKey} }]); return rows; } function buildConfirmKeyboard(pendingId, code) { const confirmKey = shortCallbackKey(pendingId, code); const cancelKey = shortCallbackKey(pendingId, "cancel"); return [[ { text: "Confirm", callback_data: confirm:${confirmKey} }, { text: "Cancel", callback_data: cancel:${cancelKey} } ]]; } function buildActivationChoiceKeyboard(pendingId, lang) { const opts = TRANSLATIONS[lang].activation_options || ["AI","Bot","AI & Bot"]; const rows = opts.map(o => [{ text: o, callback_data: activate_choice:${shortCallbackKey(pendingId,o)} }]); rows.push([{ text: "Cancel", callback_data: cancel:${shortCallbackKey(pendingId,'cancel')} }]); return rows; } function buildAiVariantKeyboard(pendingId) { // for now, only Adam_D'H7 V1 default offered const rows = [ [{ text: "Adam_D'H7 V1", callback_data: ai_variant:${shortCallbackKey(pendingId, "Adam_D'H7 V1")} }], [{ text: "Cancel", callback_data: cancel:${shortCallbackKey(pendingId,'cancel')} }] ]; return rows; }

/* ---------- Callback query handling ---------- */ async function handleCallbackQuery(cb) { const data = cb.data || ""; const fromId = String(cb.from.id); const callbackId = cb.id; const chatId = cb.message?.chat?.id; const parts = data.split(":"); const action = parts[0]; const payload = parts[1] || "";

// resolve short key mapping let pendingId = null; let codeOrSuffix = null; const expanded = expandCallbackKey(payload); if (expanded) { pendingId = expanded.pendingId; codeOrSuffix = expanded.suffix; } else { pendingId = payload; }

if (action === "cancel") { await removePending(fromId, pendingId); await answerCallback(callbackId, "Cancelled"); if (chatId) await sendMessage(chatId, "Action cancelled."); return; }

if (action === "noop") { await answerCallback(callbackId, "OK"); if (chatId) await sendMessage(chatId, "Action noted."); return; }

if (action === "pick") { const code = codeOrSuffix || parts[2]; const pending = await getPending(fromId, pendingId); if (!pending) { await answerCallback(callbackId, "Pending expired"); return; } const user = await kvGet(user:${fromId}); const bot = user?.bots?.[code]; const label = bot?.info?.username ? "@" + bot.info.username : code; const kb = buildConfirmKeyboard(pendingId, code); await answerCallback(callbackId, Selected ${label}); if (chatId) await sendMessage(chatId, ${TRANSLATIONS[user.lang].confirm_prompt} ${label}, { inline_keyboard: kb }); return; }

if (action === "confirm") { const code = codeOrSuffix || parts[2]; const pending = await getPending(fromId, pendingId); if (!pending) { await answerCallback(callbackId, "Pending expired"); return; } pending.args = pending.args || {}; pending.args.code = code; if (pending.cmd === "kòmand") { pending.state = "awaiting_commands"; await savePending(fromId, pending); await answerCallback(callbackId, "Confirmed"); const user = await kvGet(user:${fromId}); await sendMessage(chatId, TRANSLATIONS[user.lang].send_commands_prompt); return; } if (pending.cmd === "notif_texte") { pending.state = "awaiting_text"; await savePending(fromId, pending); await answerCallback(callbackId, "Confirmed"); const user = await kvGet(user:${fromId}); await sendMessage(chatId, TRANSLATIONS[user.lang].send_message_prompt); return; } // For activate_flow - if activation pending included ai selection earlier, execute await answerCallback(callbackId, "Confirmed"); await executePending(fromId, pending); return; }

// Activation flows if (action === "activate_choice") { const expanded = expandCallbackKey(payload); const pendingId2 = expanded ? expanded.pendingId : payload; const choice = expanded ? expanded.suffix : null; const pending = await getPending(fromId, pendingId2); if (!pending) { await answerCallback(callbackId, "Pending expired"); return; } // attach mode pending.args = pending.args || {}; pending.args.mode = choice; // If AI chosen, ask for ai variant if ((choice || '').toLowerCase().startsWith('ai')) { pending.state = "awaiting_ai_variant"; await savePending(fromId, pending); await answerCallback(callbackId, Selected ${choice}); if (chatId) await sendMessage(chatId, TRANSLATIONS[(await kvGet(user:${fromId})).lang].ai_variant_prompt, { inline_keyboard: buildAiVariantKeyboard(pending.id) }); return; } // If Bot only, ask user to pick which bot to apply await answerCallback(callbackId, Selected ${choice}); pending.state = "awaiting_bot_choice"; await savePending(fromId, pending); const u = await kvGet(user:${fromId}); if (!u || !u.bots || Object.keys(u.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[u.lang].bot_list_empty); await removePending(fromId, pending.id); return; } await sendMessage(chatId, TRANSLATIONS[u.lang].choose_bot_after_ai, { inline_keyboard: buildBotSelectionKeyboard(u.bots, pending.id) }); return; }

if (action === "ai_variant") { const expanded = expandCallbackKey(payload); const pendingId2 = expanded ? expanded.pendingId : payload; const variantName = expanded ? expanded.suffix : null; const pending = await getPending(fromId, pendingId2); if (!pending) { await answerCallback(callbackId, "Pending expired"); return; } // For now only Adam_D'H7 V1: attach default config and ask if user wants custom prompt/api key if (variantName && variantName.includes("Adam_D'H7")) { pending.args = pending.args || {}; pending.args.aiConfig = Object.assign({}, DEFAULT_ADAM_AI_CONFIG); pending.state = "awaiting_ai_info"; await savePending(fromId, pending); await answerCallback(callbackId, Selected ${variantName}); if (chatId) await sendMessage(chatId, TRANSLATIONS[(await kvGet(user:${fromId})).lang].ask_ai_info); return; } await answerCallback(callbackId, "Variant unknown"); return; }

await answerCallback(callbackId, "Unknown callback"); }

/* ---------- Main handler (messages + photos + pending-input flows) ---------- */ async function handleTelegramMessage(update) { if (update.callback_query) { return await handleCallbackQuery(update.callback_query); } if (!update.message) return; const msg = update.message; const chatId = msg.chat.id; const userId = String(msg.from.id); const text = (msg.text || "").trim();

let user = await kvGet("user:" + userId); if (!user) { user = { lang: "ky", bots: {} }; await kvPut("user:" + userId, user); } const lang = user.lang || "ky";

// Pending states handling const awaitingCommands = await findPendingByState(userId, "awaiting_commands"); if (!msg.photo && awaitingCommands && awaitingCommands.cmd === "kòmand" && text) { const lines = text.split("\n").map(l => l.trim()).filter(Boolean); const commands = []; for (const line of lines) { const idx = line.indexOf("-"); if (idx === -1) continue; const commandName = line.slice(0, idx).trim(); const desc = line.slice(idx + 1).trim(); const cmdName = commandName.startsWith("/") ? commandName.slice(1) : commandName; if (!/^[a-z0-9_]+$/i.test(cmdName)) continue; commands.push({ command: cmdName, description: desc }); } if (!commands.length) { await sendMessage(chatId, TRANSLATIONS[lang].error + " No valid commands parsed. Use: command - Description"); return; } awaitingCommands.args = awaitingCommands.args || {}; awaitingCommands.args.parsedCommands = commands; awaitingCommands.state = "confirmed"; await savePending(userId, awaitingCommands); await executePending(userId, awaitingCommands); return; }

const awaitingText = await findPendingByState(userId, "awaiting_text"); if (!msg.photo && awaitingText && awaitingText.cmd === "notif_texte" && text) { awaitingText.args = awaitingText.args || {}; awaitingText.args.text = text; awaitingText.state = "confirmed"; await savePending(userId, awaitingText); await executePending(userId, awaitingText); return; }

// AI config info input (after user typed prompt or "default") const awaitingAiInfo = await findPendingByState(userId, "awaiting_ai_info"); if (!msg.photo && awaitingAiInfo && awaitingAiInfo.cmd === "activate_flow" && text) { const p = awaitingAiInfo; // if user typed 'default', keep DEFAULT_ADAM_AI_CONFIG if (text.toLowerCase() === 'default') { // already attached in pending.args.aiConfig } else { // expect 'prompt:<text>' or 'apikey:<key>' or both lines const lines = text.split('\n').map(l=>l.trim()).filter(Boolean); const cfg = p.args.aiConfig || {}; for (const line of lines) { if (line.toLowerCase().startsWith('apikey:')) cfg.api_key = line.split(':').slice(1).join(':').trim(); else if (line.toLowerCase().startsWith('prompt:')) cfg.prompt = line.split(':').slice(1).join(':').trim(); else { // treat as prompt if no explicit label cfg.prompt = cfg.prompt ? (cfg.prompt + '\n' + line) : line; } } p.args.aiConfig = cfg; } // now ask to choose which bot to apply p.state = 'awaiting_bot_choice_for_ai'; await savePending(userId, p); const u = await kvGet(user:${userId}); if (!u || !u.bots || Object.keys(u.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, p.id); return; } await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_after_ai, { inline_keyboard: buildBotSelectionKeyboard(u.bots, p.id) }); return; }

// Photo -> create pending for set photo if (msg.photo && msg.photo.length) { const photoObj = msg.photo[msg.photo.length - 1]; const fileId = photoObj.file_id; const pendingId = genPendingId(); const pending = { id: pendingId, cmd: "foto", args: { file_id: fileId }, fromId: userId, chatId, createdAt: Date.now() }; await savePending(userId, pending); if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; } const kb = buildBotSelectionKeyboard(user.bots, pendingId); await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb }); return; }

// If text is a token if (isProbablyToken(text)) { return await registerNewBotFlow(userId, chatId, text, lang); }

const parts = text.split(" ").filter(Boolean); const cmd = (parts[0] || "").toLowerCase();

if (cmd === "/start") { const tr = TRANSLATIONS[user.lang] || TRANSLATIONS.ky; const body = [tr.menu_title, "", ...tr.menu_lines].join("\n"); await sendMessage(chatId, body); return; }

if (cmd === "/lang") { const raw = parts.slice(1).join(" "); const mapped = mapLangInputToCode(raw); if (!mapped) { await sendMessage(chatId, TRANSLATIONS[lang].usage_lang); return; } user.lang = mapped; await kvPut("user:" + userId, user); await sendMessage(chatId, ${TRANSLATIONS[mapped].lang_changed} ${TRANSLATIONS[mapped].name}); return; }

const tokenRequiredCmds = { "/description": "description", "/info": "info", "/setabouttext": "setabouttext", "/non": "non", "/kòmand": "kòmand", "/antre_nan_group_wi": "antre_nan_group_wi", "/bot_prive": "bot_prive", "/revokel": "revokel", "/sip_bot": "sip_bot", "/foto": "foto", "/notif_texte": "notif_texte" };

if (tokenRequiredCmds[cmd]) { const short = tokenRequiredCmds[cmd]; let codeArg = parts[1] || ""; let rest = parts.slice(2).join(" "); if (short === "notif_texte") { const textToSend = parts.slice(1).join(" "); const pendingId = genPendingId(); const pending = { id: pendingId, cmd: "notif_texte", args: { text: textToSend || null }, fromId: userId, chatId, createdAt: Date.now() }; await savePending(userId, pending); if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; } const kb = buildBotSelectionKeyboard(user.bots, pendingId); await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb }); return; }

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

if (cmd === "/bot" || cmd === "/nouvo_bot" || cmd === "/newbot") { const token = parts[1] || ""; if (!token) { await sendMessage(chatId, TRANSLATIONS[lang].usage_nouvo + "\n" + TRANSLATIONS[lang].must_use_botfather); return; } return await registerNewBotFlow(userId, chatId, token, lang); }

if (cmd === "/token_mw") { const pendingId = genPendingId(); const pending = { id: pendingId, cmd: "show_token", args: {}, fromId: userId, chatId, createdAt: Date.now() }; await savePending(userId, pending); if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; } const kb = buildBotSelectionKeyboard(user.bots, pendingId); await sendMessage(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb }); return; }

if (cmd === "/lis_bot" || cmd === "/bot_mw") { const entries = Object.entries(user.bots || {}); if (!entries.length) { await sendMessage(chatId, TRANSLATIONS[lang].bot_list_empty); return; } const lines = entries.map(([code, b]) => { const uname = b.info?.username ? "@" + b.info.username : "(no username)"; return ${uname} — ${code}; }); const kb = entries.map(([code, b]) => { if (b.info?.username) return [{ text: Open ${"@" + b.info.username}, url: https://t.me/${b.info.username} }]; return [{ text: ${code}, callback_data: noop:${code} }]; }); await sendMessage(chatId, lines.join("\n")); await sendMessage(chatId, "Quick actions:", { inline_keyboard: kb }); return; }

if (cmd === "/bot_vivan") { const list = Object.entries(user.bots || {}).filter(([_, b]) => b.active).map(([c, b]) => ${b.info?.username ? "@" + b.info.username : c}); await sendMessage(chatId, (list.length ? list.join("\n") : TRANSLATIONS[lang].bot_list_empty)); return; }

// NEW: Activation flow command if (cmd === "/aktive_sal_ye") { const pendingId = genPendingId(); const pending = { id: pendingId, cmd: "activate_flow", args: {}, fromId: userId, chatId, createdAt: Date.now() }; await savePending(userId, pending); // ask choice AI / Bot / AI & Bot const kb = buildActivationChoiceKeyboard(pendingId, lang); await sendMessage(chatId, TRANSLATIONS[lang].choose_activation_prompt, { inline_keyboard: kb }); return; }

// fallback await sendMessage(chatId, TRANSLATIONS[lang].unknown_cmd); }

/* ---------- Fetch handler ---------- */ async function handleRequest(request) { // init secrets before handling any request await initSecrets();

if (request.method === "GET") return new Response("Telegram Worker Bot Actif (gestion bots)", { status: 200 }); if (request.method === "POST") { try { const update = await request.json(); await handleTelegramMessage(update); return new Response(JSON.stringify({ ok: true }), { status: 200 }); } catch (err) { return new Response(JSON.stringify({ ok: false, error: err && err.message ? err.message : String(err) }), { status: 500 }); } } return new Response("Method not allowed", { status: 405 }); }

/* ---------- small util mapLangInputToCode included ---------- */ function mapLangInputToCode(input) { if (!input) return null; const s = input.trim().toLowerCase(); if (["kreyòl","kreyol","ky"].includes(s)) return "ky"; if (["français","francais","fr","french"].includes(s)) return "fr"; if (["english","en","ang"].includes(s)) return "en"; if (["español","espanol","es","spanish"].includes(s)) return "es"; return null; }
