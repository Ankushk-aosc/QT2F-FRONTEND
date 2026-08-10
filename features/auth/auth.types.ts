export interface LoginCredentials {
  email: string
  password?: string
}

export interface AuthUser {
  id: string
  email: string
  name?: string
  avatar?: string
  role?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

export interface AuthState {
  user: AuthUser | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface LoginResponse {
  user: AuthUser
  tokens: AuthTokens
}

export interface VerifyResponse {
  valid: boolean
  user?: AuthUser
}
