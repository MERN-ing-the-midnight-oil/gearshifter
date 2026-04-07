import { Stack } from 'expo-router';
import { theme } from '../../lib/theme';

export default function DashboardLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create-event" options={{ title: 'Create Event' }} />
      <Stack.Screen name="categories" options={{ title: 'Categories' }} />
      <Stack.Screen name="commission-rates" options={{ title: 'Commission Rates' }} />
      <Stack.Screen name="field-definitions" options={{ title: 'Item Fields' }} />
      <Stack.Screen name="gear-tags" options={{ title: 'Gear Tags' }} />
      <Stack.Screen name="price-reduction-settings" options={{ title: 'Price Reductions' }} />
      <Stack.Screen name="swap-registration-fields" options={{ title: 'Seller Registration Form' }} />
      <Stack.Screen name="users" options={{ title: 'Team Members' }} />
      <Stack.Screen name="post-event-inventory" options={{ title: 'Post-event inventory' }} />
    </Stack>
  );
}
