import { GatewayError, gatewayRequestJson } from "@/lib/gateway/client";
import {
  ChatConversationSchema,
  ChatMessageSchema,
  IdentitySettingsSchema,
  IdentityUserSchema,
  UpdateIdentitySettingsSchema,
  UserProfileSchema,
  type ChatConversationDto,
  type ChatMessageDto,
  type IdentitySettingsDto,
  type IdentityUserDto,
  type UpdateIdentitySettingsDto,
  type UpdateProfileDto,
  type UserProfileDto,
} from "@/lib/gateway/dtos";

import { updateUserProfile } from "@/features/profile/api";

export async function getIdentityMe() {
  return await gatewayRequestJson<IdentityUserDto>("/accounts/identity/me", {
    schema: IdentityUserSchema,
  });
}

export async function getIdentityProfile(userId: string) {
  return await gatewayRequestJson<UserProfileDto>(`/accounts/identity/profile/${userId}`, {
    schema: UserProfileSchema,
  });
}

export async function getIdentitySettings(userId: string) {
  return await gatewayRequestJson<IdentitySettingsDto>(`/accounts/identity/settings/${userId}`, {
    schema: IdentitySettingsSchema,
  });
}

export async function updateIdentityProfile(userId: string, payload: UpdateProfileDto) {
  return await updateUserProfile(userId, payload);
}

export async function updateIdentitySettings(userId: string, payload: UpdateIdentitySettingsDto) {
  const body = UpdateIdentitySettingsSchema.parse(payload);
  return await gatewayRequestJson<IdentitySettingsDto>(`/accounts/identity/settings/${userId}`, {
    method: "PATCH",
    body,
    schema: IdentitySettingsSchema,
  });
}

// ----------------- CHAT -----------------
export async function listChatConversations() {
  return await gatewayRequestJson<ChatConversationDto[]>("/chat/conversations", {
    schema: ChatConversationSchema.array(),
  });
}

export async function createChatConversation(payload: { title?: string }) {
  return await gatewayRequestJson<ChatConversationDto>("/chat/conversations", {
    method: "POST",
    body: payload,
    schema: ChatConversationSchema,
  });
}

export async function listChatMessages(conversationId: string, params?: { take?: number; cursor?: string }) {
  const search = new URLSearchParams();
  if (params?.take) search.set("take", String(params.take));
  if (params?.cursor) search.set("cursor", params.cursor);
  const query = search.toString();
  const path = query
    ? `/chat/conversations/${conversationId}/messages?${query}`
    : `/chat/conversations/${conversationId}/messages`;

  return await gatewayRequestJson<ChatMessageDto[]>(path, {
    schema: ChatMessageSchema.array(),
  });
}

export async function appendChatMessage(conversationId: string, payload: { content: string; role?: "user" | "system" }) {
  return await gatewayRequestJson<ChatMessageDto>(`/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: payload,
    schema: ChatMessageSchema,
  });
}

const getCookieValue = (cookieName: string) => {
  if (typeof document === "undefined") return undefined;
  const cookie = document.cookie;
  if (!cookie) return undefined;
  const parts = cookie.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${cookieName}=`)) continue;
    return decodeURIComponent(part.slice(cookieName.length + 1));
  }
  return undefined;
};

const buildGatewayUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_GATEWAY_BASE_URL?.trim() || "/api/gateway";
  if (base.startsWith("/")) {
    const normalizedBase = base.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  }
  return new URL(path, base).toString();
};

const REFRESH_TIMEOUT_MS = 15_000;

const refreshSession = async (requestId: string): Promise<boolean> => {
  const url = buildGatewayUrl("/auth/refresh");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "x-request-id": requestId },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

export async function appendChatMessageWithAttachment(
  conversationId: string,
  payload: { file: File; content?: string; role?: "user" | "system" },
): Promise<ChatMessageDto | ChatMessageDto[]> {
  const form = new FormData();
  form.append("file", payload.file, payload.file.name);
  if (payload.content) form.append("content", payload.content);
  if (payload.role) form.append("role", payload.role);

  const url = buildGatewayUrl(`/chat/conversations/${conversationId}/messages/attachments`);
  const headers: Record<string, string> = { "x-request-id": crypto.randomUUID() };
  const csrf = getCookieValue("csrf_token") ?? getCookieValue("XSRF-TOKEN");
  if (csrf) headers["x-csrf-token"] = csrf;

  const sendOnce = async () =>
    await fetch(url, {
      method: "POST",
      body: form,
      credentials: "include",
      headers,
    });

  let response = await sendOnce();
  if (response.status === 401) {
    const refreshed = await refreshSession(headers["x-request-id"]);
    if (refreshed) {
      response = await sendOnce();
    }
  }

  const contentType = response.headers.get("content-type");
  const body = contentType?.includes("application/json") ? await response.json().catch(() => null) : await response.text().catch(() => null);
  const responseRequestId = response.headers.get("x-request-id")?.trim();

  if (!response.ok) {
    const bodyAsObject = body && typeof body === "object" ? (body as { message?: unknown }) : null;
    const message =
      (bodyAsObject && typeof bodyAsObject.message === "string"
        ? bodyAsObject.message
        : typeof body === "string" && body.trim()
          ? body
          : "Failed to upload file. Please try again.");
    throw new GatewayError({
      message,
      status: response.status,
      body,
      requestId: responseRequestId,
    });
  }

  const parsedSingle = ChatMessageSchema.safeParse(body);
  if (parsedSingle.success) {
    return parsedSingle.data;
  }
  const parsedArray = ChatMessageSchema.array().safeParse(body);
  if (!parsedArray.success) {
    throw new GatewayError({
      message: "Invalid response received",
      status: 500,
      body,
      requestId: responseRequestId,
    });
  }

  return parsedArray.data;
}
