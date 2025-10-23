import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const baseStyles =
  "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 rounded-lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark focus-visible:outline-brand",
  secondary:
    "bg-slate-800 text-slate-100 hover:bg-slate-700 focus-visible:outline-slate-500",
  outline:
    "border border-slate-600 text-slate-100 hover:bg-slate-800/40 focus-visible:outline-slate-500",
  ghost: "hover:bg-slate-800/50 text-slate-200 focus-visible:outline-slate-500",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-12 px-6 text-lg",
  icon: "h-10 w-10",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
  asChild?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  children,
  isLoading = false,
  asChild = false,
  disabled,
  ...props
}: ButtonProps) {
  const label = typeof children === "string" ? children : "loading";

  const Comp = asChild ? Slot : "button";

  const mergedProps = asChild
    ? { ...props, "aria-disabled": disabled || isLoading }
    : { ...props, disabled: disabled || isLoading };

  return (
    <Comp
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...mergedProps}
    >
      {isLoading ? (
        <>
          <Spinner
            className="text-white"
            size={size === "sm" ? "sm" : "md"}
          />
          <span className="sr-only">Loading {label}</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="mr-2 flex items-center">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="ml-2 flex items-center">{rightIcon}</span>}
        </>
      )}
    </Comp>
  );
}
