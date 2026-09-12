import { Agent } from '@openai/agents';
import {
  checkInsuranceCoverage,
  contactTechnician,
  findTechnician,
  getMaintenanceHistory,
  lookupProperty,
  notifyOwner,
} from './tools.js';

const propertyAgent = new Agent({
  name: 'Property Data Agent',
  handoffDescription:
    'Identifica la vivienda, revisa el historial de mantenimiento y comprueba la póliza.',
  instructions: `Eres el agente de datos de la propiedad.
Usa las tools para:
1. Identificar la vivienda del huésped.
2. Consultar el historial de mantenimiento.
3. Comprobar si la incidencia está cubierta por el seguro.
Devuelve un resumen breve y factual. No hables con el huésped.`,
  tools: [lookupProperty, getMaintenanceHistory, checkInsuranceCoverage],
});

const dispatchAgent = new Agent({
  name: 'Technician Dispatch Agent',
  handoffDescription:
    'Busca al técnico, le escribe por Telegram y confirma la visita.',
  instructions: `Eres el agente de coordinación con técnicos.
Usa las tools para:
1. Buscar un profesional por especialidad y ciudad.
2. Contactarle por Telegram y confirmar disponibilidad.
3. Avisar al propietario cuando la visita esté confirmada.
Devuelve técnico, canal, horario y si el propietario fue notificado.`,
  tools: [findTechnician, contactTechnician, notifyOwner],
});

export const whatsappAgent = new Agent({
  name: 'WhatsApp Maintenance Agent',
  instructions: `Eres el agente de mantenimiento de la vivienda. El huésped te escribe por WhatsApp.

Objetivo: resolver la incidencia completa desde un solo chat. No pidas que contacten al propietario ni que busquen ellos al técnico.

Flujo:
1. Entiende el problema. Si falta un dato crítico (foto del error, olores, agua), pídelo. Si hay suficiente contexto, sigue.
2. Llama a property_data_agent para identificar la vivienda, ver historial y cobertura del seguro.
3. Llama a technician_dispatch_agent para buscar técnico, confirmar visita por Telegram y avisar al propietario.
4. Responde al huésped en español, tono WhatsApp: corto, claro y accionable. Incluye qué se ha hecho, si hay cobertura/franquicia y cuándo viene el técnico.

Un mensaje. Cero intermediarios.`,
  tools: [
    propertyAgent.asTool({
      toolName: 'property_data_agent',
      toolDescription:
        'Identifica la propiedad, consulta historial y comprueba la póliza.',
    }),
    dispatchAgent.asTool({
      toolName: 'technician_dispatch_agent',
      toolDescription:
        'Busca técnico, confirma visita por Telegram y notifica al propietario.',
    }),
  ],
});
