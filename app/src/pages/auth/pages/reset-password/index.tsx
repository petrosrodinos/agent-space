import type { FC } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { useResetPassword } from "@/features/auth/hooks/use-auth";
import { Routes } from "@/routes/routes";
import { AuthLayout } from "../../components/auth-layout";
import { resetPasswordSchema, type ResetPasswordFormData } from "../../validation-schemas/auth.schema";

const ResetPasswordPage: FC = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const reset = useResetPassword();
  const form = useForm<ResetPasswordFormData>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirm: "" } });

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={token ? "You'll be signed out everywhere else." : "This link is missing its token. Request a new one."}
      footer={
        <Link to={Routes.auth.sign_in} className="font-bold text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => reset.mutate({ token, password: v.password }))} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="w-full" loading={reset.isPending} disabled={!token}>
            Change password
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
