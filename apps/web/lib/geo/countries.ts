export type CountryOption = {
  code: string;
  name: string;
};

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'DE', name: 'Deutschland' },
  { code: 'AT', name: 'Oesterreich' },
  { code: 'CH', name: 'Schweiz' },
  { code: 'US', name: 'Vereinigte Staaten' },
  { code: 'GB', name: 'Vereinigtes Koenigreich' },
  { code: 'FR', name: 'Frankreich' },
  { code: 'NL', name: 'Niederlande' },
  { code: 'BE', name: 'Belgien' },
  { code: 'PL', name: 'Polen' },
  { code: 'TR', name: 'Tuerkei' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'RU', name: 'Russland' },
  { code: 'IT', name: 'Italien' },
  { code: 'ES', name: 'Spanien' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Griechenland' },
  { code: 'SE', name: 'Schweden' },
  { code: 'NO', name: 'Norwegen' },
  { code: 'DK', name: 'Daenemark' },
  { code: 'FI', name: 'Finnland' },
  { code: 'CA', name: 'Kanada' },
  { code: 'MX', name: 'Mexiko' },
  { code: 'BR', name: 'Brasilien' },
  { code: 'AR', name: 'Argentinien' },
  { code: 'CN', name: 'China' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'Suedkorea' },
  { code: 'IN', name: 'Indien' },
  { code: 'AU', name: 'Australien' },
  { code: 'ZA', name: 'Suedafrika' },
].sort((a, b) => a.name.localeCompare(b.name, 'de'));

export const COUNTRY_NAME_BY_CODE = new Map(
  COUNTRY_OPTIONS.map((country) => [country.code, country.name]),
);

export function normalizeCountryCode(value: unknown): string | null {
  const code = String(value ?? '').trim().toUpperCase();
  return COUNTRY_NAME_BY_CODE.has(code) ? code : null;
}
