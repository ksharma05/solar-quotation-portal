import { post, type ApiResult } from '@/services/api/client'

export function login(pin: string): Promise<ApiResult<{ token: string; expiresIn: number }>> {
  return post('login', { pin })
}

export function logout(token: string): Promise<ApiResult<Record<string, never>>> {
  return post('logout', { token })
}

export function ping(token: string): Promise<ApiResult<{ user: string }>> {
  return post('ping', { token })
}
