import type { FC } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForgotPassword } from "@/features/auth/hooks/use-auth";
import { Routes } from "@/routes/routes";
import { AuthLayout } from "../../components/auth-layout";
import { forgotPasswordSchema, type ForgotPasswordFormData } from "../../validation-schemas/auth.schema";

const ForgotPasswordPage: FC = () => {
  const forgot = useForgotPassword();
  const form = useForm<ForgotPasswordFormData>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <Link to={Routes.auth.sign_in} className="font-bold text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {forgot.isSuccess ? (
        <div className="flex items-start gap-3 rounded-[20px] border border-hairline bg-surface p-5 shadow-sticker">
          <MailCheck className="mt-0.5 h-6 w-6 text-success" />
          <div>
            <p className="font-bold text-ink">Check your inbox</p>
            <p className="mt-1 text-sm text-muted-foreground">{forgot.data?.message}</p>
          </div>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => forgot.mutate(v.email))} className="space-y-4" noValidate>
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
            <Button type="submit" size="lg" className="w-full" loading={forgot.isPending}>
              Send reset link
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
