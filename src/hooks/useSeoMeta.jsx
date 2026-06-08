import { Helmet } from 'react-helmet-async';

const BASE = import.meta.env.VITE_APP_TITLE || 'LaxStats';
const BASE_URL = 'https://laxstats.com';
const OG_IMAGE = `${BASE_URL}/LaxStatsOG.png`;
const DEFAULT_DESC =
  'Digital scorebook and live stats platform for men\'s lacrosse. ' +
  'Score games on your phone, share live with anyone, and get full box scores instantly.';

export default function SeoMeta({ title, description, url }) {
  const fullTitle = title ? `${title} · ${BASE}` : BASE;
  const desc = description || DEFAULT_DESC;
  const canonical = url || BASE_URL;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
    </Helmet>
  );
}
