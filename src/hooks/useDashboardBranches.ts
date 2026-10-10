import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readCatalog } from '../lib/catalog';
import { repairBranchSelection } from '../lib/branchPolicy';
import type { DashboardBranch } from '../lib/branchPolicy';

export function useDashboardBranches<T extends DashboardBranch>(
  businessId: string,
  onError: (message: string) => void,
  onBranchChange?: Dispatch<SetStateAction<string>>,
  selectedBranch = 'all',
): T[] {
  const [catalog, setCatalog] = useState<{ businessId: string; branches: T[] } | null>(null);
  useEffect(() => {
    if (!businessId) return;
    let active = true;
    void readCatalog<T>('branches', businessId).then(({ data, error }) => {
      if (!active) return;
      const branches = error ? [] : data ?? [];
      setCatalog({ businessId, branches });
      if (error) onError(error.message);
      else onBranchChange?.(selected => repairBranchSelection(branches, selected));
    });
    return () => { active = false; };
  }, [businessId, onError, onBranchChange, selectedBranch]);
  // Changing businesses hides the old catalog in the same render, before effects.
  return catalog?.businessId === businessId ? catalog.branches : [];
}
