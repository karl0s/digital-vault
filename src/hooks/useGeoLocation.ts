/**
 * PARKED — no callers today, do not delete as dead code.
 *
 * This powered the "Shows from <your country>" row on the landing page, which
 * was removed when the landing was pared back to Featured + Soundboards. The
 * removal was explicitly "for now", so the hook stays ready to wire back up.
 *
 * A dead-code sweep will flag this file as an orphan module — that is expected.
 */

import { useMemo } from 'react';

interface GeoLocation {
  city: string | null;
  countryName: string | null;
  region: string | null;
}

/**
 * Approximate the visitor's country with zero network calls.
 *
 * This previously fetched ipapi.co, which had three problems: the free tier
 * rate-limits (and its 429 response carries no CORS header, so the browser
 * blocks it and the failure is silent), the result was cached only in
 * sessionStorage so every new tab spent another request, and it leaked the
 * visitor's IP to a third party for a cosmetic homepage row.
 *
 * The browser already knows enough. The IANA time zone reflects the machine's
 * actual location, and Intl.DisplayNames turns a country code into exactly the
 * English names this collection uses ("United States", "United Kingdom",
 * "Netherlands", "South Korea").
 *
 * Deliberate trade-off: country only, never city. A time zone names a
 * representative city, not the visitor's — everyone from Manchester to
 * Penzance reports Europe/London — so claiming "Shows from London" would be a
 * guess dressed up as a fact. Country is a claim the signal can actually
 * support.
 */

/** IANA time zone → ISO 3166-1 alpha-2. Covers every country in the archive plus common zones. */
const ZONE_TO_COUNTRY: Record<string, string> = {
  // Europe
  'Europe/London': 'GB', 'Europe/Belfast': 'GB', 'Europe/Guernsey': 'GB', 'Europe/Isle_of_Man': 'GB', 'Europe/Jersey': 'GB',
  'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Busingen': 'DE',
  'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Luxembourg': 'LU',
  'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES', 'Europe/Lisbon': 'PT', 'Atlantic/Azores': 'PT', 'Atlantic/Madeira': 'PT',
  'Europe/Rome': 'IT', 'Europe/Vienna': 'AT', 'Europe/Zurich': 'CH', 'Europe/Prague': 'CZ',
  'Europe/Warsaw': 'PL', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI', 'Europe/Athens': 'GR', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO',
  'Europe/Belgrade': 'RS', 'Europe/Zagreb': 'HR', 'Europe/Ljubljana': 'SI', 'Europe/Bratislava': 'SK',
  'Europe/Sofia': 'BG', 'Europe/Tallinn': 'EE', 'Europe/Riga': 'LV', 'Europe/Vilnius': 'LT',
  'Atlantic/Reykjavik': 'IS', 'Europe/Malta': 'MT', 'Europe/Moscow': 'RU', 'Europe/Kaliningrad': 'RU',
  'Europe/Kyiv': 'UA', 'Europe/Kiev': 'UA', 'Europe/Istanbul': 'TR',

  // North America
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Phoenix': 'US',
  'America/Los_Angeles': 'US', 'America/Anchorage': 'US', 'America/Detroit': 'US', 'America/Boise': 'US',
  'America/Indiana/Indianapolis': 'US', 'America/Kentucky/Louisville': 'US', 'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA', 'America/Montreal': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA', 'America/Halifax': 'CA', 'America/St_Johns': 'CA', 'America/Regina': 'CA',
  'America/Mexico_City': 'MX', 'America/Tijuana': 'MX', 'America/Monterrey': 'MX', 'America/Cancun': 'MX',

  // South America
  'America/Sao_Paulo': 'BR', 'America/Bahia': 'BR', 'America/Fortaleza': 'BR', 'America/Recife': 'BR',
  'America/Manaus': 'BR', 'America/Belem': 'BR',
  'America/Argentina/Buenos_Aires': 'AR', 'America/Santiago': 'CL', 'America/Bogota': 'CO',
  'America/Lima': 'PE', 'America/Havana': 'CU', 'America/Montevideo': 'UY', 'America/Caracas': 'VE',

  // Asia & Middle East
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN',
  'Asia/Dubai': 'AE', 'Asia/Jerusalem': 'IL', 'Asia/Riyadh': 'SA', 'Asia/Tehran': 'IR',

  // Oceania
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU', 'Australia/Hobart': 'AU', 'Australia/Darwin': 'AU',
  'Pacific/Auckland': 'NZ', 'Pacific/Chatham': 'NZ', 'Pacific/Fiji': 'FJ', 'Pacific/Port_Moresby': 'PG',

  // Africa
  'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE',
  'Africa/Casablanca': 'MA', 'Africa/Accra': 'GH', 'Africa/Tunis': 'TN', 'Africa/Algiers': 'DZ',
};

/** Country code from the browser's locale — a fallback for zones not in the table. */
function countryFromLocale(): string | null {
  const tags = [
    ...(typeof navigator !== 'undefined' && navigator.languages ? navigator.languages : []),
    typeof navigator !== 'undefined' ? navigator.language : '',
  ].filter(Boolean);

  for (const tag of tags) {
    try {
      const region = new Intl.Locale(tag).region;
      if (region) return region;
    } catch {
      // Malformed tag — try the next one.
    }
  }
  return null;
}

export function useGeoLocation(): GeoLocation | null {
  return useMemo(() => {
    let code: string | null = null;

    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zone) code = ZONE_TO_COUNTRY[zone] ?? null;
    } catch {
      // Intl unavailable — fall through to the locale check.
    }

    if (!code) code = countryFromLocale();
    if (!code) return null;

    let countryName: string | null = null;
    try {
      countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? null;
    } catch {
      return null;
    }

    // `of()` echoes the input back when it doesn't recognise the code.
    if (!countryName || countryName === code) return null;

    return { city: null, countryName, region: null };
  }, []);
}
