// ===== TELEGRAM WEBHOOK + SUPABASE AUTH + STORAGE + GROQ WHISPER =====
const allowedOrigins = [
  'https://adimitriou94.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

function corsHeaders(request){
  const origin=request.headers.get('Origin');

  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin)
      ? origin
      : 'https://adimitriou94.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    try {
      const url = new URL(request.url);

      // ===== APP MARK IMPORTED/SKIPPED =====
      if (request.method === 'POST' && url.pathname === '/mark') {
        return await handleMarkMessages(request, env);
      }

      // ===== TELEGRAM WEBHOOK =====
      if (request.method === 'POST') {
        requireTelegramWebhookSecret(request, env);
        return await handleWebhook(request, env);
      }

      // ===== APP SYNC =====
      if (request.method === 'GET') {
        return await handleSync(request, env);
      }

      return json({ error: 'Method not allowed' }, 405, request);

    } catch (err) {
      return json({ error: err.message }, 500, request);
    }
  }
};

// ===== APP AUTH CONTEXT =====
async function getAuthenticatedProfile(request, env) {
  const authHeader = request.headers.get('Authorization') || '';

  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization token');
  }

  const accessToken = authHeader.replace('Bearer ', '').trim();

  if (!accessToken) {
    throw new Error('Empty authorization token');
  }

  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!userRes.ok) {
    throw new Error('Invalid or expired authorization token');
  }

  const user = await userRes.json();

  if (!user || !user.id) {
    throw new Error('Invalid Supabase user');
  }

  const profileUrl =
    `${env.SUPABASE_URL}/rest/v1/profiles` +
    `?user_id=eq.${encodeURIComponent(user.id)}` +
    `&select=user_id,email,telegram_chat_id`;

  const profileRes = await fetch(profileUrl, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  if (!profileRes.ok) {
    const txt = await profileRes.text();
    throw new Error('Profile fetch failed: ' + txt);
  }

  const profiles = await profileRes.json();
  const profile = profiles[0];

  if (!profile) {
    throw new Error('Profile not found');
  }

  if (!profile.telegram_chat_id) {
    throw new Error('Telegram Chat ID is not linked to this account');
  }

  return {
    user,
    profile,
    chatId: String(profile.telegram_chat_id)
  };
}

// ===== WEBHOOK =====
async function handleWebhook(request, env) {
  const body = await request.json();
  const msg = body.message;

  if (!msg) {
    return json({ ok: true }, 200, request);
  }

  const chatId = String(msg.chat.id);
  const messageId = msg.message_id;

  // ===== /id =====
  if (msg.text && msg.text.trim().toLowerCase() === '/id') {
    await sendTelegramMessage(
      env.TELEGRAM_TOKEN,
      chatId,
`✅ Expense Tracker

Το προσωπικό Chat ID σου είναι:

${chatId}

📱 Αντέγραψέ το και γύρνα στην εφαρμογή.`
    );

    return json({ ok: true });
  }

  let finalText = '';
  let type = 'text';

  // ===== TEXT =====
  if (msg.text) {
    finalText = msg.text.trim();
  }

  // ===== VOICE =====
  else if (msg.voice) {
    type = 'voice';

    try {
      finalText = await transcribeVoice(
        msg.voice.file_id,
        env.TELEGRAM_TOKEN,
        env.GROQ_API_KEY
      );
    } catch (e) {
      finalText = '';
      type = 'voice_error';
    }
  }

  // ===== EMPTY / COMMANDS =====
  if (!finalText || finalText.startsWith('/')) {
    return json({ ok: true, skipped: true }, 200, request);
  }

  // ===== SAVE TO SUPABASE =====
  const row = {
    id: `tg_${chatId}_${messageId}`,
    chat_id: chatId,
    message_id: messageId,
    text: finalText,
    type,
    telegram_date: msg.date,
    status: 'pending',
    processed: false
  };

  await saveMessageToSupabase(row, env);

  return json({ ok: true });
}

