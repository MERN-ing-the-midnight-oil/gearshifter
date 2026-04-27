import { Slot, useRouter, useSegments, usePathname, useGlobalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, supabase } from 'shared';
import { theme } from '../lib/theme';

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const currentSegment = segments[0];
  const isOnAuthScreen = currentSegment === '(auth)' || pathname?.startsWith('/(auth)');
  const searchParams = useGlobalSearchParams();
  const signoutParam = searchParams.signout;
  const signoutVal = Array.isArray(signoutParam) ? signoutParam[0] : signoutParam;
  const isOnLoginRoute =
    (segments[0] === '(auth)' && segments[1] === 'login') ||
    (!!pathname?.includes('/(auth)/login') && !pathname?.includes('test-login')) ||
    pathname === '/login';
  /** Dev: `/(auth)/login?signout=1` — stay on login so the screen can sign out and show the form (otherwise logged-in users are bounced to the dashboard). */
  const isDevLoginSignOutIntent =
    __DEV__ && (signoutVal === '1' || signoutVal === 'true') && isOnLoginRoute;
  const showHomeButton = !!user && !isOnAuthScreen;

  // Password recovery: deep link / email opens app with recovery session → reset password screen
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/(auth)/reset-password');
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // Handle auth-based redirects after initial load
  // Note: Initial redirect is handled by index.tsx
  useEffect(() => {
    if (loading) {
      return;
    }

    // Skip if we're at root (index.tsx will handle it)
    if (!currentSegment) {
      return;
    }

    // If no user, redirect to login (unless already on auth screens)
    if (!user && !isOnAuthScreen) {
      router.replace('/(auth)/login');
      return;
    }

    const onPasswordFlowScreen =
      pathname?.includes('reset-password') || pathname?.includes('forgot-password');

    // If user is authenticated and on auth screens, redirect to dashboard (except password reset / forgot)
    if (user && isOnAuthScreen && !onPasswordFlowScreen && !isDevLoginSignOutIntent) {
      router.replace('/(dashboard)');
    }
  }, [user, loading, segments, pathname, router, isOnAuthScreen, currentSegment, isDevLoginSignOutIntent]);

  // Reserve top space when Home button is shown so headings aren't obscured
  const homeButtonTop = insets.top + 8;
  const homeButtonHeight = 40; // paddingVertical 10*2 + icon ~20
  const contentPaddingTop = showHomeButton ? homeButtonTop + homeButtonHeight : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.slotContainer, { paddingTop: contentPaddingTop }]}>
        <Slot />
      </View>
      {showHomeButton && (
        <Pressable
          style={[styles.homeButton, { top: homeButtonTop }]}
          onPress={() => router.replace('/(dashboard)')}
        >
          <Ionicons name="home" size={20} color={theme.buttonText} />
          <Text style={styles.homeButtonText}>Home</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slotContainer: {
    flex: 1,
  },
  homeButton: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.button,
    borderRadius: 10,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      userSelect: 'none',
    } as any),
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  homeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.buttonText,
  },
});
