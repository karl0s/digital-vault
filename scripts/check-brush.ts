/**
 * Brush geometry checks.
 *
 * Run: npm run check:brush
 *
 * The pointer handling itself needs a browser, so everything that can go
 * subtly wrong in the maths lives in src/lib/brush.ts and is verified here:
 * edge rounding, inverted drags, clamping, handle hit-testing.
 */

import {
  Track,
  clampYear,
  dragHandle,
  dragNew,
  isFullSpan,
  nearestHandle,
  rangeToSpan,
  xToYear,
  yearToSpan,
  yearToX,
} from '../src/lib/brush';

let failures = 0;
let checks = 0;

function ok(label: string, pass: boolean, detail = ''): void {
  checks++;
  if (pass) console.log(`  ok   ${label}`);
  else { failures++; console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`); }
}
function eq(label: string, actual: unknown, expected: unknown): void {
  ok(label, JSON.stringify(actual) === JSON.stringify(expected),
     `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// The real archive: 1965..2016 is 52 columns. 520px makes each column 10px,
// so every boundary lands on a round number and off-by-ones are obvious.
const track: Track = { trackWidth: 520, minYear: 1965, maxYear: 2016 };

console.log('\ntrack: 1965–2016 across 520px (10px per year)');

console.log('\nx -> year');
eq('left edge is the first year', xToYear(0, track), 1965);
eq('just inside the first column', xToYear(9.9, track), 1965);
eq('exact boundary belongs to the NEXT column', xToYear(10, track), 1966);
eq('mid-track', xToYear(255, track), 1990);
eq('right edge is the last year', xToYear(519, track), 2016);
eq('past the right edge clamps', xToYear(9999, track), 2016);
eq('negative clamps to the first year', xToYear(-50, track), 1965);

console.log('\nyear -> x');
eq('first year sits at 0', yearToX(1965, track), 0);
eq('second year at one column', yearToX(1966, track), 10);
eq('last year at the final column', yearToX(2016, track), 510);
eq('column width', yearToSpan(1990, track).width, 10);

console.log('\nround trip across every year');
{
  let bad = 0;
  for (let y = track.minYear; y <= track.maxYear; y++) {
    // Probe the middle of each column — the pixel a user would actually hit.
    const mid = yearToX(y, track) + yearToSpan(y, track).width / 2;
    if (xToYear(mid, track) !== y) bad++;
  }
  ok('every year survives year -> x -> year', bad === 0, `${bad} years mismatched`);
}

console.log('\nselection span');
eq('single year spans one column', rangeToSpan(1990, 1990, track), { x: 250, width: 10 });
eq('inclusive of both ends', rangeToSpan(1990, 1992, track), { x: 250, width: 30 });
eq('reversed input still spans correctly', rangeToSpan(1992, 1990, track), { x: 250, width: 30 });
eq('full span covers the track', rangeToSpan(1965, 2016, track), { x: 0, width: 520 });

console.log('\nhandle hit-testing');
{
  const from = 1990; // left edge at 250
  const to = 2000;   // right edge at 360
  eq('on the from handle', nearestHandle(250, from, to, track), 'from');
  eq('near the from handle', nearestHandle(258, from, to, track), 'from');
  eq('on the to handle', nearestHandle(360, from, to, track), 'to');
  eq('near the to handle', nearestHandle(352, from, to, track), 'to');
  eq('in the middle grabs neither', nearestHandle(305, from, to, track), null);
  eq('far outside grabs neither', nearestHandle(20, from, to, track), null);
  eq('a one-year range resolves to from, never deadlock',
     nearestHandle(250, 1990, 1990, track), 'from');
}

console.log('\ndragging a handle');
{
  eq('from moves left', dragHandle('from', 200, 1990, 2000, track), { from: 1985, to: 2000, handle: 'from' });
  eq('to moves right', dragHandle('to', 400, 1990, 2000, track), { from: 1990, to: 2005, handle: 'to' });
  eq('dragging from PAST to swaps roles rather than sticking',
     dragHandle('from', 400, 1990, 2000, track), { from: 2000, to: 2005, handle: 'to' });
  eq('dragging to PAST from swaps roles',
     dragHandle('to', 100, 1990, 2000, track), { from: 1975, to: 1990, handle: 'from' });
  eq('dragging beyond the track clamps',
     dragHandle('to', 99999, 1990, 2000, track), { from: 1990, to: 2016, handle: 'to' });
}

console.log('\ndragging a new range');
{
  eq('left to right', dragNew(250, 350, track), { from: 1990, to: 2000 });
  eq('right to left produces the same range', dragNew(350, 250, track), { from: 1990, to: 2000 });
  eq('no movement is a single year', dragNew(255, 255, track), { from: 1990, to: 1990 });
}

console.log('\nfull-span detection (equivalent to no filter)');
{
  ok('both ends at the extremes', isFullSpan(1965, 2016, track));
  ok('nulls count as unbounded', isFullSpan(null, null, track));
  ok('one null, one extreme', isFullSpan(null, 2016, track));
  ok('beyond the extremes still counts', isFullSpan(1900, 2100, track));
  ok('a real range does not', !isFullSpan(1990, 2000, track));
  ok('open start with a real end does not', !isFullSpan(null, 2000, track));
}

console.log('\nclamping');
eq('below the floor', clampYear(1900, track), 1965);
eq('above the ceiling', clampYear(2100, track), 2016);
eq('inside is untouched', clampYear(1993, track), 1993);

console.log('\ndegenerate tracks');
{
  const single: Track = { trackWidth: 100, minYear: 2000, maxYear: 2000 };
  eq('single-year track maps anywhere to that year', xToYear(50, single), 2000);
  eq('single-year column fills the track', yearToSpan(2000, single).width, 100);
  const zero: Track = { trackWidth: 0, minYear: 1990, maxYear: 2000 };
  eq('zero-width track does not divide by zero', xToYear(10, zero), 1990);
}

console.log(`\n${checks - failures}/${checks} passed`);
if (failures > 0) { console.log(`${failures} FAILED\n`); process.exit(1); }
console.log('Brush geometry holds.\n');
