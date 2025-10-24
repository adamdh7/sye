// Safe init to avoid redeclare errors on Cloudflare Workers hot-reload
if (!globalThis.__TERGENE_WORKER_INITIALIZED) {
  globalThis.__TERGENE_WORKER_INITIALIZED = true;

  addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
  });

  /* ================== CONFIG / SECRETS ================== */
  // WARNING: secrets in plain text as requested. Keep this file private.
  const MAIN_TELEGRAM_TOKEN = "8346530009:AAG6gd7P8yjtCyI4Tf258Fth7FayMJl0sr8";
  const GOOGLE_API_KEY = "AIzaSyD7-VPQHG1q5-hS1pUfybggU4bgKAHAEmo";
  const GOOGLE_MODEL = "gemini-2.0-flash";
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

  /* ================== TRANSLATIONS (Kreyòl / FR / EN / ES) ================== */
  const TRANSLATIONS = {
    ky: {
      name: "Kreyòl",
      menu_title: "Men meni prensipal la:",
      // start menu card (7 commands)
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
      send_commands_prompt: "Voye lis kòmand yo, youn pa liy, fòma: command - Description",
      send_message_prompt: "Voye tèks mesaj la pou voye avèk bot sa a.",
      choose_activation_prompt: "Chwazi sa w vle aktive pou bot la:",
      activation_options: ["AI","Bot","AI & Bot"],
      ai_variant_prompt: "Chwazi vèsyon AI (eg Adam_D'H7 V1)",
      ask_ai_info: "Bay enfòmasyon pou AI (eg: prompt:...) oswa tape 'default'.",
      ai_activated: "Bot lan aktive avèk konfig AI.",
      cannot_set_webhook: "Webhook pa mete otomatikman (WEBHOOK_BASE_URL pa defini).",
      choose_bot_after_ai: "Chwazi ki bot pou asiyen AI sa a",
      // /èd messages detail (long)
      help_title: "EDE - Eksplikasyon kòmand yo",
      help_intro: "Men eksplikasyon detaye sou chak kòmand (nan lang ou chwazi a).",
      help_commands: {
        "/lang": "Chanje lang: Eg: /lang Kreyòl oswa /lang English. Tout tèks entèfas ap chanje apre sa.",
        "/aktive": "Kòmand pou aktive yon bot; li pèmèt ou asiyen yon AI (Adam_D'H7) oswa mete li kòm bot sèlman oswa AI+Bot. Apre chwa ou pral chwazi bot pou aplike konfig la.",
        "/èd": "Montre eksplikasyon detaye sou chak kòmand. (W ap wè sa kouwap li kounye a.)",
        "/bot": "Enskri/kreye yon bot: Voye token (fè ak BotFather) ak /bot <TOKEN>. Kòd la verifye token epi sove bot lan.",
        "/sip_bot": "Revoke / efase bot ou te anrejistre lokalman - efase token lokalman (pa revoke sou BotFather).",
        "/lis_bot": "Montre lis bot ou yo - username ak code.",
        "/mesaj": "Voye yon mesaj kòm bot chwazi a pou tout abonnés (tout chat ki te rankontre worker la). Ou pral chwazi si se simple tèks oswa yon card (title|body)."
      },
      // broadcast flow prompts
      broadcast_choose_type: "Kouman ou vle voye mesaj la? Simple Text oswa Card?",
      broadcast_options: ["Simple Text","Card"],
      broadcast_send_prompt_text: "Voye tèks la kounye a (sa wap voye bay tout abonnés).",
      broadcast_send_prompt_card: "Voye card la kòm: Title|Body (eg: Tit|Sa se kò a).",
      broadcast_done: "Mesaj voye bay tout abonnés.",
      unknown_cmd: "Kòmand pa rekonèt. Sèvi ak /start pou meni."
    },
    fr: {
      name: "Français",
      menu_title: "Menu principal :",
      start_buttons: [
        [ { text: "/lang", callback_data: "cmd:/lang" }, { text: "/aktive", callback_data: "cmd:/aktive" } ],
        [ { text: "/èd", callback_data: "cmd:/èd" }, { text: "/bot", callback_data: "cmd:/bot" } ],
        [ { text: "/sip_bot", callback_data: "cmd:/sip_bot" }, { text: "/lis_bot", callback_data: "cmd:/lis_bot" } ],
        [ { text: "/mesaj", callback_data: "cmd:/mesaj" } ]
      ],
      ask_token_format: "Envoyez /bot <TOKEN> après avoir créé le bot via BotFather.",
      token_checking: "Vérification du token...",
      token_invalid: "Token invalide ou erreur API.",
      created_bot: "Bot enregistré :",
      bot_list_empty: "Vous n'avez aucun bot enregistré.",
      choose_bot_prompt: "Choisissez le bot pour cette action, puis confirmez.",
      confirm_prompt: "Veuillez confirmer l'action pour",
      send_commands_prompt: "Envoyez la liste des commandes, une par ligne : command - Description",
      send_message_prompt: "Envoyez le texte à publier avec ce bot.",
      choose_activation_prompt: "Choisissez ce que vous voulez activer pour le bot :",
      activation_options: ["AI","Bot","AI & Bot"],
      ai_variant_prompt: "Choisissez la variante AI (ex Adam_D'H7 V1)",
      ask_ai_info: "Fournissez informations pour AI (ex: prompt:...) ou tapez 'default'.",
      ai_activated: "Le bot est activé avec la config AI.",
      cannot_set_webhook: "Webhook non configuré automatiquement (WEBHOOK_BASE_URL manquant).",
      choose_bot_after_ai: "Choisissez quel bot assigner à cet AI",
      help_title: "AIDE - Explications des commandes",
      help_intro: "Voici des explications détaillées pour chaque commande (dans votre langue).",
      help_commands: {
        "/lang": "Change la langue : ex /lang Français ou /lang English. Tous les textes s'affichent ensuite dans cette langue.",
        "/aktive": "Permet d'activer un bot : assigner une IA (Adam_D'H7) ou activer mode bot ou AI+Bot.",
        "/èd": "Affiche l'aide détaillée (c'est ce que vous lisez).",
        "/bot": "Enregistre/crée un bot : Envoyez le token via /bot <TOKEN>.",
        "/sip_bot": "Révoque / supprime votre bot localement (ne révoque pas le token sur BotFather).",
        "/lis_bot": "Affiche la liste de vos bots (username et code).",
        "/mesaj": "Envoie un message en tant que bot sélectionné à tous les abonnés. Vous choisirez Simple Text ou Card."
      },
      broadcast_choose_type: "Comment voulez-vous envoyer le message ? Simple Text ou Card ?",
      broadcast_options: ["Simple Text","Card"],
      broadcast_send_prompt_text: "Envoyez le texte maintenant (sera envoyé à tous les abonnés).",
      broadcast_send_prompt_card: "Envoyez la card au format : Title|Body (ex : Titre|Ceci est le corps).",
      broadcast_done: "Message envoyé à tous les abonnés.",
      unknown_cmd: "Commande inconnue. Utilisez /start pour le menu."
    },
    en: {
      name: "English",
      menu_title: "Main menu:",
      start_buttons: [
        [ { text: "/lang", callback_data: "cmd:/lang" }, { text: "/aktive", callback_data: "cmd:/aktive" } ],
        [ { text: "/èd", callback_data: "cmd:/èd" }, { text: "/bot", callback_data: "cmd:/bot" } ],
        [ { text: "/sip_bot", callback_data: "cmd:/sip_bot" }, { text: "/lis_bot", callback_data: "cmd:/lis_bot" } ],
        [ { text: "/mesaj", callback_data: "cmd:/mesaj" } ]
      ],
      ask_token_format: "Send /bot <TOKEN> after creating the bot with BotFather.",
      token_checking: "Checking token...",
      token_invalid: "Token invalid or API error.",
      created_bot: "Bot registered:",
      bot_list_empty: "You have no registered bots.",
      choose_bot_prompt: "Choose the bot for this action, then confirm.",
      confirm_prompt: "Please confirm the action for",
      send_commands_prompt: "Send the commands list, one per line: command - Description",
      send_message_prompt: "Send the message text to post with this bot.",
      choose_activation_prompt: "Choose what to activate for the bot:",
      activation_options: ["AI","Bot","AI & Bot"],
      ai_variant_prompt: "Choose AI variant (eg Adam_D'H7 V1)",
      ask_ai_info: "Provide AI info (eg: prompt:...) or type 'default'.",
      ai_activated: "Bot activated with AI config.",
      cannot_set_webhook: "Webhook not set automatically (WEBHOOK_BASE_URL missing).",
      choose_bot_after_ai: "Choose which bot to assign this AI to",
      help_title: "HELP - Commands explanation",
      help_intro: "Below are detailed explanations for each command (in your language).",
      help_commands: {
        "/lang": "Change language: e.g. /lang English or /lang Kreyòl. UI text will switch accordingly.",
        "/aktive": "Activate a bot: assign an AI (Adam_D'H7) or set mode Bot or AI+Bot.",
        "/èd": "Show detailed help text (you are reading it now).",
        "/bot": "Register/create a bot: send its token via /bot <TOKEN>.",
        "/sip_bot": "Revoke / delete the bot locally (does not revoke token on BotFather).",
        "/lis_bot": "List your bots (username and code).",
        "/mesaj": "Send a message as the selected bot to all subscribers. You'll choose Simple Text or Card."
      },
      broadcast_choose_type: "How do you want to send the message? Simple Text or Card?",
      broadcast_options: ["Simple Text","Card"],
      broadcast_send_prompt_text: "Send the text now (will be sent to all subscribers).",
      broadcast_send_prompt_card: "Send the card as: Title|Body (eg: Title|This is the body).",
      broadcast_done: "Message sent to all subscribers.",
      unknown_cmd: "Unknown command. Use /start for the menu."
    },
    es: {
      name: "Español",
      menu_title: "Menú principal:",
      start_buttons: [
        [ { text: "/lang", callback_data: "cmd:/lang" }, { text: "/aktive", callback_data: "cmd:/aktive" } ],
        [ { text: "/èd", callback_data: "cmd:/èd" }, { text: "/bot", callback_data: "cmd:/bot" } ],
        [ { text: "/sip_bot", callback_data: "cmd:/sip_bot" }, { text: "/lis_bot", callback_data: "cmd:/lis_bot" } ],
        [ { text: "/mesaj", callback_data: "cmd:/mesaj" } ]
      ],
      ask_token_format: "Envía /bot <TOKEN> después de crear el bot con BotFather.",
      token_checking: "Verificando token...",
      token_invalid: "Token inválido o error en la API.",
      created_bot: "Bot registrado:",
      bot_list_empty: "No tienes bots registrados.",
      choose_bot_prompt: "Elige el bot para esta acción y confirma.",
      confirm_prompt: "Por favor confirma la acción para",
      send_commands_prompt: "Envía la lista de comandos, uno por línea: command - Description",
      send_message_prompt: "Envía el texto para publicar con este bot.",
      choose_activation_prompt: "Elige qué activar para el bot:",
      activation_options: ["AI","Bot","AI & Bot"],
      ai_variant_prompt: "Elige la variante AI (ej Adam_D'H7 V1)",
      ask_ai_info: "Proporciona info para AI (ej: prompt:...) o escribe 'default'.",
      ai_activated: "Bot activado con la config AI.",
      cannot_set_webhook: "Webhook no configurado automáticamente (WEBHOOK_BASE_URL falta).",
      choose_bot_after_ai: "Elige qué bot asignar a este AI",
      help_title: "AYUDA - Explicación de comandos",
      help_intro: "A continuación explicaciones detalladas de cada comando (en tu idioma).",
      help_commands: {
        "/lang": "Cambia el idioma: ej /lang Español o /lang English.",
        "/aktive": "Activa un bot: asignar una IA (Adam_D'H7) o poner modo Bot o AI+Bot.",
        "/èd": "Muestra la ayuda detallada (lo que estás leyendo).",
        "/bot": "Registra/crea un bot: envía su token con /bot <TOKEN>.",
        "/sip_bot": "Revoca / borra tu bot localmente (no revoca el token en BotFather).",
        "/lis_bot": "Muestra la lista de tus bots (username y code).",
        "/mesaj": "Envía un mensaje como el bot seleccionado a todos los suscriptores."
      },
      broadcast_choose_type: "¿Cómo quieres enviar el mensaje? Simple Text o Card?",
      broadcast_options: ["Simple Text","Card"],
      broadcast_send_prompt_text: "Envía el texto ahora (se enviará a todos los suscriptores).",
      broadcast_send_prompt_card: "Envía la card en formato: Title|Body (ej: Título|Este es el cuerpo).",
      broadcast_done: "Mensaje enviado a todos los suscriptores.",
      unknown_cmd: "Comando desconocido. Usa /start para el menú."
    }
  };

  /* ================== CALLBACK MAP (short keys) ================== */
  const CALLBACK_MAP = {};
  function shortCallbackKey(pendingId, suffix) {
    const key = "p" + Math.random().toString(36).slice(2,8);
    CALLBACK_MAP[key] = { pendingId, suffix };
    return key;
  }
  function expandCallbackKey(k) { return CALLBACK_MAP[k] || null; }

  /* ================== PENDING HELPERS ================== */
  async function savePending(userId, pending) { await kvPut(`pending:${pending.id}`, pending); }
  async function getPending(userId, pendingId) { return await kvGet(`pending:${pendingId}`); }
  async function removePending(userId, pendingId) { await kvDelete(`pending:${pendingId}`); }
  async function findPendingByState(userId, state) {
    // memory-only scan fallback
    for (const id of Object.keys(MEMORY_DB.pending)) {
      const p = MEMORY_DB.pending[id];
      if (p && p.fromId === userId && p.state === state) return p;
    }
    // KV cannot list easily here; return null
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

  /* ================== CORE FLOWS ================== */
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

  /* ================== FORMAT RESULT ================== */
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
      // sendMessage (single chat)
      if (cmd === "notif_texte") {
        const textToSend = pending.args.text || "";
        if (!textToSend) { await sendMessageViaMain(chatId, TRANSLATIONS[user.lang].error + " no text to send"); await removePending(userId, pending.id); return; }
        const res = await callBotApiWithToken(b.token, "sendMessage", { chat_id: chatId, text: textToSend });
        await sendMessageViaMain(chatId, formatResult("notif_texte", res, b));
        await removePending(userId, pending.id);
        return;
      }

      // broadcast (to all subscribers)
      if (cmd === "broadcast") {
        const mode = pending.args.broadcastMode; // "Simple Text" or "Card"
        const payloadText = pending.args.text || "";
        const subs = await getSubscribers();
        // send one-by-one (consider rate limits)
        for (const s of subs) {
          try {
            if (mode === "Card") {
              // expect pending.args.cardTitle and cardBody OR text with Title|Body
              const title = pending.args.cardTitle || "";
              const body = pending.args.cardBody || payloadText || "";
              const html = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(body)}`;
              await callBotApiWithToken(b.token, "sendMessage", { chat_id: s, text: html, parse_mode: "HTML" });
            } else {
              await callBotApiWithToken(b.token, "sendMessage", { chat_id: s, text: payloadText });
            }
          } catch (e) { /* continue */ }
        }
        await sendMessageViaMain(chatId, TRANSLATIONS[user.lang].broadcast_done);
        await removePending(userId, pending.id);
        return;
      }

      // description/name/commands/photo/activate flows preserved if needed...
      // (we only implemented broadcast & notif_texte here per requirement)
      await sendMessageViaMain(chatId, "Operation not implemented: " + cmd);
      await removePending(userId, pending.id);
    } catch (e) {
      await sendMessageViaMain(chatId, TRANSLATIONS[user.lang].error + " " + (e.message || String(e)));
      await removePending(userId, pending.id);
    }
  }

  /* ================== CALLBACK HANDLER ================== */
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
      if (chatId) await sendMessageViaMain(chatId, "Action cancelled.");
      return;
    }

    if (action === "cmd") {
      // start menu button pressed: emulate typing the command (or show dialog)
      const cmd = payload || parts[1];
      if (cmd === "/start") { await answerCallback(callbackId, "OK"); await sendStartCard(chatId, fromId); return; }
      // For /èd show help text
      if (cmd === "/èd") { await answerCallback(callbackId, "OK"); await sendHelp(chatId, fromId); return; }
      if (cmd === "/mesaj") {
        // start broadcast flow
        const pendingId2 = genPendingId();
        const pending = { id: pendingId2, cmd: "broadcast", args: {}, fromId, chatId, createdAt: Date.now() };
        await savePending(fromId, pending);
        // ask which bot
        const u = await kvGet(`user:${fromId}`);
        if (!u || !u.bots || Object.keys(u.bots).length === 0) { await sendMessageViaMain(chatId, TRANSLATIONS[(u?.lang||'ky')].bot_list_empty); await removePending(fromId, pendingId2); return; }
        await answerCallback(callbackId, "OK"); await sendMessageViaMain(chatId, TRANSLATIONS[u.lang].choose_bot_prompt, { inline_keyboard: buildBotSelectionKeyboard(u.bots, pendingId2) }); return;
      }
      // default: just answer
      await answerCallback(callbackId, "OK");
      return;
    }

    if (action === "pick") {
      const code = codeOrSuffix || parts[2];
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
      const code = codeOrSuffix || parts[2];
      const pending = await getPending(fromId, pendingId);
      if (!pending) { await answerCallback(callbackId, "Pending expired"); return; }
      pending.args = pending.args || {}; pending.args.code = code;
      // for broadcast, after confirm: ask for Simple Text or Card
      if (pending.cmd === "broadcast") {
        pending.state = "awaiting_broadcast_type";
        await savePending(fromId, pending);
        const user = await kvGet(`user:${fromId}`);
        await answerCallback(callbackId, "Confirmed");
        await sendMessageViaMain(chatId, TRANSLATIONS[user.lang].broadcast_choose_type, { inline_keyboard: buildBroadcastTypeKeyboard(pending.id, user.lang) });
        return;
      }
      // else default execute
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

    await answerCallback(callbackId, "Unknown callback");
  }

  /* ================== HELPERS: start card & help text ================== */
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

  /* ================== MESSAGE HANDLER ================== */
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

    // pending flows: broadcast text / card
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
      // expect Title|Body or multi-line
      let title = "", body = "";
      if (text.includes("|")) {
        const [t, ...rest] = text.split("|");
        title = t.trim(); body = rest.join("|").trim();
      } else if (text.includes("\n")) {
        const parts = text.split("\n");
        title = parts[0].trim(); body = parts.slice(1).join("\n").trim();
      } else {
        // single line -> title only, body empty
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

    // if photo -> create pending for foto (reuse existing code pattern if needed)
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

    // bot register
    if (cmd === "/bot" || cmd === "/nouvo_bot") {
      const token = parts[1] || "";
      if (!token) { await sendMessageViaMain(chatId, TRANSLATIONS[lang].ask_token_format); return; }
      return await registerNewBotFlow(userId, chatId, token, lang);
    }

    if (cmd === "/lis_bot" || cmd === "/bot_mw") {
      const entries = Object.entries(user.bots || {});
      if (!entries.length) { await sendMessageViaMain(chatId, TRANSLATIONS[lang].bot_list_empty); return; }
      const lines = entries.map(([code, b]) => { const uname = b.info?.username ? "@" + b.info.username : "(no username)"; return `${uname} — ${code}`; });
      // quick action keyboard
      const kb = entries.map(([code, b]) => {
        if (b.info?.username) return [{ text: `Open ${"@" + b.info.username}`, url: `https://t.me/${b.info.username}` }];
        return [{ text: `${code}`, callback_data: `noop:${code}` }];
      });
      await sendMessageViaMain(chatId, lines.join("\n"));
      await sendMessageViaMain(chatId, "Quick actions:", { inline_keyboard: kb });
      return;
    }

    if (cmd === "/sip_bot" || cmd === "/revokel") {
      const code = parts[1] || "";
      if (!code) { await sendMessageViaMain(chatId, "Use: /sip_bot <CODE>"); return; }
      if (!user.bots || !user.bots[code]) { await sendMessageViaMain(chatId, TRANSLATIONS[lang].bot_list_empty); return; }
      delete user.bots[code];
      await kvPut("user:" + userId, user);
      await sendMessageViaMain(chatId, `Bot ${code} removed from your list.`);
      return;
    }

    if (cmd === "/mesaj") {
      // start broadcast flow
      const pendingId = genPendingId();
      const pending = { id: pendingId, cmd: "broadcast", args: {}, fromId: userId, chatId, createdAt: Date.now() };
      await savePending(userId, pending);
      if (!user.bots || Object.keys(user.bots).length === 0) { await sendMessageViaMain(chatId, TRANSLATIONS[lang].bot_list_empty); await removePending(userId, pendingId); return; }
      const kb = buildBotSelectionKeyboard(user.bots, pendingId);
      await sendMessageViaMain(chatId, TRANSLATIONS[lang].choose_bot_prompt, { inline_keyboard: kb });
      return;
    }

    // fallback
    await sendMessageViaMain(chatId, TRANSLATIONS[lang].unknown_cmd);
  }

  /* ================== Fetch handler ================== */
  async function handleRequest(request) {
    if (request.method === "GET") return new Response("Telegram Worker (menu + broadcast) active", { status: 200 });
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

  function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe.replace(/[&<>"']/g, function(m) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[m]; });
  }

} // end guard
