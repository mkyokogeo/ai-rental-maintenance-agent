import { exa } from './exaInstance';
import { buildGoogleRatingQuery } from './buildGoogleRatingQuery';
import { googleRatingSchema } from './googleRatingSchema';

export interface GoogleRating {
  rating: number | null;
  reviewsCount: number | null;
  sourceUrl: string | null;
}

const NO_RATING: GoogleRating = { rating: null, reviewsCount: null, sourceUrl: null };

/** Looks up a business's Google rating/review count via Exa. Never throws. */
export async function findGoogleRating(name: string, city: string): Promise<GoogleRating> {
  try {
    const response = await exa.answer(buildGoogleRatingQuery(name, city), {
      outputSchema: googleRatingSchema,
    });

    const result = response.answer as unknown as Partial<GoogleRating>;

    return {
      rating: typeof result.rating === 'number' ? result.rating : null,
      reviewsCount: typeof result.reviewsCount === 'number' ? result.reviewsCount : null,
      sourceUrl: typeof result.sourceUrl === 'string' ? result.sourceUrl : null,
    };
  } catch (err) {
    console.error(`Failed to fetch Google rating for "${name}" in ${city}:`, err);
    return NO_RATING;
  }
}
