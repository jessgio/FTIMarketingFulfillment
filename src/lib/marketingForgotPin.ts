export async function requestPinReminder(email: string): Promise<string> {
  const response = await fetch("/api/marketing/forgot-pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
  });

  const payload = (await response.json()) as { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not send PIN email");
  }

  return payload.message ?? "If that email is registered, your PIN has been sent.";
}
