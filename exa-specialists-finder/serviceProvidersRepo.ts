import { pool } from './db';
import { Specialist, Specialty } from './types';

const COUNTRY = 'ES';

export async function saveServiceProviders(
  category: Specialty,
  specialists: Specialist[]
): Promise<void> {
  if (specialists.length === 0) return;

  const client = await pool.connect();
  for (const s of specialists) {
    await client.query(
      `INSERT INTO service_providers
        (name, category, website, email, phone, city, region, country, description, source_url, exa_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
        null,
      ]
    );
  }

  client.release();
}
