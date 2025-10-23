import { apiClient } from "@/lib/api-client";

import type { AuthResult, LoginPayload, RegisterPayload } from "./types";

export async function login(payload: LoginPayload) {
  const response = await apiClient.post<{ data: AuthResult }>("/auth/login", payload);
  return response.data.data;
}

export async function registerAccount(payload: RegisterPayload) {
  const response = await apiClient.post<{ data: AuthResult }>("/auth/register", payload);
  return response.data.data;
}
