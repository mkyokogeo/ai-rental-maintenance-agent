# AI Property Maintenance Agent — Telegram MVP

MVP de un agente que recibe incidencias de huéspedes por Telegram y prepara un aviso para un técnico.

**Guest → Telegram → OpenAI (texto/fotos) → comprobaciones → JSON para técnico**

One message. Zero handoffs.

## Qué hace

El huésped escribe por Telegram, con texto o fotos. El agente:

> Hola, el aire acondicionado no funciona y aparece un error.

El agente:

1. Pide detalles adicionales cuando faltan.
2. Analiza fotos para obtener marca, modelo, códigos o daños visibles.
3. Transcribe notas de voz y las añade al contexto de la incidencia.
4. Propone comprobaciones sencillas y pregunta si quiere un técnico.
5. Al confirmar, imprime un JSON completo en la consola con el contexto y los `file_id` de Telegram. Este JSON queda preparado para una futura integración con un buscador de técnicos y envío de correos.

El agente detecta el idioma del primer mensaje, responde en ese idioma y acumula el contexto de toda la conversación sin repetir preguntas ya respondidas.

La conversación mantiene el idioma del huésped, pero el JSON final de la incidencia se genera siempre en inglés para integrarlo con APIs externas.

Las incidencias y fotos se mantienen en memoria durante la ejecución. La persistencia y el envío real al técnico se añadirán después.

## Setup

```bash
npm install
Copy-Item .env.example .env
```

Añade `OPENAI_API_KEY` y `TELEGRAM_BOT_TOKEN` en `.env`.

## Uso

Arranque:

```bash
npm run telegram
```
