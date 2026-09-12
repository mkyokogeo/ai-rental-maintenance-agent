import { tool } from '@openai/agents';
import { z } from 'zod';
import {
  guests,
  maintenanceHistory,
  policies,
  properties,
  technicians,
} from './data.js';

function log(channel, message) {
  console.log(`\n[${channel}] ${message}`);
}

export const lookupProperty = tool({
  name: 'lookup_property',
  description:
    'Identifica la vivienda y el huésped a partir del teléfono de WhatsApp o el nombre de la propiedad.',
  parameters: z.object({
    guestPhone: z.string().nullable().default(null),
    propertyName: z.string().nullable().default(null),
  }),
  execute: async ({ guestPhone, propertyName }, runContext) => {
    const phone = guestPhone || runContext.context?.guestPhone;
    const guest = guests.find((item) => item.phone === phone);
    const property =
      properties.find((item) => item.id === guest?.propertyId) ||
      properties.find((item) =>
        item.name.toLowerCase().includes((propertyName || '').toLowerCase()),
      );

    if (!property) {
      return { found: false, message: 'No se encontró la propiedad.' };
    }

    log('Property', `${property.name} · ${property.address}`);

    return {
      found: true,
      guest: guest ? { name: guest.name, phone: guest.phone } : null,
      property,
    };
  },
});

export const getMaintenanceHistory = tool({
  name: 'get_maintenance_history',
  description: 'Devuelve el historial de mantenimiento de una propiedad.',
  parameters: z.object({
    propertyId: z.string(),
  }),
  execute: async ({ propertyId }) => {
    const history = maintenanceHistory.filter((item) => item.propertyId === propertyId);
    log('History', `${history.length} incidencias previas`);
    return { propertyId, history };
  },
});

export const checkInsuranceCoverage = tool({
  name: 'check_insurance_coverage',
  description:
    'Comprueba si una incidencia está cubierta por la póliza de la vivienda. Tipos: hvac, plumbing, electrical, other.',
  parameters: z.object({
    propertyId: z.string(),
    issueType: z.enum(['hvac', 'plumbing', 'electrical', 'other']),
  }),
  execute: async ({ propertyId, issueType }) => {
    const property = properties.find((item) => item.id === propertyId);
    const policy = policies.find((item) => item.id === property?.insurancePolicyId);

    if (!policy) {
      return { covered: false, reason: 'No hay póliza asociada.' };
    }

    const covered = policy.covers.includes(issueType);
    log(
      'Insurance',
      covered
        ? `${policy.insurer}: cubierto (franquicia ${policy.deductibleEur}€)`
        : `${policy.insurer}: no cubierto`,
    );

    return {
      covered,
      insurer: policy.insurer,
      deductibleEur: policy.deductibleEur,
      notes: policy.notes,
    };
  },
});

export const findTechnician = tool({
  name: 'find_technician',
  description:
    'Busca un técnico por especialidad y ciudad. Especialidades: hvac, plumbing, electrical.',
  parameters: z.object({
    specialty: z.enum(['hvac', 'plumbing', 'electrical']),
    city: z.string(),
  }),
  execute: async ({ specialty, city }) => {
    const match = technicians.find(
      (tech) =>
        tech.specialty === specialty &&
        tech.city.toLowerCase() === city.toLowerCase(),
    );

    if (!match) {
      return { found: false, message: 'No hay técnico disponible.' };
    }

    log('Dispatch', `${match.name} · ${match.specialty} · ${match.nextSlot}`);
    return { found: true, technician: match };
  },
});

export const contactTechnician = tool({
  name: 'contact_technician',
  description:
    'Contacta al técnico por Telegram para pedir disponibilidad y confirmar la visita.',
  parameters: z.object({
    technicianId: z.string(),
    incidentSummary: z.string(),
  }),
  execute: async ({ technicianId, incidentSummary }) => {
    const technician = technicians.find((item) => item.id === technicianId);
    if (!technician) {
      return { confirmed: false, message: 'Técnico no encontrado.' };
    }

    log(
      `Telegram → ${technician.handle}`,
      `Hola ${technician.name}, incidencia: ${incidentSummary}. ¿Puedes ir en ${technician.nextSlot}?`,
    );
    log(
      `Telegram ← ${technician.handle}`,
      `Confirmado. Estaré allí ${technician.nextSlot}.`,
    );

    return {
      confirmed: true,
      technician: technician.name,
      channel: 'telegram',
      visitSlot: technician.nextSlot,
    };
  },
});

export const notifyOwner = tool({
  name: 'notify_owner',
  description: 'Informa al propietario de que la incidencia ya está gestionada.',
  parameters: z.object({
    propertyId: z.string(),
    message: z.string(),
  }),
  execute: async ({ propertyId, message }) => {
    const property = properties.find((item) => item.id === propertyId);
    const owner = property?.owner;

    if (!owner) {
      return { sent: false, message: 'Propietario no encontrado.' };
    }

    log(`${owner.channel} → ${owner.contact}`, message);
    return { sent: true, owner: owner.name };
  },
});
