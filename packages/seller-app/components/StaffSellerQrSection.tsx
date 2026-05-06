import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

const QR_DISPLAY = 128;

type Props = {
  /** Same value as `sellers.qr_code` (e.g. `C-…`) — organizer check-in scans or pastes this. */
  qrPayload: string | null | undefined;
};

/**
 * QR for event staff: opens this seller in Organizer check-in for the current event
 * (print tags, register items not yet pre-registered).
 */
export function StaffSellerQrSection({ qrPayload }: Props) {
  const [copied, setCopied] = useState(false);

  if (!qrPayload?.trim()) return null;

  const code = qrPayload.trim();

  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (e.g. some web contexts)
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>QR for event staff</Text>
      <Text style={styles.hint}>
        Staff scan this in the Gear Swap Organizer app at check-in (Scan QR), or paste the code below. They can open
        your items, print all labels, or add gear that was not pre-registered.
      </Text>
      <Image
        accessibilityLabel="QR code for event staff to look up this seller"
        source={{
          uri: `https://api.qrserver.com/v1/create-qr-code/?size=${QR_DISPLAY * 2}&data=${encodeURIComponent(code)}`,
        }}
        style={styles.image}
        resizeMode="contain"
      />
      <Text style={styles.mono} selectable>
        {code}
      </Text>
      <TouchableOpacity onPress={copyCode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.share}>{copied ? 'Copied' : 'Copy code for staff'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
    marginBottom: 12,
  },
  image: {
    width: QR_DISPLAY,
    height: QR_DISPLAY,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  mono: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: '#333',
  },
  share: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
});
