import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Routes } from "@/routes/routes";
import { useAuthStore } from "@/stores/auth";
import { useOrganizationStore } from "@/stores/organization";
import { platform } from "@/platform";
import { realtime } from "@/features/realtime/services/realtime.services";
import { changePassword, forgotPassword, resetPassword, signIn, signOut, signUp, type AuthResponse } from "../services/auth.services";

function useAfterAuth() {
  const setSession = useAuthStore((s) => s.setSession);
  const setOrg = useOrganizationStore((s) => s.setCurrent);
  const queryClient = useQueryClient();
  return async (data: AuthResponse) => {
    if (data.refresh_token) await platform.storage.setRefreshToken(data.refresh_token);
    setSession({ access_token: data.access_token, expires_in: data.expires_in, user: data.user });
    if (data.joined_organization_id) setOrg(data.joined_organization_id);
    queryClient.clear();
  };
}

export function useSignIn(redirectTo?: string) {
  const after = useAfterAuth();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: signIn,
    onSuccess: async (data) => {
      await after(data);
      toast({ title: `Welcome back${data.user.name ? `, ${data.user.name.split(" ")[0]}` : ""}`, duration: 2000 });
      navigate(redirectTo || Routes.home, { replace: true });
    },
    onError: (error) => toast({ title: "Could not sign in", description: error.message, variant: "error" }),
  });
}

export function useSignUp(redirectTo?: string) {
  const after = useAfterAuth();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: signUp,
    onSuccess: async (data) => {
      await after(data);
      toast({ title: "Your space is ready", description: "Let's set up your first bot.", duration: 2500 });
      navigate(redirectTo || Routes.bots.new, { replace: true });
    },
    onError: (error) => toast({ title: "Could not create your account", description: error.message, variant: "error" }),
  });
}

export function useSignOut() {
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: signOut,
    onSettled: async () => {
      await platform.storage.setRefreshToken(null);
      realtime.reset();
      clear();
      queryClient.clear();
      navigate(Routes.auth.sign_in, { replace: true });
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: forgotPassword,
    onSuccess: (data) => toast({ title: "Check your email", description: data.message }),
    onError: (error) => toast({ title: "Could not send the link", description: error.message, variant: "error" }),
  });
}

export function useResetPassword() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: resetPassword,
    onSuccess: (data) => {
      toast({ title: "Password changed", description: data.message });
      navigate(Routes.auth.sign_in, { replace: true });
    },
    onError: (error) => toast({ title: "Could not reset the password", description: error.message, variant: "error" }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: changePassword,
    onSuccess: () => toast({ title: "Password changed", description: "Your other sessions were signed out." }),
    onError: (error) => toast({ title: "Could not change the password", description: error.message, variant: "error" }),
  });
}