// ===== APP SYNC =====
async function handleSync(request, env) {
  const auth = await getAuthenticatedProfile(request, env);
  const chatId = auth.chatId;

  const supabaseUrl =
    `${env.SUPABASE_URL}/rest/v1/telegram_messages` +
    `?chat_id=eq.${encodeURIComponent(chatId)}` +
    `&status=eq.pending` +
    `&order=message_id.asc`;

  const res = await fetch(supabaseUrl, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  if (!res.ok) {
    const txt = await res.text();

    return json({
      error: 'Supabase fetch failed',
      detail: txt
    }, 500, request);
  }

  const rows = await res.json();

  return json({
    messages: rows.map(r => ({
      update_id: r.message_id,
      message_id: r.message_id,
      text: r.text,
      date: r.telegram_date,
      type: r.type
    }))
  }, 200, request);
}

// ===== MARK MESSAGES AS IMPORTED / SKIPPED =====
async function handleMarkMessages(request, env) {
  const auth = await getAuthenticatedProfile(request, env);
  const chatId = auth.chatId;

  const body = await request.json();

  const messageIds = body.message_ids || [];
  const status = body.status;

  if (!['imported', 'skipped'].includes(status)) {
    return json({ error: 'Invalid status' }, 400, request);
  }

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return json({ ok: true, updated: 0 }, 200, request);
  }

  const safeIds = messageIds
    .map(id => Number(id))
    .filter(id => Number.isFinite(id));

  if (safeIds.length === 0) {
    return json({ ok: true, updated: 0 }, 200, request);
  }

  const idsFilter = safeIds.join(',');

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/telegram_messages` +
    `?chat_id=eq.${encodeURIComponent(chatId)}` +
    `&message_id=in.(${idsFilter})`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        status,
        processed: true
      })
    }
  );

  if (!res.ok) {
    const txt = await res.text();

    return json({
      error: 'Supabase status update failed',
      detail: txt
    }, 500, request);
  }

  return json({
    ok: true,
    updated: safeIds.length,
    status
  }, 200, request);
}

// ===== SAVE TO SUPABASE =====
async function saveMessageToSupabase(row, env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/telegram_messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'resolution=ignore-duplicates'
      },
      body: JSON.stringify(row)
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Supabase insert failed: ' + txt);
  }
}

// ===== TELEGRAM SEND =====
async function sendTelegramMessage(token, chatId, text) {
  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    }
  );

  const data = await res.json();

  if (!data.ok) {
    throw new Error('Telegram send failed');
  }
}

// ===== GROQ WHISPER =====
async function transcribeVoice(fileId, telegramToken, groqApiKey) {
  const fileRes = await fetch(
    `https://api.telegram.org/bot${telegramToken}/getFile?file_id=${fileId}`
  );

  const fileData = await fileRes.json();

  if (!fileData.ok) {
    throw new Error('Telegram getFile failed');
  }

  const filePath = fileData.result.file_path;

  const audioRes = await fetch(
    `https://api.telegram.org/file/bot${telegramToken}/${filePath}`
  );

  const audioBlob = await audioRes.blob();

  const formData = new FormData();

  formData.append('file', audioBlob, 'voice.ogg');
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'el');
  formData.append('response_format', 'json');

  const groqRes = await fetch(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`
      },
      body: formData
    }
  );

  if (!groqRes.ok) {
    const txt = await groqRes.text();
    throw new Error('Groq failed: ' + txt);
  }

  const groqData = await groqRes.json();

  return groqData.text || '';
}

// ===== SECURITY =====
function requireTelegramWebhookSecret(request, env) {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;

  if (!expected) {
    throw new Error('Missing TELEGRAM_WEBHOOK_SECRET');
  }

  const received = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

  if (received !== expected) {
    throw new Error('Unauthorized Telegram webhook');
  }
}

// ===== JSON RESPONSE =====
function json(data, status = 200, request = null) {
  const req = request || new Request('https://adimitriou94.github.io');

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders(req)
    }
  );
}