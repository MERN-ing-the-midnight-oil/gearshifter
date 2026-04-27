import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="login" options={{ title: 'Organizer Login' }} />
      <Stack.Screen name="test-login" options={{ title: 'Axel test sign-in' }} />
      <Stack.Screen name="signup" options={{ title: 'Create Account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
    </Stack>
  );
}

