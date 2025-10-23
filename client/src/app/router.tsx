import { createBrowserRouter, Navigate } from "react-router-dom";
import { MainLayout } from "@/layouts/main-layout";
import { HomePage } from "@/features/home/pages/home-page";
import { MyBooksPage } from "@/features/books/pages/my-books-page";
import { BrowsePage } from "@/features/books/pages/browse-page";
import { LoginPage } from "@/features/auth/pages/login-page";
import { RegisterPage } from "@/features/auth/pages/register-page";
import { ProtectedRoute } from "@/features/auth/components/protected-route";
import { GuestOnlyRoute } from "@/features/auth/components/guest-only-route";

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/browse", element: <BrowsePage /> },
      {
        path: "/my-books",
        element: (
          <ProtectedRoute>
            <MyBooksPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/login",
    element: (
      <GuestOnlyRoute>
        <LoginPage />
      </GuestOnlyRoute>
    ),
  },
  {
    path: "/register",
    element: (
      <GuestOnlyRoute>
        <RegisterPage />
      </GuestOnlyRoute>
    ),
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
