import { Link, useLocation } from "react-router-dom";
import type { Location } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLoginMutation } from "@/features/auth/hooks";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const location = useLocation();
  const loginMutation = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginFormData) => {
    loginMutation.mutate(values);
  };

  const fromRoute = (location.state as { from?: Location } | undefined)?.from;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-white">Sign in to Testly</h1>
        <p className="text-sm text-slate-400">
          {fromRoute ? "Please log in to continue" : "Enter your credentials to access your library."}
        </p>
      </div>

      <Card className="border-slate-800/80 bg-slate-900/60">
        <CardContent className="space-y-6 py-8">
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="identifier">Email or username</Label>
              <Input id="identifier" autoComplete="username" {...register("identifier")} />
              {errors.identifier && (
                <p className="text-xs text-red-400">{errors.identifier.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              leftIcon={<LogIn className="h-4 w-4" />}
              isLoading={loginMutation.isPending}
            >
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand hover:underline">
              Register now
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
