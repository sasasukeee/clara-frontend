import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { gatewayRequestJson } from "./client";

const jsonResponse = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...(headers ?? {}) },
  });

describe("gatewayRequestJson", () => {
  it("uses single-flight refresh when multiple GETs get 401", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    let fooCalls = 0;

    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? "GET").toUpperCase();
      calls.push({ url, method });

      if (url.endsWith("/auth/refresh")) return new Response(null, { status: 200 });

      if (url.endsWith("/foo")) {
        fooCalls += 1;
        if (fooCalls <= 2) return jsonResponse({ message: "unauthorized" }, 401);
        return jsonResponse({ ok: true }, 200);
      }

      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const [a, b] = await Promise.all([
      gatewayRequestJson<{ ok: boolean }>("/foo", {
        method: "GET",
        baseUrl: "http://example.com",
      }),
      gatewayRequestJson<{ ok: boolean }>("/foo", {
        method: "GET",
        baseUrl: "http://example.com",
      }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const refreshCalls = calls.filter((call) => call.url.endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("does not refresh/retry when retryOnUnauthorized is false", async () => {
    const calls: Array<{ url: string; method: string }> = [];

    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? "GET").toUpperCase();
      calls.push({ url, method });

      if (url.endsWith("/auth/refresh")) return new Response(null, { status: 500 });
      if (url.endsWith("/foo")) return jsonResponse({ message: "unauthorized" }, 401);

      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    await expect(
      gatewayRequestJson("/foo", {
        method: "POST",
        baseUrl: "http://example.com",
        body: { a: 1 },
        retryOnUnauthorized: false,
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(calls.some((call) => call.url.endsWith("/auth/refresh"))).toBe(false);
  });

  it("refreshes and retries non-GET requests by default", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    let fooCalls = 0;

    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? "GET").toUpperCase();
      calls.push({ url, method });

      if (url.endsWith("/auth/refresh")) return new Response(null, { status: 200 });

      if (url.endsWith("/foo")) {
        fooCalls += 1;
        if (fooCalls === 1) return jsonResponse({ message: "unauthorized" }, 401);
        return jsonResponse({ ok: true }, 200);
      }

      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const result = await gatewayRequestJson<{ ok: boolean }>("/foo", {
      method: "PATCH",
      baseUrl: "http://example.com",
      body: { a: 1 },
    });

    expect(result.ok).toBe(true);
    expect(calls.filter((call) => call.url.endsWith("/auth/refresh"))).toHaveLength(1);
    expect(calls.filter((call) => call.url.endsWith("/foo"))).toHaveLength(2);
  });

  it("validates JSON responses when a schema is provided", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/foo")) return jsonResponse({ success: "yes" }, 200);
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const schema = z.object({ success: z.boolean() });

    await expect(
      gatewayRequestJson("/foo", {
        method: "GET",
        baseUrl: "http://example.com",
        schema,
      })
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
