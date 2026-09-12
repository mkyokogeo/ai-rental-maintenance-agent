import pg from 'pg';

function withoutSslMode(databaseUrl) {
  const parsed = new URL(databaseUrl);
  parsed.searchParams.delete('sslmode');
  return parsed.toString();
}

function candidateUrls(databaseUrl) {
  const urls = [{ label: 'direct', url: withoutSslMode(databaseUrl) }];
  let parsed;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    return urls;
  }

  const host = parsed.hostname;
  if (!host.startsWith('db.') || !host.endsWith('.supabase.co')) {
    return urls;
  }

  const projectRef = host.split('.')[1];
  const pooler = new URL(databaseUrl);
  pooler.hostname = 'aws-1-eu-west-1.pooler.supabase.com';
  pooler.port = '5432';
  pooler.username = `${decodeURIComponent(parsed.username)}.${projectRef}`;
  pooler.searchParams.delete('sslmode');
  urls.push({ label: 'session pooler', url: pooler.toString() });
  return urls;
}

let pool;
let poolLabel;

async function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en .env');
  }

  let lastError;
  for (const candidate of candidateUrls(process.env.DATABASE_URL)) {
    const nextPool = new pg.Pool({
      connectionString: candidate.url,
      ssl: { rejectUnauthorized: false },
      max: 2,
      connectionTimeoutMillis: 12000,
    });
    try {
      const client = await nextPool.connect();
      client.release();
      pool = nextPool;
      poolLabel = candidate.label;
      console.log(`Postgres conectado por ${poolLabel} (solo lectura)`);
      return pool;
    } catch (error) {
      lastError = error;
      await nextPool.end().catch(() => {});
    }
  }

  throw lastError;
}

export async function readPropertyContext() {
  const db = await getPool();
  const { rows: properties } = await db.query(`
    select
      p.id,
      p.name,
      p.address_line1,
      p.city,
      p.country,
      p.latitude,
      p.longitude,
      l.name as landlord_name,
      l.email as landlord_email
    from public.properties p
    left join public.landlords l on l.id = p.landlord_id
    order by p.created_at
    limit 1
  `);
  const { rows: providers } = await db.query(`
    select name, phone, city, categories, brands
    from public.service_providers
    order by created_at
  `);

  return {
    property: properties[0] || null,
    providers,
  };
}

export function matchProvider(providers, incident) {
  const haystack = [
    incident.technician_type,
    incident.problem_type,
    incident.summary,
    incident.guest_description,
  ].filter(Boolean).join(' ').toLowerCase();

  let best = null;
  let bestScore = -1;
  for (const provider of providers) {
    const categories = (provider.categories || []).join(' ').toLowerCase();
    const brands = (provider.brands || []).join(' ').toLowerCase();
    let score = 0;
    if (categories && haystack.includes(categories.split(' ')[0])) score += 1;
    if (categories.includes('hvac') && /hvac|air|ac|climat|daikin|cool/.test(haystack)) score += 3;
    if (categories.includes('appliance') && /wash|oven|bosch|appliance|machine|lavadora|horno/.test(haystack)) score += 3;
    for (const brand of provider.brands || []) {
      if (brand && haystack.includes(String(brand).toLowerCase())) score += 2;
    }
    if (score > bestScore) {
      best = provider;
      bestScore = score;
    }
  }
  return best || providers[0] || null;
}
