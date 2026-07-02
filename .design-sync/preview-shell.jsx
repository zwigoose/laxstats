// Context shell for rendering app-coupled LaxStats views outside the app.
//
// Wraps children in a MemoryRouter (satisfies useNavigate/useLocation/Link)
// and an AuthContext.Provider carrying a fixture signed-in coach with one org
// membership — the same value shape AuthProvider builds from profiles +
// org_members. Pass `auth` to override any field (e.g. { user: null } for
// signed-out states, { isAdmin: true } for admin views). Exported on
// window.LaxStats so designs composed in Claude Design can use it to host
// navigation-dependent components like AppNav.
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../src/contexts/AuthContext";

const FIXTURE_USER = {
  id: "user-fixture-1",
  email: "coach@ndprep.org",
};

const FIXTURE_MEMBERSHIPS = [
  {
    org_id: "org-ndp",
    role: "org_admin",
    created_at: "2025-09-01T12:00:00Z",
    organizations: { id: "org-ndp", name: "Notre Dame Prep", slug: "notre-dame-prep", plan: "pro", plan_status: "active" },
  },
];

export default function DesignPreviewShell({ children, auth = {}, initialPath = "/" }) {
  const value = {
    session: { user: FIXTURE_USER },
    user: FIXTURE_USER,
    profile: { is_admin: true, personal_plan: "pro", personal_plan_status: "active", display_name: "Coach Ferrari" },
    isAdmin: true,
    isPlatformAdmin: true,
    orgMemberships: FIXTURE_MEMBERSHIPS,
    getOrgRole: (orgId) => (orgId === "org-ndp" ? "org_admin" : null),
    refreshProfile: async () => {},
    loading: false,
    ...auth,
  };
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </MemoryRouter>
  );
}
