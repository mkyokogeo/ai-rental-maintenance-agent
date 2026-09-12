export type Specialty = 'plumber' | 'electrician' | 'locksmith';

export interface Specialist {
  name: string;
  phone?: string | null;
  email: string;
  description: string;
  city?: string | null;
  region?: string | null;
  address?: string | null;
  website?: string | null;
  rankScore: number
  sourceUrl: string;
}

export interface FindSpecialistsResult {
  specialists: Specialist[];
}

export const SPECIALTY_TERMS: Record<Specialty, string> = {
  plumber: 'fontanero',
  electrician: 'electricista',
  locksmith: 'cerrajero',
};