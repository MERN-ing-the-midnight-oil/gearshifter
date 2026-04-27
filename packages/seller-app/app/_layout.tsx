import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from 'shared';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';
import { PushNotificationSetup } from '../components/PushNotificationSetup';

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onSellerEventDeepLink = segments[0] === 'event';
    const authRoute = segments.join('/');
    const sellerPhoneOnboarding =
      authRoute.startsWith('(auth)/verify-phone') || authRoute.startsWith('(auth)/complete-profile');

    if (!user && !inAuthGroup && !onSellerEventDeepLink) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup && !sellerPhoneOnboarding) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
      </View>
    );
  }

  return (
    <>
      {user ? <PushNotificationSetup /> : null}
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
});
