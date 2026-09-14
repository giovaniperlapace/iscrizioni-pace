type Relation<T> = T | T[] | null;
export type ParticipantGeography = {
  country_other?: string | null;
  city_other?: string | null;
  countries?: Relation<{ name_it: string | null }>;
  cities?: Relation<{ name: string | null }>;
};

// Explicit current text takes precedence over a potentially older catalogue link.
export function participantGeography(participant: ParticipantGeography | null | undefined) {
  const country = one(participant?.countries);
  const city = one(participant?.cities);
  return {
    country: participant?.country_other?.trim() || country?.name_it?.trim() || null,
    city: participant?.city_other?.trim() || city?.name?.trim() || null,
  };
}

function one<T>(value: Relation<T> | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
