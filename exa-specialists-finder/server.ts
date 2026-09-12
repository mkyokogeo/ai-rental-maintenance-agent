import express from 'express';
import { findSpecialists } from './exaClient';
import { Specialty } from './types';

const app = express();
app.use(express.json());

const ALL_SPECIALTIES: Specialty[] = ['plumber', 'electrician', 'locksmith'];

app.post('/specialists', async (req, res) => {
  const { city } = req.body as { city?: string };

  if (!city || typeof city !== 'string' || !city.trim()) {
    res.status(400).json({ error: 'city is required' });
    return;
  }

  try {
    const results = await Promise.all(
      ALL_SPECIALTIES.map((specialty) => findSpecialists(specialty, city))
    );

    ALL_SPECIALTIES.forEach((specialty, i) => {
      console.log(`--- ${specialty} in ${city} ---`);
      console.log(results[i].specialists);
    });

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Failed to fetch specialists:', err);
    process.exit(1);
  }
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
