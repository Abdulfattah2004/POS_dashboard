import { resolveDashboardBranches } from './branchPolicy.ts';
import type { DashboardBranch } from './branchPolicy.ts';
import { readScopedSnapshot } from './financial.ts';

type SnapshotRequest = Parameters<typeof readScopedSnapshot>[0];

export async function readDashboardSnapshot(
  readBranches: (businessId: string) => Promise<DashboardBranch[]>,
  request: SnapshotRequest,
  businessId: string,
  selectedBranch = 'all',
) {
  const branches = resolveDashboardBranches(await readBranches(businessId), businessId);
  return readScopedSnapshot(request, businessId, branches.map(branch => branch.id), selectedBranch);
}
