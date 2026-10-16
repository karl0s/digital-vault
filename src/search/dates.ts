/**
 * Dates typed the way traders write them (docs/ux-research, finding F6).
 *
 * A date is a trader's first search, and before this every format returned
 * nothing: the index holds the year alone, and MiniSearch splits "1996-05-24"
 * into three words that must all match. Dates are taken out of the query here
 * and applied as a filter on ShowDate; the words left over are searched as
 * usual among those shows.
 *
 *   1996-05-24   1996/05/24   24.05.1996   24.05.96   24/05/1996   05/24/1996
 *   24 May 1996  May 24, 1996  24th May 1996  24. Mai 1996  May 1996  May '96
 *   1996-05   05/1996   '97
 *
 * A slashed or dashed date with both parts 12 or under (05/06/1997) is read
 * both ways, day first and month first; dotted dates are day first, the
 * European way. Month names in English, German, Dutch, French, Spanish,
 * Portuguese and Italian, without accents. A bare two-digit year ("Rock am
 * Ring 97") is not taken here: it may be a song number, so searchShows tries it
 * as a year only when the words alone find nothing.
 */

export interface DateTerm {
  /** ShowDate prefixes, any of which matches: "1996-05-24", "1996-05", "1996". */
  prefixes: string[];
}

const MONTH_NAMES: Record<string, number> = {};
const add = (month: number, ...names: string[]) => names.forEach(n => { MONTH_NAMES[n] = month; });
// English (with abbreviations), then German, Dutch, French, Spanish, Portuguese,
// Italian. "mars" (French March) is left out: "30 Seconds to Mars 2010".
add(1, 'january', 'jan', 'januar', 'januari', 'janvier', 'enero', 'janeiro', 'gennaio');
add(2, 'february', 'feb', 'februar', 'februari', 'fevrier', 'febrero', 'fevereiro', 'febbraio');
add(3, 'march', 'mar', 'marz', 'maerz', 'maart', 'marzo', 'marco');
add(4, 'april', 'apr', 'avril', 'abril', 'aprile');
add(5, 'may', 'mai', 'mei', 'mayo', 'maio', 'maggio');
add(6, 'june', 'jun', 'juni', 'juin', 'junio', 'junho', 'giugno');
add(7, 'july', 'jul', 'juli', 'juillet', 'julio', 'julho', 'luglio');
add(8, 'august', 'aug', 'augustus', 'aout', 'agosto');
add(9, 'september', 'sep', 'sept', 'septembre', 'septiembre', 'setiembre', 'setembro', 'settembre');
add(10, 'october', 'oct', 'oktober', 'octobre', 'octubre', 'outubro', 'ottobre');
add(11, 'november', 'nov', 'novembre', 'noviembre', 'novembro');
add(12, 'december', 'dec', 'dezember', 'decembre', 'diciembre', 'dezembro', 'dicembre');

const MONTH = `(${Object.keys(MONTH_NAMES).sort((a, b) => b.length - a.length).join('|')})\\.?`;
const DAY = '(\\d{1,2})(?:st|nd|rd|th|er|e|\\.)?';
const YEAR = "('?\\d{2}|\\d{4})";

const fold = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const pad = (n: number) => String(n).padStart(2, '0');

/** "97" → 1997, "05" → 2005: the collection runs from the 1960s. */
function fullYear(y: string): number | null {
  const digits = y.replace(/^['’]/, '');
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return null;
  if (digits.length === 4) return n >= 1900 && n <= 2099 ? n : null;
  return n >= 30 ? 1900 + n : 2000 + n;
}

const validDay = (y: number, m: number, d: number) =>
  m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();

const day = (y: number, m: number, d: number) => (validDay(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null);

/** Every date in the query, and what is left once they are taken out. */
export function extractDates(query: string): { dates: DateTerm[]; rest: string } {
  let text = ` ${fold(query).replace(/[’]/g, "'")} `;
  const dates: DateTerm[] = [];
  const take = (pattern: string, toPrefixes: (m: RegExpExecArray) => (string | null)[]) => {
    const rx = new RegExp(`(?<=\\s)${pattern}(?=[\\s,]|$)`, 'g');
    text = text.replace(rx, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray;
      const prefixes = [...new Set(toPrefixes(m).filter((p): p is string => Boolean(p)))];
      if (!prefixes.length) return m[0];
      dates.push({ prefixes });
      return ' ';
    });
  };

  // 1996-05-24, 1996/05/24, 1996.05.24
  take('(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})', m => [day(+m[1], +m[2], +m[3])]);
  // 24.05.1996 (day first); 24/05/1996, 05/24/1996, 24-05-96 (either way round)
  take("(\\d{1,2})([-/.])(\\d{1,2})\\2('?\\d{2}|\\d{4})", m => {
    const y = fullYear(m[4]);
    if (!y) return [];
    const a = +m[1], b = +m[3];
    return m[2] === '.' ? [day(y, b, a)] : [day(y, b, a), day(y, a, b)];
  });
  // 24 May 1996, 24th May 1996, 24. Mai 1996
  take(`${DAY}\\s+${MONTH},?\\s+${YEAR}`, m => {
    const y = fullYear(m[3]);
    return y ? [day(y, MONTH_NAMES[m[2]], +m[1])] : [];
  });
  // May 24 1996, May 24, 1996
  take(`${MONTH}\\s+${DAY},?\\s+${YEAR}`, m => {
    const y = fullYear(m[3]);
    return y ? [day(y, MONTH_NAMES[m[1]], +m[2])] : [];
  });
  // May 1996, May '96
  take(`${MONTH},?\\s+${YEAR}`, m => {
    const y = fullYear(m[2]);
    return y ? [`${y}-${pad(MONTH_NAMES[m[1]])}`] : [];
  });
  // 1996-05, 1996/05
  take('(\\d{4})[-/.](\\d{1,2})', m => (+m[2] >= 1 && +m[2] <= 12 ? [`${m[1]}-${pad(+m[2])}`] : []));
  // 05/1996, 5-1996
  take('(\\d{1,2})[-/.](\\d{4})', m => (+m[1] >= 1 && +m[1] <= 12 ? [`${m[2]}-${pad(+m[1])}`] : []));
  // '97
  take("'(\\d{2})", m => {
    const y = fullYear(m[1]);
    return y ? [String(y)] : [];
  });

  return { dates, rest: text.replace(/\s+/g, ' ').trim() };
}
