import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.POSTGRESS;
if (!connectionString) {
  throw new Error('POSTGRESS is not set. Add it to your .env file.');
}

export const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
