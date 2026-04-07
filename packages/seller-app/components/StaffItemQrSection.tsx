import { View, Text, Image, TouchableOpacity, StyleSheet, Share } from 'react-native';

const QR_DISPLAY = 112;

type Props = {
  qrCode: string | null | undefined;
  itemNumber: string;
  /** When false, nothing is rendered (e.g. only for pre-registered / pending items). */
  show: boolean;
};

/**
 * Compact staff-facing QR for the organizer deep link stored on `item.qrCode`.
 */
export function StaffItemQrSection({ qrCode, itemNumber, show }: Props) {
  if (!show || !qrCode?.trim()) return null;

  const share = () => {
    Share.share({
      message: `Item #${itemNumber} — staff QR (Gear Swap Organizer):\n${qrCode}`,
      title: 'Staff QR for item',
    }).catch(() => {});
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Staff check-in QR</Text>
      <Text style={styles.hint}>
        Organizers scan this in the Gear Swap Organizer app at check-in.
      </Text>
      <Image
        accessibilityLabel="QR code for event staff"
        source={{
          uri: `https://api.qrserver.com/v1/create-qr-code/?size=${QR_DISPLAY * 2}&data=${encodeURIComponent(qrCode)}`,
        }}
        style={styles.image}
        resizeMode="contain"
      />
      <TouchableOpacity onPress={share} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.share}>Share link</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
    marginBottom: 10,
  },
  image: {
    width: QR_DISPLAY,
    height: QR_DISPLAY,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  share: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
});
