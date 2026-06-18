"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { requestPinReminder } from "../../lib/marketingForgotPin";

export function ForgotPinLink({
  email,
  className = "text-xs",
}: {
  email: string;
  className?: string;
}) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleClick = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email first.");
      setMessage("");
      return;
    }

    setSending(true);
    setError("");
    setMessage("");
    try {
      const result = await requestPinReminder(trimmed);
      setMessage(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send PIN email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={sending}
        className="text-violet-700 hover:text-violet-900 font-semibold underline underline-offset-2 disabled:opacity-50"
      >
        {sending ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Sending…
          </span>
        ) : (
          "Forgot PIN? Email it to me"
        )}
      </button>
      {message && <p className="text-green-700 font-medium mt-1">{message}</p>}
      {error && <p className="text-red-600 font-medium mt-1">{error}</p>}
    </div>
  );
}
