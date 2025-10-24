addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

const MAIN_TELEGRAM_TOKEN = "8346530009:AAG6gd7P8yjtCyI4Tf258Fth7FayMJl0sr8";
const MAIN_TELEGRAM_API = `https://api.telegram.org/bot${MAIN_TELEGRAM_TOKEN}`;
const SECRET_KEY = typeof SECRET_KEY !== "undefined" ? SECRET_KEY : "change_this_secret";

/* ---------- TRANSLATIONS (keys: ky, fr, en, es) ---------- */
const TRANSLATIONS = {
  ky: {
    name: "Kreyòl",
    menu_title: "Byenveni! Men meni ou — chwazi kòmand:",
    commands: [
      "/nouvo_bot <TOKEN> — Kreye / anrejistre nouvo bot (ou dwe deja kreye li ak BotFather)",
      "/bot <TOKEN> — Voye token pou anrejistre/modifie bot",
      "/token_mw — Montre bot mwen yo",
      "/description <CODE> <nouvo_descr> — Chanje deskripsyon",
      "/info <CODE> <nouvo_about> — Chanje about / setabouttext",
      "/setabouttext <CODE> <about> — menm bagay ak /info",
      "/lis_bot — Lis tout bot",
      "/bot_vivan — Bot ki aktif",
      "/kòmand <CODE> <json_commands> — Mete kòmand (json)",
      "/revokel <CODE> — Revoke / retire token",
      "/non <CODE> <nouvo non> — Chanje non bot",
      "/foto <CODE> <url_imaj> — Mete foto (metadata)",
      "/sip_bot <CODE> — Siprime bot",
      "/antre_nan_group_wi <CODE> <invite_link> — Fè bot antre nan group",
      "/bot_prive <CODE> <on|off> — Fè bot prive/oswa piblik",
      "/bot_mw — Wè bot ou yo",
      "/notif_texte <mesaj> — Voye notif (via MAIN bot)",
      "/lang <Kreyòl|Français|English|Español> — Chanje lang meni"
    ],
    ask_token_format: "Voye /bot <TOKEN> oswa /nouvo_bot <TOKEN> apre ou fin kreye bot la ak BotFather.",
    created_bot: "Bot anrejistre:",
    token_invalid: "Token pa valide oswa gen erè API.",
    must_use_botfather: "Pou kreye yon bot, sèvi ak BotFather sou Telegram; apre sa voye token la avèk /bot oswa /nouvo_bot.",
    token_checking: "Ap verifye token la...",
    token_registered: "Token anrejistre avèk siksè: ",
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
    unknown_cmd: 'Kòmand pa rekonèt. Sèvi ak /start pou meni.'
  },
  fr: {
    name: "Français",
    menu_title: "Bienvenue! Voici votre menu:",
    commands: [
      "/nouvo_bot <TOKEN> — Créer / enregistrer un nouveau bot (utilisez BotFather d'abord)",
      "/bot <TOKEN> — Envoyer token pour enregistrer/modifier un bot",
      "/token_mw — Voir mes bots",
      "/description <CODE> <nouvelle_descr> — Changer la description",
      "/info <CODE> <nouveau_about> — Changer about / setabouttext",
      "/setabouttext <CODE> <about> — même chose que /info",
      "/lis_bot — Lister tous les bots",
      "/bot_vivan — Bots actifs",
      "/kòmand <CODE> <json_commands> — Définir commandes (json)",
      "/revokel <CODE> — Révoquer / retirer token",
      "/non <CODE> <nouveau nom> — Changer le nom du bot",
      "/foto <CODE> <url_image> — Enregistrer photo (métadonnée)",
      "/sip_bot <CODE> — Supprimer bot",
      "/antre_nan_group_wi <CODE> <invite_link> — Faire entrer le bot dans un groupe",
      "/bot_prive <CODE> <on|off> — Rendre le bot privé/public",
      "/bot_mw — Voir vos bots",
      "/notif_texte <message> — Envoyer notification (via MAIN bot)",
      "/lang <Kreyòl|Français|English|Español> — Changer la langue du menu"
    ],
    ask_token_format: "Envoyez /bot <TOKEN> ou /nouvo_bot <TOKEN> après avoir créé le bot avec BotFather.",
    created_bot: "Bot enregistré:",
    token_invalid: "Token invalide ou erreur API.",
    must_use_botfather: "Pour créer un bot, utilisez BotFather sur Telegram; ensuite envoyez le token avec /bot ou /nouvo_bot.",
    token_checking: "Vérification du token...",
    token_registered: "Token enregistré avec succès: ",
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
    unknown_cmd: 'Commande non reconnue. Utilisez /start pour le menu.'
  },
  en: {
    name: "English",
    menu_title: "Welcome! Here is your menu:",
    commands: [
      "/nouvo_bot <TOKEN> — Create / register a new bot (use BotFather first)",
      "/bot <TOKEN> — Send token to register/modify a bot",
      "/token_mw — Show my bots",
      "/description <CODE> <new_descr> — Change description",
      "/info <CODE> <new_about> — Change about / setabouttext",
      "/setabouttext <CODE> <about> — same as /info",
      "/lis_bot — List all bots",
      "/bot_vivan — Active bots",
      "/kòmand <CODE> <json_commands> — Set commands (json)",
      "/revokel <CODE> — Revoke / remove token",
      "/non <CODE> <new name> — Change bot name",
      "/foto <CODE> <url_image> — Save photo (metadata)",
      "/sip_bot <CODE> — Delete bot",
      "/antre_nan_group_wi <CODE> <invite_link> — Make bot join group",
      "/bot_prive <CODE> <on|off> — Make bot private/public",
      "/bot_mw — See your bots",
      "/notif_texte <message> — Send notification (via MAIN bot)",
      "/lang <Kreyòl|Français|English|Español> — Change menu language"
    ],
    ask_token_format: "Send /bot <TOKEN> or /nouvo_bot <TOKEN> after creating bot with BotFather.",
    created_bot: "Bot registered:",
    token_invalid: "Token invalid or API error.",
    must_use_botfather: "To create a bot use BotFather on Telegram; then send the token with /bot or /nouvo_bot.",
    token_checking: "Checking token...",
    token_registered: "Token registered successfully: ",
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
    unknown_cmd: 'Unknown command. Use /start for menu.'
  },
  es: {
    name: "Español",
    menu_title: "¡Bienvenido! Aquí está tu menú:",
    commands: [
      "/nouvo_bot <TOKEN> — Crear / registrar un nuevo bot (usa BotFather primero)",
      "/bot <TOKEN> — Enviar token para registrar/modificar un bot",
      "/token_mw — Mostrar mis bots",
      "/description <CODE> <nueva_descr> — Cambiar la descripción",
      "/info <CODE> <nuevo_about> — Cambiar about / setabouttext",
      "/setabouttext <CODE> <about> — igual que /info",
      "/lis_bot — Listar todos los bots",
      "/bot_vivan — Bots activos",
      "/kòmand <CODE> <json_commands> — Establecer comandos (json)",
      "/revokel <CODE> — Revocar / eliminar token",
      "/non <CODE> <nuevo nombre> — Cambiar nombre del bot",
      "/foto <CODE> <url_imagen> — Guardar foto (metadatos)",
      "/sip_bot <CODE> — Eliminar bot",
      "/antre_nan_group_wi <CODE> <invite_link> — Hacer que el bot entre al grupo",
      "/bot_prive <CODE> <on|off> — Hacer bot privado/público",
      "/bot_mw — Ver tus bots",
      "/notif_texte <mensaje> — Enviar notificación (vía MAIN bot)",
      "/lang <Kreyòl|Français|English|Español> — Cambiar idioma del menú"
    ],
    ask_token_format: "Envía /bot <TOKEN> o /nouvo_bot <TOKEN> después de crear el bot con BotFather.",
    created_bot: "Bot registrado:",
    token_invalid: "Token inválido o error de API.",
    must_use_botfather: "Para crear un bot usa BotFather en Telegram; luego envía el token con /bot o /nouvo_bot.",
    token_checking: "Verificando token...",
    token_registered: "Token registrado con éxito: ",
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
    unknown_cmd: 'Comando desconocido. Usa /start para el menú.'
  }
};

