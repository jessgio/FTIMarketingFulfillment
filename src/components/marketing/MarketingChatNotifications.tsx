"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Loader2, MessageSquare } from "lucide-react";
import { cx } from "../dashboard/primitives";
import { fetchUnreadChatNotifications } from "../../lib/marketingChatDb";
import type { MarketingChatNotification, MarketingSession } from "../../types/marketing";

function formatWhen(value: string): string {
  const date = new Date(value);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncateBody(body: string, max = 120): string {
  const singleLine = body.replace(/\s+/g, " ").trim();
  if (singleLine.length <= max) return singleLine;
  return `${singleLine.slice(0, max - 1)}…`;
}

export function MarketingChatNotifications({
  session,
  totalUnread,
  onRefresh,
  onOpenRequest,
  className,
}: {
  session: MarketingSession | null;
  totalUnread: number;
  onRefresh: () => void;
  onOpenRequest: (requestId: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<MarketingChatNotification[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!session) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const items = await fetchUnreadChatNotifications(session);
      setNotifications(items);
    } catch {
      /* keep last list on transient errors */
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
  }, [open, loadNotifications, totalUnread]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!session) return null;

  const handleSelect = (requestId: string) => {
    setOpen(false);
    onOpenRequest(requestId);
    onRefresh();
  };

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cx(
          "relative inline-flex items-center justify-center rounded-lg p-2 transition",
          "text-violet-700 hover:bg-violet-50 hover:text-violet-900",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
          open && "bg-violet-50"
        )}
        aria-label={
          totalUnread > 0
            ? `${totalUnread} unread discussion message${totalUnread === 1 ? "" : "s"}`
            : "Discussion notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="w-5 h-5" />
        {totalUnread > 0 ? (
          <>
            <span
              className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white animate-blink-dot"
              aria-hidden="true"
            />
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center leading-none">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          </>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Unread discussion messages"
          className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-black text-gray-900">Notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalUnread > 0
                ? `${totalUnread} unread message${totalUnread === 1 ? "" : "s"}`
                : "You're all caught up"}
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No unread messages</p>
                <p className="text-xs text-gray-400 mt-1">
                  Mentions and replies appear here when someone messages you.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.requestId)}
                      className="w-full text-left px-4 py-3 hover:bg-violet-50 transition focus:outline-none focus-visible:bg-violet-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {item.authorName}
                        </p>
                        <span className="text-[10px] text-gray-400 shrink-0 pt-0.5">
                          {formatWhen(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {item.recipientName} · {item.barcode}
                      </p>
                      <p className="text-sm text-gray-700 mt-1.5 line-clamp-2">
                        {truncateBody(item.body)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
