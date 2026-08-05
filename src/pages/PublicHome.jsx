import { Helmet } from "react-helmet-async";
import SeoMeta from "../hooks/useSeoMeta";
import { MarketingHome } from "./GameList";

const HOME_JSON_LD = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "LaxStats",
    "url": "https://laxstats.app",
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "LaxStats",
    "operatingSystem": "Web, iOS, Android",
    "applicationCategory": "SportsApplication",
    "description": "Digital scorebook and live stats platform for men's lacrosse.",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "url": "https://laxstats.app",
  },
]);

// The site's persistent home — marketing content plus the live/recent public
// games feed. Always renders the same public view regardless of auth state;
// signed-in users reach their personal games at /dashboard instead.
export default function PublicHome() {
  return (
    <>
      <SeoMeta
        title="Home"
        description="Score lacrosse games on your phone, share live stats with anyone, and get a full box score instantly. Free to start."
        url="https://laxstats.app"
      />
      <Helmet>
        <script type="application/ld+json">{HOME_JSON_LD}</script>
      </Helmet>
      <MarketingHome />
    </>
  );
}
