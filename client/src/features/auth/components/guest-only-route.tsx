import { Navigate, useLocation } from "react-router-dom";
import type { Location } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuthStore, selectIsAuthenticated } from "@/features/auth/store";

interface GuestOnlyRouteProps {
  children: ReactNode;
}

export function GuestOnlyRoute({ children }: GuestOnlyRouteProps) {
  const location = useLocation();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  if (isAuthenticated) {
    const next = (location.state as { from?: Location } | undefined)?.from ?? {
      pathname: "/",
    };
    return <Navigate to={next} replace />;
  }

  return <>{children}</>;
}
