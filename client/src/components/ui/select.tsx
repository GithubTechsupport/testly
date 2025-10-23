import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const baseStyles =
  "flex h-11 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-slate-950";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select ref={ref} className={cn(baseStyles, className)} {...props}>
      {children}
    </select>
  );
});
