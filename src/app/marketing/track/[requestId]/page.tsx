import { MarketingTrackPageContent } from "./MarketingTrackPageContent";

export default async function MarketingTrackPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <MarketingTrackPageContent requestId={requestId} />;
}
