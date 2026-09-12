export const guests = [
  {
    phone: '+34600111222',
    name: 'Ana García',
    propertyId: 'prop-serrano-45',
  },
];

export const properties = [
  {
    id: 'prop-serrano-45',
    name: 'Apartamento Serrano 45',
    address: 'Calle de Serrano 45, 4B, 28001 Madrid',
    city: 'Madrid',
    owner: {
      name: 'Laura Méndez',
      channel: 'email',
      contact: 'laura.mendez@example.com',
    },
    insurancePolicyId: 'pol-homeprotect-88',
  },
];

export const policies = [
  {
    id: 'pol-homeprotect-88',
    insurer: 'HomeProtect',
    covers: ['hvac', 'plumbing', 'electrical'],
    deductibleEur: 80,
    notes: 'Averías de climatización cubiertas si no hay mal uso del huésped.',
  },
];

export const maintenanceHistory = [
  {
    propertyId: 'prop-serrano-45',
    date: '2026-03-12',
    issue: 'Revisión anual del aire acondicionado',
    resolution: 'Filtro cambiado. Unidad operativa.',
  },
  {
    propertyId: 'prop-serrano-45',
    date: '2025-08-02',
    issue: 'Fuga en el grifo de la cocina',
    resolution: 'Junta sustituida.',
  },
];

export const technicians = [
  {
    id: 'tech-miguel',
    name: 'Miguel Torres',
    specialty: 'hvac',
    city: 'Madrid',
    channel: 'telegram',
    handle: '@miguel_clima',
    nextSlot: 'mañana 10:00',
  },
  {
    id: 'tech-sofia',
    name: 'Sofía Ruiz',
    specialty: 'plumbing',
    city: 'Madrid',
    channel: 'telegram',
    handle: '@sofia_fontanera',
    nextSlot: 'hoy 16:30',
  },
  {
    id: 'tech-andres',
    name: 'Andrés López',
    specialty: 'electrical',
    city: 'Madrid',
    channel: 'telegram',
    handle: '@andres_electric',
    nextSlot: 'mañana 12:00',
  },
];
