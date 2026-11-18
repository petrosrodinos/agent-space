import type { FC } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { useSignUp } from "@/features/auth/hooks/use-auth";
import { Routes } from "@/routes/routes";
import { AuthLayout } from "../../components/auth-layout";
import { signUpSchema, type SignUpFormData } from "../../validation-schemas/auth.schema";

const SignUpPage: FC = () => {
  const [params] = useSearchParams();
  const invitation = params.get("invitation") ?? undefined;
  const next = params.get("next") ?? undefined;
  const signUp = useSignUp(invitation ? Routes.chat.root : next && next.startsWith("/") ? next : undefined);
  const form = useForm<SignUpFormData>({ resolver: zodResolver(signUpSchema), defaultValues: { name: "", email: params.get("email") ?? "", password: "" } });

  return (
    <AuthLayout
      title="Create your space"
      subtitle="Set up your first AI co-worker in under five minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link to={Routes.auth.sign_in} className="font-bold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => signUp.mutate({ ...v, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, invitation_token: invitation }))}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder="Petros" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work email</FormLabel>
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
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="w-full" loading={signUp.isPending}>
            Create account
          </Button>
          <p className="text-center text-xs text-muted-foreground">A personal space is created for you automatically. You can invite your team later.</p>
        </form>
      </Form>
    </AuthLayout>
  );
};

export default SignUpPage;
