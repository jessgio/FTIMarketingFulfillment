export async function notifyNewMarketingRequest(requestId: string): Promise<void> {
  await fetch("/api/marketing-request/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
}
