import { gatewayRequestJson, setAuthInvalidationHandler } from "@/lib/gateway/client";
import {
  AuthSuccessResponseSchema,
  type AuthLoginDto,
  type AuthSuccessResponseDto,
  GoogleCallbackSchema,
  GoogleOAuthCallbackResponseSchema,
  type GoogleOAuthCallbackResponseDto,
} from "@/lib/gateway/dtos/auth";
import {
  IdentityUserSchema,
  type IdentityRegisterDto,
  type IdentityUserDto,
} from "@/lib/gateway/dtos/identity";
import { authStore } from "@/stores/auth.store";

setAuthInvalidationHandler(() => authStore.setUnauthenticated());

export type LoginPayload = {
  identifier: string;
  password: string;
};

export type SignupPayload = {
  email: string;
  username: string;
  password: string;
};

async function authLogin(body: AuthLoginDto) {
  return await gatewayRequestJson<AuthSuccessResponseDto>("/auth/login", {
    method: "POST",
    body,
    retryOnUnauthorized: false,
    schema: AuthSuccessResponseSchema,
  });
}

async function identityRegister(body: IdentityRegisterDto) {
  return await gatewayRequestJson<IdentityUserDto>(
    "/accounts/identity/users/create",
    {
      method: "POST",
      body,
      retryOnUnauthorized: false,
      schema: IdentityUserSchema,
    }
  );
}

export async function login(payload: LoginPayload) {
  const identifier = payload.identifier.trim();
  const password = payload.password;
  const body: AuthLoginDto = { usernameOrEmail: identifier, password };
  const result = await authLogin(body);
  if (result.success) authStore.setAuthenticated();
  return result;
}

export async function signup(payload: SignupPayload) {
  const email = payload.email.trim();
  const username = payload.username.trim();
  const password = payload.password;

  const createBody: IdentityRegisterDto = { email, password, username };
  const createResult = await identityRegister(createBody);

  const loginBody: AuthLoginDto = { usernameOrEmail: email, password };
  const loginResult = await authLogin(loginBody);
  if (loginResult.success) authStore.setAuthenticated();

  return createResult;
}

export async function logout() {
  const result = await gatewayRequestJson<AuthSuccessResponseDto>("/auth/logout", {
    method: "POST",
    retryOnUnauthorized: false,
    schema: AuthSuccessResponseSchema,
  });
  authStore.setUnauthenticated();
  return result;
}

export function startGoogleOAuth() {
  if (typeof window === "undefined") return;
  window.location.assign("/api/gateway/auth/google");
}

export async function completeGoogleOAuth(params: { idToken: string } | { code: string; state?: string }) {
  const body =
    "idToken" in params
      ? GoogleCallbackSchema.parse({ id_token: params.idToken })
      : GoogleCallbackSchema.parse({ code: params.code, state: params.state });
  const result = await gatewayRequestJson<GoogleOAuthCallbackResponseDto>(
    "/auth/oauth/google/callback",
    {
      method: "POST",
      body,
      retryOnUnauthorized: false,
      schema: GoogleOAuthCallbackResponseSchema,
    }
  );
  authStore.setAuthenticated();
  return result;
}

export async function bootstrapAuth() {
  try {
    const me = await gatewayRequestJson<IdentityUserDto>("/accounts/identity/me", {
      schema: IdentityUserSchema,
    });
    if (me?.userId) authStore.setAuthenticated();
    else authStore.setUnauthenticated();
    return me;
  } catch {
    authStore.setUnauthenticated();
    return null;
  }
}