/* ---------- KV wrapper (USER_BOTS_KV) or in-memory fallback ---------- */
const MEMORY_DB = { users: {} };

async function kvGet(key) {
  if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.get) {
    try { const v = await USER_BOTS_KV.get(key); return v ? JSON.parse(v) : null; } catch(e) {}
  }
  const parts = key.split(":");
  if (parts[0] === "user") return MEMORY_DB.users[parts[1]] || null;
  return null;
}
async function kvPut(key, value) {
  if (typeof USER_BOTS_KV !== "undefined" && USER_BOTS_KV && USER_BOTS_KV.put) {
    try { await USER_BOTS_KV.put(key, JSON.stringify(value)); return true; } catch(e) {}
  }
  const parts = key.split(":");
  if (parts[0] === "user") { MEMORY_DB.users[parts[1]] = value; return true; }
  return false;
}

/* ---------- Telegram API for user tokens ---------- */
async function callBotApiWithToken(token, method, body = {}) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const opts = { method: "POST" };
  if (body instanceof FormData) opts.body = body;
  else { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify(body); }
  try { const res = await fetch(url, opts); return res.json().catch(()=>null); } catch(e){ return null; }
}
async function getMe(token) { return callBotApiWithToken(token, "getMe", {}); }

/* ---------- Helpers ---------- */
function isProbablyToken(text) { return /^\d+:[A-Za-z0-9_-]{35,}$/.test(text); }
function mapLangInputToCode(input) {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (["kreyòl","kreyol","ky"].includes(s)) return "ky";
  if (["français","francais","fr","french"].includes(s)) return "fr";
  if (["english","en","ang"].includes(s)) return "en";
  if (["español","espanol","es","spanish"].includes(s)) return "es";
  return null;
}
function makeUniqueBotCode(user, botUser) {
  const base = (botUser.username || botUser.id || "bot").toString().replace(/\W/g,'_').slice(0,12);
  let code = base; let i = 1;
  while (user.bots && user.bots[code]) code = base + "_" + i++;
  return code;
}

