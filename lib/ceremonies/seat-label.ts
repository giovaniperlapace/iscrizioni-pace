import type { SupportedLocale } from '../i18n/config.ts';
import type { MapSeat } from './seat-map.ts';
const words = {
  it: ['Settore','Blocco','Fila','Sedia'], en: ['Sector','Block','Row','Seat'],
  fr: ['Secteur','Bloc','Rangée','Siège'], de: ['Sektor','Block','Reihe','Sitz'],
  es: ['Sector','Bloque','Fila','Asiento'], nl: ['Sector','Blok','Rij','Stoel'],
  uk: ['Сектор','Блок','Ряд','Місце'],
} satisfies Record<SupportedLocale, string[]>;
export function openingSeatAddress(row: string) {
  const main = /^([A-E])-b([1-6])-r(\d+)$/.exec(row);
  if (main) return { block: Number(main[2]), row: Number(main[3]), key: `${main[1]}-b${main[2]}` };
  const rear = /^(H[12])-r(\d+)$/.exec(row);
  return rear ? { block: rear[1] === 'H1' ? 1 : 6, row: Number(rear[2]), key: rear[1] } : null;
}
export function ceremonySeatLabel(sector: string, seat: { row: string; number: string }, locale: SupportedLocale = 'it') {
  const [s,b,r,n] = words[locale], address = openingSeatAddress(seat.row);
  return `${s} ${sector}${address ? ` · ${b} ${address.block}` : ''} · ${r} ${address?.row ?? seat.row} · ${n} ${seat.number}`;
}
// View coordinates only. IDs, canonical labels and stored geometry are untouched.
export function ceremonyDisplayPoint(seat: MapSeat, opening: boolean) {
  const address = openingSeatAddress(seat.row);
  const afterB1 = /^[C-EH]/.test(seat.row) || (seat.row.startsWith('B-') && (address?.row ?? 0) >= 6);
  return opening ? { x: -seat.y * 1.6, y: seat.x * 1.1 + (afterB1 ? 64 : 0) } : { x: seat.x, y: seat.y };
}
export const seatAddressWords = (locale: SupportedLocale) => words[locale];
