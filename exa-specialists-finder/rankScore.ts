// Confidence threshold: businesses with fewer reviews than this get pulled toward the prior.
const MIN_VOTES = 10;
const PRIOR_RATING = 4.0;

export function computeRankScore(rating: number | null, reviewsCount: number | null): number | null {
  if (rating == null || reviewsCount == null || reviewsCount < 0) return null;

  const v = reviewsCount;
  const m = MIN_VOTES;
  return (v / (v + m)) * rating + (m / (v + m)) * PRIOR_RATING;
}
