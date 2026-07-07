import { AppNav } from "laxstats";

// AppNav renders position:fixed; the transformed wrapper makes each cell its
// containing block so the bar sits inside the card. The global preview shell
// supplies router + auth context; per-story auth overrides come from remounting
// the shell isn't possible here, so stories rely on the shell's fixture coach.
const Bar = ({ children }: any) => (
  <div style={{ position: "relative", height: 52, transform: "translateZ(0)", overflow: "hidden", borderRadius: 8, border: "1px solid #eee" }}>
    {children}
  </div>
);

// Signed-in coach with an org — Home/Orgs/Pricing/Guide plus profile initial.
export const SignedIn = () => (
  <Bar>
    <AppNav />
  </Bar>
);
