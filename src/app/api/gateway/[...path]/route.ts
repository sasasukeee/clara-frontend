const DEFAULT_UPSTREAM_BASE_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 30_000;

const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const requestHeaderAllowlist = new Set([
  "accept",
  "accept-language",
  "authorization",
  "content-type",
  "cookie",
  "user-agent",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-csrf-token",
  "x-request-id",
]);

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const getTimeoutMs = () => {
  const raw = process.env.GATEWAY_PROXY_TIMEOUT_MS?.trim();
  const value = raw ? Number(raw) : DEFAULT_TIMEOUT_MS;
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
};

const createRequestId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

const getGatewayBaseUrl = () =>
  process.env.GATEWAY_BASE_URL?.trim() || DEFAULT_UPSTREAM_BASE_URL;

const isSafePathPart = (part: string) => {
  const trimmed = part.trim();
  if (!trimmed) return false;
  if (trimmed.includes(":")) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.includes("\\")) return false;
  return true;
};

const stripHopByHopHeaders = (headers: Headers) => {
  const next = new Headers(headers);
  for (const header of hopByHopHeaders) next.delete(header);
  return next;
};

const buildUpstreamUrl = (requestUrl: string, pathParts: string[]) => {
  const incoming = new URL(requestUrl);
  const upstreamBase = getGatewayBaseUrl();
  const upstreamBaseUrl = new URL(
    upstreamBase.endsWith("/") ? upstreamBase : `${upstreamBase}/`
  );
  if (!["http:", "https:"].includes(upstreamBaseUrl.protocol)) {
    throw new Error("Invalid gateway base URL protocol.");
  }

  const safePathParts = pathParts.filter(isSafePathPart).map(encodeURIComponent);
  const upstream = new URL(safePathParts.join("/"), upstreamBaseUrl);
  upstream.search = incoming.search;
  return upstream;
};

const buildUpstreamHeaders = (request: Request, requestId: string) => {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host")?.trim() || requestUrl.host;
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.trim() || requestUrl.protocol.replace(":", "");
  const forwardedPort =
    request.headers.get("x-forwarded-port")?.trim() ||
    (host.includes(":") ? host.split(":").pop() : forwardedProto === "https" ? "443" : "80");
  const forwardedFor =
    request.headers.get("x-forwarded-for")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "127.0.0.1";

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (hopByHopHeaders.has(lower)) continue;
    if (!requestHeaderAllowlist.has(lower)) continue;
    headers.set(key, value);
  }
  headers.set("x-request-id", requestId);
  headers.set("x-forwarded-host", host);
  headers.set("x-forwarded-proto", forwardedProto);
  headers.set("x-forwarded-port", forwardedPort ?? "");
  headers.set("x-forwarded-for", forwardedFor);
  return headers;
};

const isGoogleAuthorizeUrl = (url: URL) => {
  const host = url.host.toLowerCase();
  if (host !== "accounts.google.com") return false;
  return url.pathname.startsWith("/o/oauth2/");
};

const getAppOrigin = (fallbackOrigin: string) =>
  process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() || fallbackOrigin;

const rewriteRedirectUriOrigin = (redirectUri: string, origin: string) => {
  try {
    const redirectUrl = new URL(redirectUri);
    const originUrl = new URL(getAppOrigin(origin));
    redirectUrl.protocol = originUrl.protocol;
    redirectUrl.host = originUrl.host;
    return redirectUrl.toString();
  } catch {
    return redirectUri;
  }
};

const ensureIdTokenResponse = (url: URL, nonce: string) => {
  const responseType = url.searchParams.get("response_type")?.trim();
  if (!responseType) {
    url.searchParams.set("response_type", "code id_token");
  } else if (!responseType.split(/\s+/).includes("id_token")) {
    url.searchParams.set("response_type", `${responseType} id_token`.trim());
  }

  const responseMode = url.searchParams.get("response_mode")?.trim();
  if (!responseMode) url.searchParams.set("response_mode", "fragment");

  const scope = url.searchParams.get("scope") ?? "";
  if (!scope.split(/\s+/).includes("openid")) {
    url.searchParams.set("scope", `openid ${scope}`.trim());
  }

  if (!url.searchParams.get("nonce")) url.searchParams.set("nonce", nonce);
};

