import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="login" options={{ title: 'Sign in' }} />
      <Stack.Screen name="verify-phone" options={{ title: 'Verify code' }} />
      <Stack.Screen name="complete-profile" options={{ title: 'Your details' }} />
      <Stack.Screen name="signup" options={{ title: 'Create Account' }} />
    </Stack>
  );
}

