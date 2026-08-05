import SeoMeta from "../hooks/useSeoMeta";
import { useAuth } from "../contexts/AuthContext";
import { usePersonalGameUsage } from "../hooks/usePersonalGameUsage";
import { SignedInHome } from "./GameList";

// The signed-in personal dashboard, at /dashboard. Gated by PrivateRoute in
// App.jsx, so `user` is guaranteed to be set by the time this renders.
export default function Dashboard() {
  const { user, orgMemberships } = useAuth();
  const personalUsage = usePersonalGameUsage(user);

  return (
    <>
      <SeoMeta
        title="Dashboard"
        description="Your season at a glance — live games, upcoming games, and completed box scores."
        url="https://laxstats.app/dashboard"
      />
      <SignedInHome user={user} orgMemberships={orgMemberships} usage={personalUsage} />
    </>
  );
}
