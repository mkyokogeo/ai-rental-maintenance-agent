import { Specialty, SPECIALTY_TERMS } from './types';

export function buildQuery(specialty: Specialty, city: string): string {
  const term = SPECIALTY_TERMS[specialty] ?? specialty;
  // EN: Find ${term}s who offer services in ${city}, Spain, AND have a published email address —
  // only include a specialist if you found a real email address for them; skip any specialist
  // for whom you could not find one, do not include them with an empty/null email. For each one
  // that qualifies, give me the name of the company or professional, phone number, email
  // address, physical address, the Spanish province or autonomous community they are in, a brief
  // description of their services, and the exact URL of the page where you found this
  // information. If phone, address, website, city or region cannot be found, set that field to
  // null.
  //
  // NOTE on wording — confirmed empirically to return an empty array, because Exa searches using
  // this text itself, so odd phrasing drags retrieval toward unrelated pages instead of local
  // business listings: avoid spelling out placeholder examples like `no escribas texto de
  // relleno como "no proporcionado" o "no encontrado"` — pulls in API error-code/response-table
  // docs. A plain "ponlo como null" instruction is enough and works reliably on its own.
  return `Encuentra ${term}s que ofrecen servicios en ${city}, España Y que tengan una dirección de correo electrónico publicada. Incluye a un especialista sólo si encontraste un email real para él; si no encuentras el email de alguno, descártalo y no lo incluyas. Para cada uno que cumpla esto, dame el nombre de la empresa o profesional, número de teléfono, correo electrónico, dirección física, la provincia o comunidad autónoma donde está, una breve descripción de sus servicios, y la URL exacta de la página donde encontraste esta información. Si no se puede encontrar el teléfono, la dirección, el sitio web, la ciudad o la región, pon ese campo como null.`;
}