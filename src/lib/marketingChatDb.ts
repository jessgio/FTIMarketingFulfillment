import { supabase } from "./supabaseClient";
import { getSupabaseErrorMessage } from "./supabaseError";
import { mentionHandleFromEmail } from "./marketingMentions";
import { canFulfill, normalizeUserRole } from "./marketingRoles";
import type {
  MarketingChatNotification,
  MarketingChatParticipant,
  MarketingRequestMessage,
  MarketingSession,
} from "../types/marketing";

export async function fetchChatParticipants(): Promise<MarketingChatParticipant[]> {
  const { data, error } = await supabase
    .from("marketing_users")
    .select("email, display_name, role, division")
    .eq("active", true)
    .order("role")
    .order("display_name");

  if (error) throw new Error(getSupabaseErrorMessage(error, "Failed to load chat participants"));

  return (data ?? []).map((row) => ({
    email: row.email,
    display_name: row.display_name,
    role: normalizeUserRole(row.role),
    division: (row.division?.trim() || "Other") as MarketingChatParticipant["division"],
    handle: mentionHandleFromEmail(row.email),
  }));
}

export async function fetchRequestMessages(requestId: string): Promise<MarketingRequestMessage[]> {
  const { data, error } = await supabase
    .from("marketing_request_messages")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(getSupabaseErrorMessage(error, "Failed to load messages"));
  return data ?? [];
}

export async function postRequestMessage(
  session: MarketingSession,
  requestId: string,
  body: string
): Promise<MarketingRequestMessage> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");

  const { data, error } = await supabase
    .from("marketing_request_messages")
    .insert({
      request_id: requestId,
      author_email: session.email,
      author_name: session.displayName,
      author_role: session.role,
      body: trimmed,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Failed to send message"));
  }

  return data;
}

export async function markRequestChatRead(
  session: MarketingSession,
  requestId: string
): Promise<void> {
  const { error } = await supabase.from("marketing_request_chat_reads").upsert(
    {
      request_id: requestId,
      reader_email: session.email,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "request_id,reader_email" }
  );

  if (error) throw new Error(getSupabaseErrorMessage(error, "Failed to update read state"));
}

export async function fetchUnreadChatCounts(session: MarketingSession): Promise<{
  total: number;
  byRequestId: Record<string, number>;
}> {
  const { data: reads, error: readsError } = await supabase
    .from("marketing_request_chat_reads")
    .select("request_id, last_read_at")
    .eq("reader_email", session.email);

  if (readsError) throw new Error(getSupabaseErrorMessage(readsError, "Failed to load read state"));

  const readAt = new Map((reads ?? []).map((row) => [row.request_id, row.last_read_at]));

  let requestsQuery = supabase.from("marketing_requests").select("id");
  if (!canFulfill(session)) {
    requestsQuery = requestsQuery.eq("requested_by_email", session.email);
  }

  const { data: requests, error: requestsError } = await requestsQuery;
  if (requestsError) throw new Error(getSupabaseErrorMessage(requestsError, "Failed to load requests"));

  const requestIds = (requests ?? []).map((row) => row.id);
  if (requestIds.length === 0) return { total: 0, byRequestId: {} };

  const { data: messages, error: messagesError } = await supabase
    .from("marketing_request_messages")
    .select("request_id, author_email, created_at")
    .in("request_id", requestIds)
    .neq("author_email", session.email);

  if (messagesError) throw new Error(getSupabaseErrorMessage(messagesError, "Failed to load messages"));

  const byRequestId: Record<string, number> = {};
  let total = 0;

  for (const msg of messages ?? []) {
    const lastRead = readAt.get(msg.request_id);
    if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
      byRequestId[msg.request_id] = (byRequestId[msg.request_id] ?? 0) + 1;
      total += 1;
    }
  }

  return { total, byRequestId };
}

export async function fetchUnreadChatNotifications(
  session: MarketingSession
): Promise<MarketingChatNotification[]> {
  const { data: reads, error: readsError } = await supabase
    .from("marketing_request_chat_reads")
    .select("request_id, last_read_at")
    .eq("reader_email", session.email);

  if (readsError) throw new Error(getSupabaseErrorMessage(readsError, "Failed to load read state"));

  const readAt = new Map((reads ?? []).map((row) => [row.request_id, row.last_read_at]));

  let requestsQuery = supabase.from("marketing_requests").select("id, barcode, recipient_name");
  if (!canFulfill(session)) {
    requestsQuery = requestsQuery.eq("requested_by_email", session.email);
  }

  const { data: requests, error: requestsError } = await requestsQuery;
  if (requestsError) throw new Error(getSupabaseErrorMessage(requestsError, "Failed to load requests"));

  const requestMeta = new Map(
    (requests ?? []).map((row) => [
      row.id,
      { barcode: row.barcode, recipientName: row.recipient_name },
    ])
  );
  const requestIds = [...requestMeta.keys()];
  if (requestIds.length === 0) return [];

  const { data: messages, error: messagesError } = await supabase
    .from("marketing_request_messages")
    .select("id, request_id, author_name, body, created_at")
    .in("request_id", requestIds)
    .neq("author_email", session.email)
    .order("created_at", { ascending: false });

  if (messagesError) throw new Error(getSupabaseErrorMessage(messagesError, "Failed to load messages"));

  const notifications: MarketingChatNotification[] = [];

  for (const msg of messages ?? []) {
    const lastRead = readAt.get(msg.request_id);
    if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
      const meta = requestMeta.get(msg.request_id);
      if (!meta) continue;
      notifications.push({
        id: msg.id,
        requestId: msg.request_id,
        barcode: meta.barcode,
        recipientName: meta.recipientName,
        authorName: msg.author_name,
        body: msg.body,
        createdAt: msg.created_at,
      });
    }
  }

  return notifications;
}
