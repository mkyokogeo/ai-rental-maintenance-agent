import 'dotenv/config';
import { readPropertyContext } from './db.js';

const { property, providers } = await readPropertyContext();
console.log('\nPROPERTY');
console.log(JSON.stringify(property, null, 2));
console.log('\nPROVIDERS');
console.log(JSON.stringify(providers, null, 2));
