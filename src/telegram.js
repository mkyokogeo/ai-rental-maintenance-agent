import 'dotenv/config';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { sendTechnicianIncidentEmail } from './email.js';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const OPENAI_API = 'https://api.openai.com/v1/responses';
const OPENAI_TRANSCRIPTIONS_API = 'https://api.openai.com/v1/audio/transcriptions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';
const ENGINEER_MATCH_URL = process.env.ENGINEER_MATCH_URL;
const chats = new Map();

function systemPrompt() {
  return `Eres un agente de mantenimiento de apartamentos que atiende huéspedes por Telegram.
Detecta el idioma del primer mensaje del huésped y responde en ese mismo idioma durante toda la incidencia, salvo que el huésped cambie claramente de idioma. Usa un tono amable y mensajes breves.
Construye un contexto acumulativo desde el primer mensaje: conserva y utiliza toda la información anterior, incluidos texto, respuestas y fotos.
Flujo obligatorio: entiende el problema; revisa qué datos ya están disponibles; pregunta únicamente por la información que falte y nunca vuelvas a pedir algo que el huésped ya haya indicado o que se vea claramente en una foto. Para aparatos, pide solo los detalles que falten entre marca/modelo, síntomas, códigos de error y fotos detalladas; después ofrece como máximo 3 comprobaciones sencillas y seguras. Solo después de esas comprobaciones pregunta en el idioma del huésped si quiere que se busque un técnico. Nunca preguntes la fecha u hora del técnico antes de que el huésped haya confirmado explícitamente que quiere uno.
No sugieras desmontar instalaciones ni trabajos eléctricos peligrosos. No inventes datos. Describe las fotos de forma muy resumida y útil para un técnico.`;
}

function required(name) {
  if (!process.env[name] || process.env[name].includes('replace_me') || process.env[name] === 'sk-...') {
    throw new Error(`Falta ${name}. Rellena .env antes de arrancar.`);
  }
}

async function telegram(method, body) {
  const response = await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

async function downloadTelegramFile(fileId) {
  const file = await telegram('getFile', { file_id: fileId });
  const response = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!response.ok) throw new Error(`No se pudo descargar el archivo de Telegram: ${response.statusText}`);
  return { file, response };
}

async function getPhotoDataUrl(fileId) {
  const { file, response } = await downloadTelegramFile(fileId);
  const responseContentType = response.headers.get('content-type') || '';
  const extension = file.file_path?.split('.').pop()?.toLowerCase();
  const extensionMimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  const contentType = responseContentType.startsWith('image/')
    ? responseContentType.split(';')[0]
    : extensionMimeTypes[extension] || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

async function transcribeVoice(fileId) {
  const { file, response } = await downloadTelegramFile(fileId);
  const audio = Buffer.from(await response.arrayBuffer());
  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/ogg' }), 'telegram-voice.ogg');
  form.append('model', TRANSCRIPTION_MODEL);
  const transcriptionResponse = await fetch(OPENAI_TRANSCRIPTIONS_API, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  const data = await transcriptionResponse.json();
  if (!transcriptionResponse.ok) throw new Error(`OpenAI transcription: ${data.error?.message || transcriptionResponse.statusText}`);
  return data.text || '';
}

async function openai(input) {
  const response = await fetch(OPENAI_API, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`OpenAI: ${data.error?.message || response.statusText}`);
  return data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text || '').join('') || '';
}

async function getTechnicianIntent(messages) {
  const prompt = `Analiza la conversación completa y devuelve únicamente JSON válido con esta forma: {"wants_technician":true,"appointment_time":"string or null"}.
Detecta cualquier idioma. Marca wants_technician=true únicamente cuando el huésped confirma explícitamente que quiere que se busque o contacte a un técnico, o cuando ya existe esa confirmación explícita y ahora proporciona la fecha u hora solicitada. Un mensaje que solo describe una avería, aunque sea urgente o probablemente necesite técnico, siempre debe devolver wants_technician=false. No infieras consentimiento.
Los detalles relevantes, fotos y comprobaciones deben reutilizarse desde la conversación; no vuelvas a pedir datos que ya existen. La pregunta de fecha/hora solo debe hacerse después de la confirmación explícita del huésped.
Extrae la fecha y hora preferidas exactamente como las expresa el huésped; no inventes zona horaria ni disponibilidad. Si no hay una fecha u hora preferida, usa null.
Conversación:\n${JSON.stringify(messages)}`;
  try {
    const raw = await openai([
      { role: 'system', content: 'Eres un clasificador multilingüe de intención. Entiende cualquier idioma.' },
      { role: 'user', content: prompt },
    ]);
    let jsonText = raw.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(jsonText.indexOf('\n') + 1);
      const closingFence = jsonText.lastIndexOf('```');
      if (closingFence >= 0) jsonText = jsonText.slice(0, closingFence).trim();
    }
    const intent = JSON.parse(jsonText);
    return {
      wantsTechnician: Boolean(intent.wants_technician),
      appointmentTime: intent.appointment_time || null,
    };
  } catch {
    return { wantsTechnician: false, appointmentTime: null };
  }
}

