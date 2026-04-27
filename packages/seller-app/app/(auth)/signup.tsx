import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../../lib/theme';

/**
 * Legacy route: seller accounts are created with phone SMS + optional profile step.
 * Deep links still point here; forward to the phone sign-in flow.
 */
export default function SignUpRedirectScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  useEffect(() => {
    router.replace({
      pathname: '/(auth)/login',
      ...(redirect ? { params: { redirect: String(redirect) } } : {}),
    });
  }, [redirect, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.activityIndicator} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
});
