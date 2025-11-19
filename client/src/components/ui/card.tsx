import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/70 bg-white/80 shadow-lg shadow-slate-950/10 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-slate-950/30",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <footer className={cn("flex items-center justify-between px-5 pb-5", className)} {...props} />;
}
