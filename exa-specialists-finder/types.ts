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
  rankScore?: number | null;
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

export const SPECIALTY_CATEGORIES: Record<Specialty, string[]> = {
  plumber: ['plumbing', 'water_leak', 'pipe_repair', 'drain_clog', 'water_heater'],
  electrician: ['electrical', 'wiring', 'power_outage', 'circuit_breaker', 'lighting'],
  locksmith: ['locksmith', 'lock_repair', 'key_replacement', 'lockout', 'door_security'],
};