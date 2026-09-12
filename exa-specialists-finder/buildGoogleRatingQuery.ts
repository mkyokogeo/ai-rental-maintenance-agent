export function buildGoogleRatingQuery(name: string, city: string): string {
  // EN: Find the Google Maps / Google Business Profile listing for this specific business and
  // report its Google rating and review count. Kept close in style to buildQuery.ts's confirmed
  // wording: plain "ponlo como null" instead of spelled-out placeholder examples, since the latter
  // has empirically dragged Exa's retrieval toward unrelated pages.
  return `Busca la ficha de Google Maps o Google Business Profile de "${name}", un negocio en ${city}, España. Dime su valoración media en Google (de 1 a 5) y el número total de reseñas en Google. Si no encuentras la ficha de Google de este negocio en concreto, pon la valoración y el número de reseñas como null.`;
}
