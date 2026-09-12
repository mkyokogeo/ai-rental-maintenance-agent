import 'dotenv/config';
import Exa from 'exa-js';
import { Specialty, Specialist, FindSpecialistsResult } from './types';
import { buildQuery } from './buildQuery';
import { specialistsSchema } from './schema';
import { saveServiceProviders } from './serviceProvidersRepo';

const apiKey = process.env.EXA_API_KEY;
if (!apiKey) {
  throw new Error('EXA_API_KEY is not set. Add it to your .env file.');
}

const exa = new Exa(apiKey);

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

  const specialists = (answer.specialists ?? []).filter(
    (s) => typeof s.email === 'string' && s.email.trim().length > 0
  );

  await saveServiceProviders(specialty, specialists);

  return { specialists };
}