const rewriteGoogleAuthorizeLocation = (location: string, requestOrigin: string, nonce: string) => {
  try {
    const url = new URL(location);
    if (!isGoogleAuthorizeUrl(url)) return location;

    const redirectUri = url.searchParams.get("redirect_uri");
    if (redirectUri) {
      url.searchParams.set("redirect_uri", rewriteRedirectUriOrigin(redirectUri, requestOrigin));
    }

    ensureIdTokenResponse(url, nonce);
    return url.toString();
  } catch {
    return location;
  }
};

const rewriteAuthUiRedirectLocation = (location: string, requestOrigin: string) => {
  try {
    const incomingOrigin = new URL(getAppOrigin(requestOrigin)).origin;

    if (location.startsWith("/")) {
      const url = new URL(location, incomingOrigin);
      if (
        url.pathname === "/auth/success" ||
        url.pathname === "/auth/error" ||
        url.pathname === "/auth/access"
      ) {
        return url.toString();
      }
      return location;
    }

    const url = new URL(location);
    if (
      url.pathname !== "/auth/success" &&
      url.pathname !== "/auth/error" &&
      url.pathname !== "/auth/access"
    ) {
      return location;
    }

    url.protocol = new URL(incomingOrigin).protocol;
    url.host = new URL(incomingOrigin).host;
    return url.toString();
  } catch {
    return location;
  }
};

async function proxy(request: Request, pathParts: string[]) {
  const method = request.method.toUpperCase();
  if (!allowedMethods.has(method)) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: Array.from(allowedMethods).join(", ") },
    });
  }

  if (pathParts.length > 0 && pathParts[0] === "auth" && pathParts[1] === "refresh") {
    if (method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "POST" },
      });
    }
  }

  const requestId = request.headers.get("x-request-id")?.trim() || createRequestId();
  const upstreamUrl = buildUpstreamUrl(request.url, pathParts);
  const headers = buildUpstreamHeaders(request, requestId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  const hasBody = method !== "GET";
  const init: (RequestInit & { duplex?: "half" }) = {
    method,
    headers,
    redirect: "manual",
    signal: controller.signal,
  };
  if (hasBody && request.body) {
    init.body = request.body as unknown as BodyInit;
    init.duplex = "half";
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, init);

    if (process.env.NODE_ENV !== "production") {
      const upstreamRequestId = upstreamResponse.headers.get("x-request-id");
      console.info("[gateway-proxy]", {
        requestId,
        method,
        path: `/${pathParts.join("/")}`,
        upstream: upstreamUrl.toString(),
        status: upstreamResponse.status,
        upstreamRequestId,
        contentType: upstreamResponse.headers.get("content-type"),
      });
    }

    const responseHeaders = stripHopByHopHeaders(upstreamResponse.headers);
    responseHeaders.set("x-request-id", requestId);

    const location = upstreamResponse.headers.get("location");
    if (location && upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      const incomingOrigin = new URL(request.url).origin;
      const rewrittenAuthUi = rewriteAuthUiRedirectLocation(location, incomingOrigin);
      if (rewrittenAuthUi !== location) {
        responseHeaders.set("location", rewrittenAuthUi);
      } else {
        responseHeaders.set(
          "location",
          rewriteGoogleAuthorizeLocation(location, incomingOrigin, requestId)
        );
      }
    }

    const setCookies =
      typeof (upstreamResponse.headers as unknown as { getSetCookie?: () => string[] })
        .getSetCookie === "function"
        ? (upstreamResponse.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : [];
    for (const setCookie of setCookies) responseHeaders.append("set-cookie", setCookie);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === "AbortError";
    const status = isAbortError ? 504 : 502;
    return new Response(isAbortError ? "Gateway Timeout" : "Bad Gateway", {
      status,
      headers: { "x-request-id": requestId },
    });
  } finally {
    clearTimeout(timeout);
  }
}

type Params = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Params) {
  const { path } = await params;
  return proxy(request, path);
}

export async function POST(request: Request, { params }: Params) {
  const { path } = await params;
  return proxy(request, path);
}

export async function DELETE(request: Request, { params }: Params) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PUT(request: Request, { params }: Params) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PATCH(request: Request, { params }: Params) {
  const { path } = await params;
  return proxy(request, path);
}
