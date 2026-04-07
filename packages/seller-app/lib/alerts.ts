import { Alert, Platform } from 'react-native';

const WEB = Platform.OS === 'web';

/**
 * react-native-web stubs `Alert.alert` as a no-op, so native-style dialogs never show on web.
 * Use this for confirmations and simple errors on seller screens.
 */
export function showMessage(title: string, message?: string): void {
  const body = message ? `${title}\n\n${message}` : title;
  if (WEB && typeof window !== 'undefined') {
    window.alert(body);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(options: {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  /** When `onConfirm` throws (default: "Something went wrong") */
  errorTitle?: string;
  onConfirm: () => void | Promise<void>;
}): void {
  const {
    title,
    message,
    confirmText,
    cancelText = 'Cancel',
    destructive,
    errorTitle,
    onConfirm,
  } = options;

  const run = async () => {
    try {
      await onConfirm();
    } catch (e) {
      showMessage(
        errorTitle ?? 'Something went wrong',
        e instanceof Error ? e.message : 'Please try again.'
      );
    }
  };

  if (WEB && typeof window !== 'undefined') {
    const ok = window.confirm(`${title}\n\n${message}`);
    // Defer work off the click stack: faster handler return + avoids stale list races with sync UI.
    if (ok) queueMicrotask(() => void run());
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: () => void run(),
    },
  ]);
}
