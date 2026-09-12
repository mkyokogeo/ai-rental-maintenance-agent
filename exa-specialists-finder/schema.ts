export const specialistsSchema = {
  type: 'object' as const,
  properties: {
    specialists: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Company name or specialist name' },
          phone: { type: ['string', 'null'], description: 'Phone number, or null if not found' },
          email: { type: 'string', description: 'Email address (required — see note below)' },
          description: { type: 'string', description: 'Brief description of the services' },
          city: { type: ['string', 'null'] },
          region: {
            type: ['string', 'null'],
            description: 'Spanish province or autonomous community (e.g. "Comunidad Valenciana"), or null if not found',
          },
          address: { type: ['string', 'null'], description: 'Physical address, or null if not found' },
          website: { type: ['string', 'null'], description: 'Website URL, or null if not found' },
          sourceUrl: {
            type: 'string',
            description: 'Exact URL of the page this specialist information was taken from',
          },
        },
        required: ['name', 'description', 'sourceUrl', 'email'],
      },
    },
  },
  required: ['specialists'],
};