async function buildIncidentJson(state) {
  const prompt = `Return only valid JSON, without markdown, using exactly the API request schema below:
{"telegram_id":"string","categories":["string"],"brands":["string"],"summary":"string","urgency":"low|normal|high|critical","findings":{"problem_type":"string","technician_type":"string","desired_appointment_time":"string","guest_description":"string","photo_analysis":"string","checks_performed":["string"],"voice_notes":[{"telegram_file_id":"string","transcript":"string"}],"photos":[{"telegram_file_id":"string","description":"string"}],"source_chat_id":"string","requires_technician":true}}
The output must be directly usable as the POST body for /application. Use English for every field name and every descriptive value. Put a complete, concise technician context in summary, including the problem, urgency, location, symptoms, desired appointment time, checks, photo findings and voice transcription when available. Use categories as matching tags such as plumbing, water_leak, hvac, electrical or appliance_failure, and put detected brands in brands. Do not invent property, landlord or engineer data; the API will resolve them from telegram_id.\n${JSON.stringify(state)}`;
  const raw = await openai([{ role: 'system', content: 'Eres un sistema que estructura avisos de mantenimiento.' }, { role: 'user', content: prompt }]);
  try { return JSON.parse(raw); } catch { return { telegram_id: state.telegram_id, categories: [], brands: [], summary: raw, urgency: 'normal', findings: state }; }
}

async function matchIncident(incident) {
  if (!ENGINEER_MATCH_URL || !incident.telegram_id) return null;
  try {
    const response = await fetch(ENGINEER_MATCH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(incident),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail?.[0]?.msg || response.statusText);
    return data;
  } catch (error) {
    console.error(`ENGINEER_MATCH_ERROR: ${error.message}`);
    return null;
  }
}

async function notifyLandlord(matchResult, incident) {
  const application = matchResult?.application || matchResult;
  const landlord = application?.landlord || application?.property?.landlord;
  const chatId = landlord?.telegram_id || landlord?.chat_id || landlord?.telegram_chat_id;
  if (!chatId) return { sent: false, reason: 'Landlord has no Telegram chat_id.' };
  await telegram('sendMessage', {
    chat_id: chatId,
    text: `New maintenance incident\n\n${incident.summary}`,
  });
  for (const photo of incident.findings?.photos || []) {
    await telegram('sendPhoto', {
      chat_id: chatId,
      photo: photo.telegram_file_id,
      caption: photo.description || 'Incident photo',
    });
  }
  return { sent: true, chat_id: chatId };
}

