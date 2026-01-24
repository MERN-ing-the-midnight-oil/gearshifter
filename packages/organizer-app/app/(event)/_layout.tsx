import { Stack } from 'expo-router';

export default function EventLayout() {
  return (
    <Stack>
      <Stack.Screen name="select-mode" options={{ title: 'Select Station Mode' }} />
      <Stack.Screen name="check-in" options={{ headerShown: false }} />
      <Stack.Screen name="pos" options={{ headerShown: false }} />
      <Stack.Screen name="pickup" options={{ headerShown: false }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
    </Stack>
  );
}

