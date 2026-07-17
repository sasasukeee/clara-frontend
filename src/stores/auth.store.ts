import { useSyncExternalStore } from "react";

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

type AuthState = {
  status: AuthStatus;
  updatedAt: number;
};

let state: AuthState = {
  status: "unknown",
  updatedAt: Date.now(),
};

const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const setState = (next: Partial<AuthState>) => {
  state = { ...state, ...next, updatedAt: Date.now() };
  emit();
};

export const authStore = {
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setAuthenticated: () => setState({ status: "authenticated" }),
  setUnauthenticated: () => setState({ status: "unauthenticated" }),
  reset: () => setState({ status: "unknown" }),
};

export function useAuthStatus() {
  return useSyncExternalStore(
    authStore.subscribe,
    () => authStore.getState().status,
    () => authStore.getState().status
  );
}

