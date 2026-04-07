import { Stack } from 'expo-router';
import { theme } from '../../lib/theme';

export default function AppStackLayout() {
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
        contentStyle: {
          backgroundColor: theme.background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Seller Event View',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="events"
        options={{
          title: 'Events',
        }}
      />
      <Stack.Screen
        name="items"
        options={{
          title: 'My Items',
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          title: 'Notifications',
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Stack>
  );
}
