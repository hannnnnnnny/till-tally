export type AuthMode = 'login' | 'register';

export type AuthFormValues = {
  name?: string;
  email: string;
  password: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
};

export type RefreshResponse = {
  accessToken: string;
  expiresIn: number;
};
