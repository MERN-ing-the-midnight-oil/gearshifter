import { Stack } from 'expo-router';
import { theme } from '../../lib/theme';
import { EventStackBreadcrumbs } from '../../components/OrganizerBreadcrumbs';

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
        headerTitleAlign: 'left',
        headerTitle: () => <EventStackBreadcrumbs />,
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

