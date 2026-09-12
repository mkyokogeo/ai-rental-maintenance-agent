export const googleRatingSchema = {
  type: 'object' as const,
  properties: {
    rating: {
      type: ['number', 'null'],
      description: 'Average Google rating for this specific business, from 1 to 5, or null if not found',
    },
    reviewsCount: {
      type: ['number', 'null'],
      description: 'Total number of Google reviews for this specific business, or null if not found',
    },
    sourceUrl: {
      type: ['string', 'null'],
      description:
        'Exact URL of the Google Maps or Google Business page where the rating was found, or null if not found',
    },
  },
  required: ['rating', 'reviewsCount'],
};
