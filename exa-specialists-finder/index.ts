import { findSpecialists } from './exaClient';

async function main() {
  const result = await findSpecialists('plumber', 'Valencia');
}

main().catch(console.error);