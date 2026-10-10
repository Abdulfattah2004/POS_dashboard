export const DASHBOARD_BRANCH_NAMES = ['Palma', 'Manar', 'Haykaliye'] as const;

// IDs and lowercase stored names were observed in the read-only production
// capture dated 2026-10-06. Reconfirm with diagnostics/dashboard-branches.sql
// before deployment; never fall back to similarly named or hidden branches.
export const DAILY_BUSINESS_ID = '1593a757-910c-4e45-8dd2-26436bae0347';
export const DASHBOARD_BRANCHES = [
  { id: '93cbc500-8177-42a8-a74c-4a57c2113956', name: 'Palma' },
  { id: '12de0c1c-57fe-4367-9016-818f0ee3a88d', name: 'Manar' },
  { id: 'c0dbbe76-61ac-4c8f-b970-472a6751e810', name: 'Haykaliye' },
] as const;

export function dashboardBranchIds(businessId: string): string[] {
  return businessId === DAILY_BUSINESS_ID ? DASHBOARD_BRANCHES.map(branch => branch.id) : [];
}

export interface DashboardBranch {
  id: string;
  name: string;
  business_id: string;
}

// Require both the observed ID and business association. Missing or ambiguous
// entries exclude only that branch. All subsequent reads use this same subset.
export function resolveDashboardBranches<T extends DashboardBranch>(rows: T[], businessId: string): T[] {
  if (!businessId || rows.some(row => row.business_id !== businessId)) {
    throw new Error('Dashboard branch business scope mismatch');
  }
  if (businessId !== DAILY_BUSINESS_ID) return [];
  return DASHBOARD_BRANCHES.flatMap(branch => {
    const matches = rows.filter(row => row.id === branch.id);
    if (matches.length !== 1 || typeof matches[0].name !== 'string'
      || matches[0].name.trim().toLowerCase() !== branch.name.toLowerCase()) return [];
    // The selector uses customer-facing capitalization without altering DB rows.
    return [{ ...matches[0], name: branch.name }];
  });
}

export function repairBranchSelection(branches: DashboardBranch[], selected: string): string {
  if (selected === 'all' || branches.some(branch => branch.id === selected)) return selected;
  return branches[0]?.id ?? '';
}

export function isDashboardSelection(branches: DashboardBranch[], selected: string): boolean {
  return branches.length > 0 && (selected === 'all' || branches.some(branch => branch.id === selected));
}
