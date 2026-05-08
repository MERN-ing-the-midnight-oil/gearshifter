import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { getItemCheckInPhotoSignedUrl, type Item } from 'shared';

/**
 * After staff check-in, sellers can see the check-in reference photo and/or handoff notes on their dashboard.
 */
export function SellerItemCheckInDoc({ item }: { item: Item }) {
  if (!item.checkedInAt) return null;
  const path = item.checkInPhotoStoragePath?.trim();
  const staff = item.checkInStaffDescription?.trim();
  if (!path && !staff) return null;

  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      setUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getItemCheckInPhotoSignedUrl(path, 7200)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, item.id]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>At check-in (staff)</Text>
      {path ? (
        loading ? (
          <ActivityIndicator style={styles.spinner} color="#6F42C1" />
        ) : url ? (
          <Image
            source={{ uri: url }}
            style={styles.img}
            resizeMode="cover"
            accessibilityLabel="Item as photographed by staff at check-in"
          />
        ) : (
          <Text style={styles.muted}>Check-in photo could not be loaded. Pull to refresh.</Text>
        )
      ) : null}
      {staff ? <Text style={styles.staff}>{staff}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6F42C1',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  spinner: { marginVertical: 12 },
  img: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    backgroundColor: '#ECECEC',
  },
  muted: { fontSize: 13, color: '#888', fontStyle: 'italic' },
  staff: { fontSize: 14, color: '#333', lineHeight: 20, marginTop: 8 },
});
