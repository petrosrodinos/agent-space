import type { FC } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { useSignIn } from "@/features/auth/hooks/use-auth";
import { Routes } from "@/routes/routes";
import { AuthLayout } from "../../components/auth-layout";
import { signInSchema, type SignInFormData } from "../../validation-schemas/auth.schema";

const SignInPage: FC = () => {
  const [params] = useSearchParams();
  const next = params.get("next") ?? undefined;
  const signIn = useSignIn(next && next.startsWith("/") ? next : undefined);
  const form = useForm<SignInFormData>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to chat with your bots."
      footer={
        <>
          New to Agent Space?{" "}
          <Link to={`${Routes.auth.sign_up}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => signIn.mutate(v))} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="you@company.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link to={Routes.auth.forgot_password} className="text-sm font-semibold text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput autoComplete="current-password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="w-full" loading={signIn.isPending}>
            Sign in
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
};

export default SignInPage;