/* ---------- Messaging via MAIN bot ---------- */
async function sendMessageToChat(chatId, text) {
  try {
    await fetch(`${MAIN_TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch(e){}
}

/* ---------- Core handlers ---------- */
async function registerNewBotFlow(userId, chatId, token, lang) {
  await sendMessageToChat(chatId, TRANSLATIONS[lang].token_checking);
  const info = await getMe(token);
  if (!info || !info.ok) { await sendMessageToChat(chatId, TRANSLATIONS[lang].token_invalid); return; }
  const botUser = info.result;
  let user = await kvGet("user:" + userId);
  if (!user) user = { lang: "ky", bots: {} };
  const code = makeUniqueBotCode(user, botUser);
  user.bots[code] = { token, info: botUser, active: true, createdAt: Date.now() };
  await kvPut("user:" + userId, user);
  await sendMessageToChat(chatId, `${TRANSLATIONS[lang].created_bot} ${code} — @${botUser.username || "?"}`);
}

async function setAboutTextForBot(userId, chatId, code, aboutText, lang) {
  if (!code || !aboutText) { await sendMessageToChat(chatId, TRANSLATIONS[lang].usage_info); return; }
  const user = await kvGet("user:" + userId);
  if (!user || !user.bots || !user.bots[code]) { await sendMessageToChat(chatId, TRANSLATIONS[lang].bot_not_found); return; }
  const b = user.bots[code];
  const res = await callBotApiWithToken(b.token, "setMyDescription", { description: aboutText });
  b.info = b.info || {}; b.info.description = aboutText;
  await kvPut("user:" + userId, user);
  await sendMessageToChat(chatId, `${TRANSLATIONS[lang].result_prefix} ${JSON.stringify(res)}`);
}

/* ---------- Main message processing ---------- */
async function handleTelegramMessage(update) {
  if (!update.message) return;
  const msg = update.message;
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = (msg.text || "").trim();

  let user = await kvGet("user:" + userId);
  if (!user) { user = { lang: "ky", bots: {} }; await kvPut("user:" + userId, user); }

  const lang = user.lang || "ky";

  if (isProbablyToken(text)) {
    return await registerNewBotFlow(userId, chatId, text, lang);
  }

  const parts = text.split(" ").filter(Boolean);
  const cmd = (parts[0] || "").toLowerCase();

  if (cmd === "/start") {
    const tr = TRANSLATIONS[user.lang] || TRANSLATIONS.ky;
    const body = [tr.menu_title, "", ...tr.commands].join("\n");
    await sendMessageToChat(chatId, body);
    return;
  }

  if (cmd === "/lang") {
    const raw = parts.slice(1).join(" ");
    const mapped = mapLangInputToCode(raw);
    if (!mapped) { await sendMessageToChat(chatId, TRANSLATIONS[lang].usage_lang); return; }
    user.lang = mapped; await kvPut("user:" + userId, user);
    await sendMessageToChat(chatId, `${TRANSLATIONS[mapped].lang_changed} ${TRANSLATIONS[mapped].name}`);
    return;
  }

  if (cmd === "/bot") {
    const token = parts[1] || "";
    if (!token) { await sendMessageToChat(chatId, TRANSLATIONS[lang].usage_bot); return; }
    return await registerNewBotFlow(userId, chatId, token, lang);
  }

  if (cmd === "/nouvo_bot" || cmd === "/newbot") {
    const token = parts[1] || "";
    if (!token) { await sendMessageToChat(chatId, TRANSLATIONS[lang].usage_nouvo + "\n" + TRANSLATIONS[lang].must_use_botfather); return; }
    return await registerNewBotFlow(userId, chatId, token, lang);
  }

  if (cmd === "/token_mw") {
    const list = Object.entries(user.bots || {}).map(([code, b]) => `${code} — ${b.info ? b.info.username : "unknown"}`);
    await sendMessageToChat(chatId, (list.length ? list.join("\n") : TRANSLATIONS[lang].bot_list_empty));
    return;
  }

  if (cmd === "/lis_bot" || cmd === "/bot_mw") {
    const list = Object.entries(user.bots || {}).map(([code, b]) => `${code} — ${b.info ? `${b.info.first_name || ""} @${b.info.username || ""}` : "unknown"} — active:${!!b.active}`);
    await sendMessageToChat(chatId, (list.length ? list.join("\n") : TRANSLATIONS[lang].bot_list_empty));
    return;
  }

  if (cmd === "/bot_vivan") {
    const list = Object.entries(user.bots || {}).filter(([_,b])=>b.active).map(([c,b])=>`${c} — @${b.info?.username||"?"}`);
    await sendMessageToChat(chatId, (list.length ? list.join("\n") : TRANSLATIONS[lang].bot_list_empty));
    return;
  }

  if (cmd === "/info" || cmd === "/setabouttext") {
    const code = parts[1];
    const rest = parts.slice(2).join(" ");
    return await setAboutTextForBot(userId, chatId, code, rest, lang);
  }

  if (cmd === "/description") {
    const code = parts[1]; const rest = parts.slice(2).join(" ");
    if (!code || !rest) { await sendMessageToChat(chatId, TRANSLATIONS[lang].usage_info); return; }
    const b = user.bots[code];
    if (!b) { await sendMessageToChat(chatId, TRANSLATIONS[lang].bot_not_found); return; }
    const res = await callBotApiWithToken(b.token, "setMyDescription", { description: rest });
    b.info = b.info || {}; b.info.description = rest;
    await kvPut("user:" + userId, user);
    await sendMessageToChat(chatId, `${TRANSLATIONS[lang].result_prefix} ${JSON.stringify(res)}`);
    return;
  }

  if (cmd === "/revokel") {
    const code = parts[1]; if (!code) { await sendMessageToChat(chatId, TRANSLATIONS[lang].error + " /revokel <CODE>"); return; }
    if (!user.bots[code]) { await sendMessageToChat(chatId, TRANSLATIONS[lang].bot_not_found); return; }
    delete user.bots[code]; await kvPut("user:" + userId, user);
    await sendMessageToChat(chatId, TRANSLATIONS[lang].ok + " — " + TRANSLATIONS[lang].result_prefix + " token removed");
    return;
  }

  if (cmd === "/non") {
    const code = parts[1]; const rest = parts.slice(2).join(" ");
    if (!code || !rest) { await sendMessageToChat(chatId, TRANSLATIONS[lang].error + " /non <CODE> <nouvo non>"); return; }
    const b = user.bots[code]; if (!b) { await sendMessageToChat(chatId, TRANSLATIONS[lang].bot_not_found); return; }
    const res = await callBotApiWithToken(b.token, "setMyName", { name: rest });
    b.info = b.info || {}; b.info.first_name = rest;
    await kvPut("user:" + userId, user);
    await sendMessageToChat(chatId, `${TRANSLATIONS[lang].result_prefix} ${JSON.stringify(res)}`);
    return;
  }

  if (cmd === "/foto") {
    const code = parts[1]; const urlImg = parts.slice(2).join(" ");
    if (!code || !urlImg) { await sendMessageToChat(chatId, TRANSLATIONS[lang].error + " /foto <CODE> <url_imaj>"); return; }
    const b = user.bots[code]; if (!b) { await sendMessageToChat(chatId, TRANSLATIONS[lang].bot_not_found); return; }
    b.photo = urlImg; await kvPut("user:" + userId, user);
    await sendMessageToChat(chatId, TRANSLATIONS[lang].ok + " — " + TRANSLATIONS[lang].result_prefix + " photo saved as metadata");
    return;
  }

  if (cmd === "/sip_bot") {
    const code = parts[1]; if (!code) { await sendMessageToChat(chatId, TRANSLATIONS[lang].error + " /sip_bot <CODE>"); return; }
    if (!user.bots[code]) { await sendMessageToChat(chatId, TRANSLATIONS[lang].bot_not_found); return; }
    delete user.bots[code]; await kvPut("user:" + userId, user);
    await sendMessageToChat(chatId, TRANSLATIONS[lang].ok + " — bot deleted");
    return;
  }

  if (cmd === "/bot_prive") {
    const code = parts[1]; const flag = (parts[2] || "").toLowerCase();
    if (!code || !["on","off"].includes(flag)) { await sendMessageToChat(chatId, TRANSLATIONS[lang].error + " /bot_prive <CODE> <on|off>"); return; }
    const b = user.bots[code]; if (!b) { await sendMessageToChat(chatId, TRANSLATIONS[lang].bot_not_found); return; }
    b.private = (flag === "on"); await kvPut("user:" + userId, user);
    await sendMessageToChat(chatId, TRANSLATIONS[lang].ok + " — private: " + b.private);
    return;
  }

  if (cmd === "/kòmand") {
    const code = parts[1]; const jsonText = parts.slice(2).join(" ");
    if (!code || !jsonText) { await sendMessageToChat(chatId, TRANSLATIONS[lang].error + " /kòmand <CODE> <json_commands>"); return; }
    const b = user.bots[code]; if (!b) { await sendMessageToChat(chatId, TRANSLATIONS[lang].bot_not_found); return; }
    let parsed;
    try { parsed = JSON.parse(jsonText); } catch(e) { await sendMessageToChat(chatId, TRANSLATIONS[lang].error + " JSON invalide."); return; }
    const res = await callBotApiWithToken(b.token, "setMyCommands", { commands: parsed });
    await sendMessageToChat(chatId, `${TRANSLATIONS[lang].result_prefix} ${JSON.stringify(res)}`);
    return;
  }

  if (cmd === "/antre_nan_group_wi") {
    const code = parts[1]; const link = parts.slice(2).join(" ");
    if (!code || !link) { await sendMessageToChat(chatId, TRANSLATIONS[lang].error + " /antre_nan_group_wi <CODE> <invite_link>"); return; }
    const b = user.bots[code]; if (!b) { await sendMessageToChat(chatId, TRANSLATIONS[lang].bot_not_found); return; }
    const res = await callBotApiWithToken(b.token, "joinChatByInviteLink", { invite_link: link });
    await sendMessageToChat(chatId, `${TRANSLATIONS[lang].result_prefix} ${JSON.stringify(res)}`);
    return;
  }

  if (cmd === "/notif_texte") {
    const m = parts.slice(1).join(" ");
    if (!m) { await sendMessageToChat(chatId, TRANSLATIONS[lang].error + " /notif_texte <mesaj>"); return; }
    await sendMessageToChat(chatId, TRANSLATIONS[lang].ok + " — " + TRANSLATIONS[lang].result_prefix + " notif sent (local demo)");
    return;
  }

  await sendMessageToChat(chatId, TRANSLATIONS[lang].unknown_cmd);
}

/* ---------- Fetch handler ---------- */
async function handleRequest(request) {
  if (request.method === "GET") return new Response("Telegram Worker Bot Actif (gestion bots)!", { status: 200 });
  if (request.method === "POST") {
    try {
      const update = await request.json();
      await handleTelegramMessage(update);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
    }
  }
  return new Response("Method not allowed", { status: 405 });
}
