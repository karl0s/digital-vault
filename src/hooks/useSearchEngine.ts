import { useMemo } from 'react';
import { Show } from '../../App';
import { createSearchIndex } from '../search/searchIndex';

export function useSearchEngine(shows: Show[]) {
  return useMemo(() => createSearchIndex(shows), [shows]);
}
