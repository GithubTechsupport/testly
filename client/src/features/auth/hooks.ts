import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

import { getAxiosErrorMessage } from "@/lib/axios-error";
import { selectSetAuth, useAuthStore } from "@/features/auth/store";

import { login, registerAccount } from "./api";
import type { AuthResult, LoginPayload, RegisterPayload } from "./types";

export function useLoginMutation() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(selectSetAuth);

  return useMutation<AuthResult, unknown, LoginPayload>({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (authResult: AuthResult) => {
      setAuth(authResult);
      toast.success(`Welcome back, ${authResult.user.username}!`);
      navigate("/my-books", { replace: true });
    },
    onError: (error: unknown) => {
      toast.error(getAxiosErrorMessage(error, "Unable to sign in"));
    },
  });
}

export function useRegisterMutation() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(selectSetAuth);

  return useMutation<AuthResult, unknown, RegisterPayload>({
    mutationFn: (payload: RegisterPayload) => registerAccount(payload),
    onSuccess: (authResult: AuthResult) => {
      setAuth(authResult);
      toast.success("Account created! You're ready to go.");
      navigate("/my-books", { replace: true });
    },
    onError: (error: unknown) => {
      toast.error(getAxiosErrorMessage(error, "Registration failed"));
    },
  });
}
