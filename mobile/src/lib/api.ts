const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://api.flaxia.com.br';

export type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

export type LoginData = { token: string };

/** Erro HTTP com status e corpo, para tratar casos como 409 (duplicado / classe existente). */
export class ApiError<T = unknown> extends Error {
  constructor(message: string, readonly status: number, readonly body: ApiEnvelope<T>) {
    super(message);
  }
}

export const API_BASE_URL = API_URL;

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok) throw new ApiError(body.message ?? `Request failed (${response.status})`, response.status, body);
  return body;
}

export async function login(email: string, password: string) {
  const result = await apiRequest<LoginData>('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!result.data?.token) throw new Error(result.message ?? 'Login failed');
  return result.data.token;
}
