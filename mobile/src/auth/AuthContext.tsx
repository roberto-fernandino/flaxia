import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { login } from '@/lib/api';

type AuthContextValue = { token: string | null; signIn: (email: string, password: string) => Promise<void>; signInWithToken: (nextToken: string) => Promise<void>; signOut: () => void };
const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'flaxflow.auth.token';

async function readToken() {
  if (Platform.OS === 'web') return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function writeToken(token: string) {
  if (Platform.OS === 'web') { localStorage.setItem(TOKEN_KEY, token); return; }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearToken() {
  if (Platform.OS === 'web') { localStorage.removeItem(TOKEN_KEY); return; }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    readToken().then(setToken).catch(() => undefined).finally(() => setReady(true));
  }, []);
  const value = useMemo(() => ({
    token,
    signIn: async (email: string, password: string) => { const nextToken = await login(email, password); setToken(nextToken); await writeToken(nextToken); },
    signInWithToken: async (nextToken: string) => { setToken(nextToken); await writeToken(nextToken); },
    signOut: () => { setToken(null); void clearToken().catch(() => undefined); },
  }), [token]);
  return <AuthContext.Provider value={value}>{ready ? children : null}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
