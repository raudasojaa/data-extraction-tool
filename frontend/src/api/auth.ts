import api from "./client";

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  training_contributor: boolean;
  created_at: string;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<LoginResponse>("/auth/login", {
    email,
    password,
  });
  return data;
}

export async function registerFirstUser(
  email: string,
  password: string,
  fullName: string
) {
  const { data } = await api.post<User>("/auth/register-first", {
    email,
    password,
    full_name: fullName,
  });
  return data;
}

export async function getMe() {
  const { data } = await api.get<User>("/auth/me");
  return data;
}

export async function listUsers() {
  const { data } = await api.get<User[]>("/auth/users");
  return data;
}

export async function updateUser(
  userId: string,
  updates: { training_contributor?: boolean; role?: string }
) {
  const { data } = await api.put<User>(`/auth/users/${userId}`, updates);
  return data;
}
