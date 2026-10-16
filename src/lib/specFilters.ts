/**
 * "More filters" (docs/ux-research F12, agreed 2026-10-16): the specs traders
 * decide by — quality, PAL or NTSC, length, and whether a setlist is known.
 *
 * Closed lists, unlike Country and Event, so each option is defined here once:
 * its URL value, its label, and which shows have it. url.ts reads the values
 * (a link can only select these), facets.ts the matching and the labels, and
 * the popover the order. Source (Pro-shot, Audience) joins once the 329 blank
 * records are filled in: with 27% blank it would hide shows.
 */

import type { Show } from '../../App';
import { quality } from './specs';

export interface SpecOption {
  value: string;
  label: string;
}

export interface SpecFacet {
  label: string;
  /** A line under the heading, when the options need one. */
  hint?: string;
  options: SpecOption[];
}

export const SPEC_FACETS = {
  quality: {
    label: 'Quality',
    options: [
      { value: 'hd-1080', label: 'HD 1080' },
      { value: 'hd-720', label: 'HD 720' },
      { value: 'sd', label: 'SD' },
      { value: 'low-res', label: 'Low-res' },
    ],
  },
  standard: {
    label: 'Standard',
    // As in the drawer: on HD records the field is unreliable, so they have none.
    hint: 'SD and low-res copies',
    options: [
      { value: 'pal', label: 'PAL' },
      { value: 'ntsc', label: 'NTSC' },
    ],
  },
  length: {
    label: 'Length',
    options: [
      { value: 'under-10', label: 'Under 10 min' },
      { value: '10-30', label: '10–30 min' },
      { value: '30-60', label: '30–60 min' },
      { value: '60-90', label: '1–1½ hours' },
      { value: 'over-90', label: 'Over 1½ hours' },
    ],
  },
  setlist: {
    label: 'Setlist',
    options: [
      { value: 'yes', label: 'Has a setlist' },
      { value: 'no', label: 'No setlist yet' },
    ],
  },
} satisfies Record<string, SpecFacet>;

export type SpecFacetKey = keyof typeof SPEC_FACETS;
export const SPEC_FACET_KEYS = Object.keys(SPEC_FACETS) as SpecFacetKey[];

/** A show's value for one of these filters; '' when it has none (no size, no length, HD for Standard). */
export function specValue(show: Show, facet: SpecFacetKey): string {
  switch (facet) {
    case 'quality': {
      const q = quality(show);
      if (!q) return '';
      return q.tier === 'hd' ? (q.label === 'HD 1080' ? 'hd-1080' : 'hd-720') : q.tier === 'low' ? 'low-res' : 'sd';
    }
    case 'standard': {
      if (quality(show)?.tier === 'hd') return '';
      const std = show.TVStandard?.trim().toLowerCase();
      return std === 'pal' || std === 'ntsc' ? std : '';
    }
    case 'length': {
      const min = Math.round(parseInt(show.DurationSec || '0', 10) / 60);
      if (!min) return '';
      return min < 10 ? 'under-10' : min < 30 ? '10-30' : min < 60 ? '30-60' : min < 90 ? '60-90' : 'over-90';
    }
    case 'setlist':
      return show.Setlist?.trim() ? 'yes' : 'no';
  }
}

/** The label for one of a filter's values. */
export function specLabel(facet: SpecFacetKey, value: string): string | undefined {
  return (SPEC_FACETS[facet].options as SpecOption[]).find(o => o.value === value)?.label;
}
