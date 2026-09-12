import { exa } from './exaInstance';
import { Specialty, Specialist, FindSpecialistsResult } from './types';
import { buildQuery } from './buildQuery';
import { specialistsSchema } from './schema';
import { saveServiceProviders } from './serviceProvidersRepo';
import { findGoogleRating } from './findGoogleRating';
import { computeRankScore } from './rankScore';

interface AnswerPayload {
  specialists: Specialist[];
}

export async function findSpecialists(
  specialty: Specialty,
  city: string
): Promise<FindSpecialistsResult> {
  const response = await exa.answer(buildQuery(specialty, city), {
    text: true,
    outputSchema: specialistsSchema,
  });

  const answer = response.answer as unknown as AnswerPayload;

  const withEmail = (answer.specialists ?? []).filter(
    (s) => typeof s.email === 'string' && s.email.trim().length > 0
  );

  const specialists = await Promise.all(
    withEmail.map(async (s) => {
      const { rating, reviewsCount } = await findGoogleRating(s.name, s.city ?? city);
      return { ...s, rankScore: computeRankScore(rating, reviewsCount) };
    })
  );

  await saveServiceProviders(specialty, specialists);

  return { specialists };
}