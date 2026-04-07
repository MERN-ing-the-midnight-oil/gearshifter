// Root index route - redirects based on auth state
// This prevents navigation warnings about invalid routes

import { Redirect } from 'expo-router';
import { useAuth } from 'shared';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';

export default function Index() {
  const { user, loading } = useAuth();

  // Show loading while auth is loading
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
      </View>
    );
  }

  // Redirect based on auth state
  if (user) {
    return <Redirect href="/(dashboard)" />;
  } else {
    return <Redirect href="/(auth)/login" />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
});

