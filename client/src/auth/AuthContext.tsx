import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchCurrentUser, logoutRequest, refreshAccessToken, submitAuthForm } from './api';
import { type AuthFormValues, type AuthMode, type AuthResponse, type AuthUser } from './types';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  accessToken: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  signIn: (mode: AuthMode, values: AuthFormValues) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const applyAuthSession = useCallback((authResponse: AuthResponse) => {
    setAccessToken(authResponse.accessToken);
    setUser(authResponse.user);
    setStatus('authenticated');
  }, []);

  const clearAuthSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    let isActive = true;

    async function restoreAuthSession() {
      try {
        const refreshResponse = await refreshAccessToken();
        const currentUser = await fetchCurrentUser(refreshResponse.accessToken);

        if (!isActive) {
          return;
        }

        setAccessToken(refreshResponse.accessToken);
        setUser(currentUser);
        setStatus('authenticated');
      } catch {
        if (!isActive) {
          return;
        }

        clearAuthSession();
      }
    }

    void restoreAuthSession();

    return () => {
      isActive = false;
    };
  }, [clearAuthSession]);

  const signIn = useCallback(
    async (mode: AuthMode, values: AuthFormValues) => {
      const authResponse = await submitAuthForm(mode, values);
      applyAuthSession(authResponse);
    },
    [applyAuthSession],
  );

  const signOut = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Local session state should still be cleared if the network request fails.
    } finally {
      clearAuthSession();
    }
  }, [clearAuthSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      user,
      status,
      signIn,
      signOut,
    }),
    [accessToken, signIn, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return value;
}
