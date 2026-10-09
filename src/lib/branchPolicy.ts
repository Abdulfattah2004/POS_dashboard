export const DASHBOARD_BRANCH_NAMES = ['Palma', 'Manar', 'Haykaliye'] as const;

export interface DashboardBranch {
  id: string;
  name: string;
  business_id: string;
}

// Resolve names only within the authenticated business catalog. All subsequent
// reads use the returned Supabase IDs, never a caller-supplied branch allowlist.
export function resolveDashboardBranches<T extends DashboardBranch>(rows: T[], businessId: string): T[] {
  if (!businessId || rows.some(row => row.business_id !== businessId)) {
    throw new Error('Dashboard branch business scope mismatch');
  }
  const branches = DASHBOARD_BRANCH_NAMES.map(name => {
    const matches = rows.filter(row => row.name === name);
    if (matches.length !== 1 || typeof matches[0].id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matches[0].id)) {
      throw new Error('Dashboard requires one uniquely identified branch for each configured name in this business.');
    }
    return matches[0];
  });
  if (new Set(branches.map(branch => branch.id)).size !== branches.length) {
    throw new Error('Dashboard branch IDs must be distinct');
  }
  return branches;
}

export function repairBranchSelection(branches: DashboardBranch[], selected: string): string {
  if (selected === 'all' || branches.some(branch => branch.id === selected)) return selected;
  return branches[0]?.id ?? '';
}

export function isDashboardSelection(branches: DashboardBranch[], selected: string): boolean {
  return branches.length > 0 && (selected === 'all' || branches.some(branch => branch.id === selected));
}
