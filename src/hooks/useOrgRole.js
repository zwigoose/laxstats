import { useAuth } from "../contexts/AuthContext";

/**
 * Returns the current user's role in the given org, or null if not a member.
 * Also exposes isPlatformAdmin for convenience.
 *
 * Usage:
 *   const { role, isPlatformAdmin, canScore, canManage } = useOrgRole(orgId);
 */
export function useOrgRole(orgId) {
  const { getOrgRole, isPlatformAdmin } = useAuth();
  const role = orgId ? getOrgRole(orgId) : null;

  // Role hierarchy: org_admin > coach > scorekeeper > viewer
  const ROLE_RANK = { org_admin: 4, coach: 3, scorekeeper: 2, viewer: 1 };
  const rank = isPlatformAdmin ? 99 : (ROLE_RANK[role] ?? 0);

  return {
    role,                          // raw role string or null
    isPlatformAdmin,
    isOrgAdmin:   rank >= 4,
    isCoach:      rank >= 3,
    canScore:     rank >= 2,       // scorekeeper+
    canView:      rank >= 1,       // viewer+
  };
}
