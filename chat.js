exports.handler = async function(event) {

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ text: '⚠️ GEMINI_API_KEY not set in Netlify environment variables.' })
    };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ text: '⚠️ Bad request.' })
    };
  }

  const { messages = [], system = '', useWebSearch = false } = body;

  // Build contents — keep it lean
  const contents = [];

  // System as short opening exchange
  if (system) {
    const short = system.slice(0, 2000);
    contents.push({ role: 'user',  parts: [{ text: 'SYSTEM: ' + short }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  }

  // Last 8 messages only
  for (const msg of messages.slice(-8)) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const text = typeof msg.content === 'string' ? msg.content : (msg.content?.[0]?.text || '');
    if (text) contents.push({ role, parts: [{ text }] });
  }

  if (!contents.length) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ text: '⚠️ No messages.' })
    };
  }

  const reqBody = {
    contents,
    generationConfig: { maxOutputTokens: 1200, temperature: 0.7 }
  };

  if (useWebSearch) {
    reqBody.tools = [{ googleSearch: {} }];
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${KEY}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody)
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ text: '⚠️ Gemini error: ' + msg })
      };
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.filter(p => p.text)?.map(p => p.text)?.join('\n') || 'No response.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ text })
    };

  } catch(err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ text: '⚠️ Error: ' + err.message })
    };
  }
};
