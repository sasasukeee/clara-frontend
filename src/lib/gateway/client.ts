import { AppError, httpStatusToAppErrorCode, type AppErrorCode } from "../errors/AppError";

export type GatewayClientOptions = {
  baseUrl?: string;
};

export class GatewayError extends AppError {
  body: unknown;
  status: number;
  requestId?: string;

  constructor(params: {
    message: string;
    status: number;
    body: unknown;
    requestId?: string;
    code?: AppErrorCode;
    cause?: unknown;
  }) {
    super({
      code: params.code ?? httpStatusToAppErrorCode(params.status),
      message: params.message,
      status: params.status || undefined,
      requestId: params.requestId,
      details: params.body,
      cause: params.cause,
    });
    this.name = "GatewayError";
    this.status = params.status;
    this.body = params.body;
    this.requestId = params.requestId;
  }
}

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_GATEWAY_BASE_URL?.trim() || "/api/gateway";

const joinUrlPath = (base: string, path: string) => {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

const buildRequestUrl = (baseUrl: string, path: string) => {
  if (baseUrl.startsWith("/")) return joinUrlPath(baseUrl, path);
  return new URL(path, baseUrl).toString();
};

const isJsonResponse = (contentType: string | null) =>
  Boolean(contentType && contentType.includes("application/json"));

const readResponseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type");
  if (isJsonResponse(contentType)) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
};

const inferErrorMessage = (
  status: number,
  body: unknown,
  context: { path: string; method: string }
) => {
  if (typeof body === "string" && body.trim().length > 0) return body;
  if (body && typeof body === "object") {
    const maybeMessage = (body as { message?: unknown; error?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
    const maybeError = (body as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.trim().length > 0) {
      return maybeError;
    }
  }
  if (status === 401) {
    if (context.method === "POST" && context.path === "/auth/login") {
      return "Kullanıcı adı/e-posta veya parola hatalı.";
    }
    return "Oturum süreniz doldu. Lütfen tekrar giriş yapın.";
  }
  return "Bir hata oluştu. Lütfen tekrar deneyin.";
};

const DEFAULT_TIMEOUT_MS = 30_000;

const refreshInFlight = new Map<string, Promise<boolean>>();

const createRequestId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

const shouldRetryOnUnauthorizedByDefault = (path: string) =>
  path !== "/auth/login" && path !== "/auth/refresh";

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

let onAuthInvalidated: (() => void) | undefined;

export const setAuthInvalidationHandler = (handler?: () => void) => {
  onAuthInvalidated = handler;
};

export type GatewaySchema<T> = {
  safeParse: (
    data: unknown
  ) =>
    | { success: true; data: T }
    | { success: false; error: unknown };
};

type RequestJsonOptions<T> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string | undefined>;
  body?: unknown;
  retryOnUnauthorized?: boolean;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
  schema?: GatewaySchema<T>;
};

export async function gatewayRequestJson<T>(
  path: string,
  options: RequestJsonOptions<T> = {}
): Promise<T> {
  const baseUrl = options.baseUrl?.trim() || getBaseUrl();
  const url = buildRequestUrl(baseUrl, path);

  const method = options.method ?? "GET";
  const requestId = options.requestId?.trim() || createRequestId();
  const headers: Record<string, string> = { "x-request-id": requestId };
  for (const [key, value] of Object.entries(options.headers ?? {})) {
    if (value !== undefined) headers[key] = value;
  }
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (hasBody && !headers["x-csrf-token"]) {
    const csrf = getCookieValue("csrf_token") ?? getCookieValue("XSRF-TOKEN");
    if (csrf) headers["x-csrf-token"] = csrf;
  }

  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS;

  const doFetch = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method,
        credentials: "include",
        headers,
        body: hasBody ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const refreshSessionSingleFlight = async () => {
    const key = baseUrl;
    const existing = refreshInFlight.get(key);
    if (existing) return await existing;

    const promise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const refreshResponse = await fetch(buildRequestUrl(baseUrl, "/auth/refresh"), {
          method: "POST",
          credentials: "include",
          headers: { "x-request-id": requestId },
          signal: controller.signal,
        });
        return refreshResponse.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timeout);
      }
    })();

    refreshInFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      refreshInFlight.delete(key);
    }
  };

  let response: Response;
  try {
    response = await doFetch();
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === "AbortError";
    throw new GatewayError({
      code: isAbortError ? "TIMEOUT" : "NETWORK",
      message: isAbortError
        ? "İstek zaman aşımına uğradı. Lütfen tekrar deneyin."
        : "Ağ hatası oluştu. Lütfen tekrar deneyin.",
      status: 0,
      body: null,
      requestId,
      cause: error,
    });
  }

  const allowUnauthorizedRetry =
    options.retryOnUnauthorized ?? shouldRetryOnUnauthorizedByDefault(path);
  if (allowUnauthorizedRetry && response.status === 401) {
    const refreshed = await refreshSessionSingleFlight();
    if (refreshed) {
      response = await doFetch();
      if (response.status === 401) onAuthInvalidated?.();
    } else {
      onAuthInvalidated?.();
    }
  }

  if (!response.ok) {
    const body = await readResponseBody(response);
    const responseRequestId =
      response.headers.get("x-request-id")?.trim() || requestId;
    throw new GatewayError({
      message: inferErrorMessage(response.status, body, { path, method }),
      status: response.status,
      body,
      requestId: responseRequestId,
    });
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type");
  if (!isJsonResponse(contentType)) {
    if (options.schema) {
      throw new GatewayError({
        code: "INVALID_RESPONSE",
        message: "Beklenmeyen sunucu yanıtı. Lütfen tekrar deneyin.",
        status: 0,
        body: { reason: "Expected JSON response." },
        requestId,
      });
    }
    return (await response.text()) as T;
  }

  let data: unknown;
  const raw = await response.text();
  if (raw.trim().length === 0) {
    data = null;
  } else {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      throw new GatewayError({
        code: "INVALID_RESPONSE",
        message: "Beklenmeyen sunucu yanıtı. Lütfen tekrar deneyin.",
        status: 0,
        body: { reason: "Invalid JSON response.", raw: raw.slice(0, 500) },
        requestId,
      });
    }
  }

  if (!options.schema) return data as T;

  const parsed = options.schema.safeParse(data);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
      console.warn("[gateway-client] schema validation failed", {
        requestId,
        method,
        path,
        error: parsed.error,
      });
    }
    throw new GatewayError({
      code: "INVALID_RESPONSE",
      message: "Beklenmeyen sunucu yanıtı. Lütfen tekrar deneyin.",
      status: 0,
      body: { reason: "Schema validation failed.", error: parsed.error },
      requestId,
    });
  }
  return parsed.data;
}
