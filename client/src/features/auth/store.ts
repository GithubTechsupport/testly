import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StateCreator } from "zustand";

import type { AuthResult, UserSummary } from "./types";

export interface AuthState {
  user: UserSummary | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (payload: AuthResult) => void;
  clearAuth: () => void;
}

const authCreator: StateCreator<AuthState> = (set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setAuth: (payload: AuthResult) =>
    set({
      user: payload.user,
      accessToken: payload.tokens.accessToken,
      isAuthenticated: true,
    }),
  clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false }),
});

export const useAuthStore = create<AuthState>()(
  persist(
    authCreator,
    {
      name: "testly-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);


export const selectAuthToken = (state: AuthState) => state.accessToken;
export const selectCurrentUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectLogout = (state: AuthState) => state.clearAuth;
export const selectSetAuth = (state: AuthState) => state.setAuth;
