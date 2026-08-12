import { clsx, type ClassValue } from 'clsx';

/**
 * Conditional className joining.
 *
 * Replaces the template-literal ternaries that had crept into seven components.
 * For anything with real variants (size, state, intent) reach for `cva` instead —
 * this is for ad-hoc conditions.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