function startWebhookServer() {
  const port = Number(process.env.WEBHOOK_PORT || 3000);
  const path = process.env.WEBHOOK_PATH || '/webhooks/technician';
  const server = http.createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== path) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: false, error: 'Not found' }));
      return;
    }

    let body = '';
    for await (const chunk of request) body += chunk;
    try {
      const event = JSON.parse(body);
      const tenantChatId = event.tenant_telegram_id || event.tenant_chat_id;
      const landlordChatId = event.landlord_telegram_id || event.landlord_chat_id;
      const accepted = event.event === 'technician_task_accepted' || event.status === 'accepted';
      const rejected = event.event === 'technician_task_rejected' || event.status === 'rejected';
      const statusText = accepted ? 'accepted the maintenance request' : rejected ? 'rejected the maintenance request' : 'updated the maintenance request';
      const technician = event.technician || event.engineer || event.application?.engineer || {};
      const technicianDetails = [
        technician.name && `Technician: ${technician.name}`,
        technician.phone && `Phone: ${technician.phone}`,
        technician.email && `Email: ${technician.email}`,
      ].filter(Boolean).join('\n');
      const message = [
        event.message || `The technician has ${statusText}.`,
        technicianDetails,
      ].filter(Boolean).join('\n\n');

      for (const chatId of new Set([tenantChatId, landlordChatId].filter(Boolean).map(String))) {
        await telegram('sendMessage', { chat_id: chatId, text: message });
      }

      console.log('WEBHOOK_EVENT', JSON.stringify(event));
      response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, notified: true }));
    } catch (error) {
      console.error(`WEBHOOK_ERROR: ${error.message}`);
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: false, error: 'Invalid webhook payload' }));
    }
  });
  server.listen(port, () => console.log(`Webhook activo en http://localhost:${port}${path}`));
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const state = chats.get(chatId) || { messages: [], photos: [], technicianRequested: false };
  const text = message.text || message.caption || '';
  const photo = message.photo?.at(-1);
  const voice = message.voice;
  if (text) state.messages.push({ role: 'user', text });
  if (photo) {
    state.photos.push({ telegram_file_id: photo.file_id, dataUrl: await getPhotoDataUrl(photo.file_id) });
    if (!text) state.messages.push({ role: 'user', text: 'El huésped ha enviado una foto.' });
  }
  if (voice) {
    const transcript = await transcribeVoice(voice.file_id);
    const voiceText = text ? `${text}\n${transcript}` : transcript;
    state.voice_notes = state.voice_notes || [];
    state.voice_notes.push({ telegram_file_id: voice.file_id, transcript: voiceText });
    state.messages.push({ role: 'user', text: voiceText, source: 'voice' });
  }

  const technicianIntent = !state.technicianRequested
    ? await getTechnicianIntent(state.messages)
    : { wantsTechnician: false, appointmentTime: null };
  if (technicianIntent.wantsTechnician && !technicianIntent.appointmentTime) {
    state.awaiting_appointment_time = true;
    chats.set(chatId, state);
    const appointmentQuestion = await openai([
      { role: 'system', content: 'Reply with one short, friendly question in the language of the guest. Ask what date and time they would prefer for the technician visit. Do not add any other question or information.' },
      { role: 'user', content: state.messages.map((item) => `${item.role}: ${item.text}`).join('\n') },
    ]);
    await telegram('sendMessage', { chat_id: chatId, text: appointmentQuestion });
    return;
  }
  if (technicianIntent.wantsTechnician && technicianIntent.appointmentTime) {
    state.technicianRequested = true;
    const incident = await buildIncidentJson({
      telegram_id: String(message.from?.id || chatId),
      desired_appointment_time: technicianIntent.appointmentTime,
      source_chat_id: String(chatId),
      messages: state.messages,
      photos: state.photos.map(({ telegram_file_id }) => ({ telegram_file_id })),
      voice_notes: state.voice_notes || [],
    });
    state.incident = incident;
    state.incident_id = state.incident_id || randomUUID();
    chats.set(chatId, state);
    console.log('\n========== INCIDENT_JSON ==========' );
    console.log(JSON.stringify({ chat_id: chatId, ...incident }, null, 2));
    console.log('========== END INCIDENT_JSON ==========\n');
    const matchResult = await matchIncident(incident);
    if (matchResult) {
      console.log('MATCH_RESPONSE', JSON.stringify(matchResult, null, 2));
      console.log('LANDLORD_NOTIFICATION', JSON.stringify(await notifyLandlord(matchResult, incident)));
      const application = matchResult.application || matchResult;
      const technician = application.engineer || application.technician || matchResult.technician || matchResult;
      if (technician.email || process.env.DEMO_TECHNICIAN_EMAIL) {
        const emailResult = await sendTechnicianIncidentEmail({
          incidentId: state.incident_id,
          technician,
          incident: { ...incident, property: application.property },
          applicationId: application.application_id,
          providerAction: matchResult.provider_action,
        });
        console.log('TECHNICIAN_EMAIL', JSON.stringify(emailResult));
      }
    }
    const acknowledgement = await openai([
      { role: 'system', content: 'Responde con una sola frase breve en el idioma del primer mensaje del huésped. Confirma que has registrado la incidencia y preparado el resumen para buscar un técnico. No añadas información nueva.' },
      { role: 'user', content: state.messages.find((item) => item.role === 'user')?.text || text },
    ]);
    await telegram('sendMessage', { chat_id: chatId, text: acknowledgement });
    return;
  }

  const history = state.messages.slice(-8).map((item) => `${item.role}: ${item.text}`).join('\n');
  const content = [{ type: 'input_text', text: history }];
  for (const item of state.photos.slice(-3)) content.push({ type: 'input_image', image_url: item.dataUrl });
  const reply = await openai([{ role: 'system', content: systemPrompt() }, { role: 'user', content }]);
  state.messages.push({ role: 'assistant', text: reply });
  chats.set(chatId, state);
  await telegram('sendMessage', { chat_id: chatId, text: reply });
}

async function main() {
  required('OPENAI_API_KEY');
  required('TELEGRAM_BOT_TOKEN');
  if (!ENGINEER_MATCH_URL) console.log('Aviso: ENGINEER_MATCH_URL no está configurada; no se hará matching.');
  startWebhookServer();
  console.log(`Telegram MVP activo con modelo ${MODEL}`);
  let offset = 0;
  while (true) {
    const updates = await telegram('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
    for (const update of updates) {
      offset = update.update_id + 1;
      if (!update.message?.chat?.id) continue;
      try { await handleMessage(update.message); }
      catch (error) {
        console.error(error);
        await telegram('sendMessage', { chat_id: update.message.chat.id, text: 'Ha ocurrido un error temporal. Inténtalo de nuevo en unos segundos.' });
      }
    }
  }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
