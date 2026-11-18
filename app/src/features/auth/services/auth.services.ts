import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";
import type { User } from "@/features/users/interfaces/users.interfaces";

export interface AuthResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  user: User;
  joined_organization_id?: string;
}

export const signIn = (dto: { email: string; password: string }) => request<AuthResponse>(() => axiosInstance.post(ApiRoutes.auth.login, dto), "Could not sign in.");

export const signUp = (dto: { email: string; password: string; name: string; timezone?: string; invitation_token?: string }) =>
  request<AuthResponse>(() => axiosInstance.post(ApiRoutes.auth.register, dto), "Could not create your account.");

export const signOut = () => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.auth.logout, {}));

export const forgotPassword = (email: string) => request<{ message: string }>(() => axiosInstance.post(ApiRoutes.auth.forgot_password, { email }));

export const resetPassword = (dto: { token: string; password: string }) => request<{ message: string }>(() => axiosInstance.post(ApiRoutes.auth.reset_password, dto));

export const changePassword = (dto: { current_password: string; new_password: string }) => request<{ ok: boolean }>(() => axiosInstance.post(ApiRoutes.auth.change_password, dto));
