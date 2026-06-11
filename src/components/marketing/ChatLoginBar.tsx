"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DashButton, SurfaceCard, fieldInput } from "../dashboard/primitives";
import { clearMarketingSession, setMarketingSession } from "../../lib/marketingAuth";
import { loginMarketingUser } from "../../lib/marketingDb";
import { roleLabel } from "../../lib/marketingRoles";
import type { MarketingSession } from "../../types/marketing";

export function ChatLoginBar({
  session,
  onSessionChange,
}: {
  session: MarketingSession | null;
  onSessionChange: (session: MarketingSession | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const s = await loginMarketingUser(email, pin);
      setMarketingSession(s);
      onSessionChange(s);
      setPin("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearMarketingSession();
    onSessionChange(null);
  };

  if (session) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold text-gray-900">{session.displayName}</span>
        <span className="text-xs font-bold uppercase text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
          {session.division}
        </span>
        <span className="text-xs font-bold uppercase text-gray-600">({roleLabel(session.role)})</span>
        <DashButton variant="ghost" size="sm" onClick={handleLogout}>
          Log out
        </DashButton>
      </div>
    );
  }

  return (
    <SurfaceCard className="p-4 mb-6">
      <p className="text-xs font-bold uppercase text-gray-700 mb-2">Sign in for chat &amp; registry edits</p>
      <p className="text-xs text-gray-600 mb-3">
        Fulfillment and admin accounts use fulfillment@fromthisisland.com · Requesters use your team email.
      </p>
      <form onSubmit={handleLogin} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldInput}
            placeholder="you@fromthisisland.com"
          />
        </div>
        <div className="w-24">
          <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">PIN</label>
          <input
            type="password"
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className={fieldInput}
          />
        </div>
        <DashButton type="submit" variant="primary" size="md" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
        </DashButton>
      </form>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </SurfaceCard>
  );
}
