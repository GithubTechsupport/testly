import { Link, NavLink } from "react-router-dom";
import { BookMarked, LogOut, Plus, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  selectCurrentUser,
  selectIsAuthenticated,
  selectLogout,
  useAuthStore,
} from "@/features/auth/store";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/browse", label: "Browse" },
  { to: "/my-books", label: "My Books" },
];

export function Navbar() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore(selectCurrentUser);
  const clearAuth = useAuthStore(selectLogout);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-white">
          <BookMarked className="h-6 w-6 text-brand" />
          Testly
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }: { isActive: boolean }) =>
                cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand/90 text-white shadow shadow-brand/30"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="hidden flex-col text-right text-xs font-medium text-slate-300 sm:flex">
                <span className="text-sm text-white">{user.username}</span>
                <span className="text-slate-500">{user.email}</span>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/20 text-brand">
                <UserRound className="h-5 w-5" />
              </span>
              <Button
                variant="ghost"
                className="hidden md:inline-flex"
                onClick={clearAuth}
                leftIcon={<LogOut className="h-4 w-4" />}
              >
                Log out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">Create account</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
