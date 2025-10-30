import type { AxiosError } from "axios";

export function getAxiosErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (!error || typeof error !== "object") return fallback;

  const axiosError = error as AxiosError<{ message?: string; error?: string }>;
  return (
    axiosError.response?.data?.message ??
    axiosError.response?.data?.error ??
    axiosError.message ??
    fallback
  );
}
