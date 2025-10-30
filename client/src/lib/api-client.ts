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
