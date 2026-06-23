import { get, post } from "./http";

export type RegisterDto = { email: string; password: string; displayName?: string };
export type LoginDto = { email: string; password: string };
export type AuthUserProfile = { email?: string | null; displayName?: string | null };
export type LoginResponse = { token: string; userKey: string; user?: AuthUserProfile };
export type MeResponse = { userKey: string; email?: string | null; displayName?: string | null };

export async function register(dto: RegisterDto) {
  return post<{ ok: boolean }>("/api/auth/register", dto);
}

export async function login(dto: LoginDto) {
  return post<LoginResponse>("/api/auth/login", dto);
}

export async function getMe(token: string) {
  return get<MeResponse>("/api/auth/me", token);
}