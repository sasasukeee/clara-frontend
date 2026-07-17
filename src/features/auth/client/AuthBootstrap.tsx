"use client";

import { useEffect, useRef } from "react";

import { useAuthStatus } from "@/stores/auth.store";

import { bootstrapAuth } from "../api";

export function AuthBootstrap() {
  const status = useAuthStatus();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (status !== "unknown") return;
    startedRef.current = true;
    void bootstrapAuth();
  }, [status]);

  return null;
}

