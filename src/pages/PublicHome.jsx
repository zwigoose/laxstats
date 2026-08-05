import { Helmet } from "react-helmet-async";
import SeoMeta from "../hooks/useSeoMeta";
import { MarketingHome } from "./GameList";

const JSON_LD = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "LaxStats",
    "url": "https://laxstats.app",
  },
]);

// The persistent public homepage — marketing content plus the live/recent
// public games feed. Unlike "/", which shows a signed-in user's personal
// dashboard, this route always renders the same public view regardless of
// auth state, giving signed-in users a way back to it.
export default function PublicHome() {
  return (
    <>
      <SeoMeta
        title="Public games"
        description="Follow live and recent public lacrosse games on LaxStats — the digital scorebook for men's lacrosse."
        url="https://laxstats.app/home"
      />
      <Helmet>
        <script type="application/ld+json">{JSON_LD}</script>
      </Helmet>
      <MarketingHome />
    </>
  );
}
