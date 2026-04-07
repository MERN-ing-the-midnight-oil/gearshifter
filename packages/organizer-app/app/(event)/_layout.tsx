import { Stack } from 'expo-router';
import { theme } from '../../lib/theme';

export default function EventLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.surface,
        },
        headerTintColor: theme.text,
        headerTitleStyle: {
          color: theme.text,
        },
      }}
    >
      <Stack.Screen name="manage" options={{ title: 'Manage Event' }} />
      <Stack.Screen name="stations" options={{ title: 'Stations' }} />
      <Stack.Screen name="check-in" options={{ headerShown: false }} />
      <Stack.Screen name="pos" options={{ headerShown: false }} />
      <Stack.Screen name="pickup" options={{ headerShown: false }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
    </Stack>
  );
}

