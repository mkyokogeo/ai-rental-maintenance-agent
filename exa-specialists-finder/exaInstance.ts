import 'dotenv/config';
import Exa from 'exa-js';

const apiKey = process.env.EXA_API_KEY;
if (!apiKey) {
  throw new Error('EXA_API_KEY is not set. Add it to your .env file.');
}

export const exa = new Exa(apiKey);
