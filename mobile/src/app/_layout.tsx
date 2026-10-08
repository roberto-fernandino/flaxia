import { DarkTheme, DefaultTheme, Slot, ThemeProvider, useSegments } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { DocumentScannerHost } from '@/components/document-scanner';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import LoginScreen from '@/components/login-screen';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AuthenticatedApp />
        <DocumentScannerHost />
      </AuthProvider>
    </ThemeProvider>
  );
}

function AuthenticatedApp() {
  const { token } = useAuth();
  const segments = useSegments();
  const publicRoutes = new Set(['index', 'login', 'signup', 'forgot-password', 'email-verification', 'privacy-policy', 'force-logout', 'invite']);
  const route = segments[0] ?? 'index';

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  // The web landing page is public. Keep the existing auth gate for all
  // protected routes while allowing public auth/deep-link pages to render.
  if (!token && publicRoutes.has(route)) return <Slot />;
  return token ? <AppTabs /> : <LoginScreen />;
}
