import { Outlet } from "react-router-dom";

import { Navbar } from "@/components/navigation/navbar";

export function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),_transparent_55%)]" />
      <Navbar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 pb-16 pt-8">
        <Outlet />
      </main>
    </div>
  );
}
