import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth, getCurrentSeller, updateSellerPushToken } from 'shared';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registers for Expo push tokens on a physical device and saves to sellers.expo_push_token.
 * No-op on web, simulators, or when EXPO_PUBLIC_ENABLE_NOTIFICATIONS=false.
 * Requires `extra.eas.projectId` in app.json (run `eas init` and copy the project ID).
 */
export function PushNotificationSetup() {
  const { user } = useAuth();
  const attemptedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (Platform.OS === 'web') return;
    if (process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS === 'false') return;

    if (attemptedForUser.current === user.id) return;

    let cancelled = false;

    (async () => {
      if (!Device.isDevice) return;

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('sales', {
          name: 'Sale alerts',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      const projectId =
        (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
          ?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        console.warn(
          '[Push] Missing EAS project ID: set `expo.extra.eas.projectId` in app.json (from `eas project:info`).'
        );
        return;
      }

      const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
      if (cancelled) return;

      const seller = await getCurrentSeller(user.id);
      if (!seller) return;

      await updateSellerPushToken(user.id, tokenResult.data);
      attemptedForUser.current = user.id;
    })().catch((e) => console.warn('[Push] registration failed', e));

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return null;
}
