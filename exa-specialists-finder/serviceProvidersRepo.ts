import { pool } from './db';
import { Specialist, Specialty, SPECIALTY_CATEGORIES } from './types';

const COUNTRY = 'ES';

export async function saveServiceProviders(
  category: Specialty,
  specialists: Specialist[]
): Promise<void> {
  if (specialists.length === 0) return;

  const categories = SPECIALTY_CATEGORIES[category] ?? [];

  const client = await pool.connect();
  try {
    for (const s of specialists) {
      await client.query(
        `INSERT INTO service_providers
          (name, category, website, email, phone, city, region, country, description, source_url, rank_score, categories)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          s.name,
          category,
          s.website ?? null,
          s.email,
          s.phone ?? null,
          s.city ?? null,
          s.region ?? null,
          COUNTRY,
          s.description,
          s.sourceUrl,
          s.rankScore ?? null,
          categories,
        ]
      );
    }
  } finally {
    client.release();
  }
}
