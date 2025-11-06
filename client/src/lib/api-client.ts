import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

import { useAuthStore } from "@/features/auth/store";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    const headers = config.headers ?? new AxiosHeaders();

    if (headers instanceof AxiosHeaders) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    config.headers = headers;
  }
  return config;
});

// Avoid redirect loops if multiple requests 401 at once
let isRedirectingToLogin = false;

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status as number | undefined;
    if (status === 401) {
      // Clear local auth state
      const { clearAuth } = useAuthStore.getState();
      clearAuth();

      // Redirect to login if not already there
      if (!isRedirectingToLogin && !window.location.pathname.startsWith("/login")) {
        isRedirectingToLogin = true;
        // Optional: could append ?from=... but ProtectedRoute already handles state-based redirects
        window.location.replace("/login");
      }
    }
    return Promise.reject(error);
  }
);
