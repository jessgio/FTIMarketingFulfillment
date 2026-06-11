export function getAppOrigin(fallbackOrigin?: string) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    fallbackOrigin?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}
