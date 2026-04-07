import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  useAuth,
  useAdminUser,
  useAdminOrganization,
  listOrganizationInventory,
  addOrganizationInventoryItem,
  deleteOrganizationInventoryItem,
  updateOrganizationInventoryItem,
  type OrganizationInventoryItem,
} from 'shared';
import { theme } from '../../lib/theme';

export default function PostEventInventoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const { organization, loading: orgLoading } = useAdminOrganization(user?.id ?? null);
  const [rows, setRows] = useState<OrganizationInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [listedPrice, setListedPrice] = useState('');

  useEffect(() => {
    if (adminUser && adminUser.role !== 'admin') router.replace('/(dashboard)');
  }, [adminUser, router]);

  const load = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    try {
      const data = await listOrganizationInventory(organization.id);
      setRows(data);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organization]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleAddManual = async () => {
    if (!organization) return;
    const d = desc.trim();
    if (!d) {
      Alert.alert('Error', 'Enter a description');
      return;
    }
    const price = listedPrice.trim() ? parseFloat(listedPrice) : undefined;
    if (listedPrice.trim() && (Number.isNaN(price) || price! < 0)) {
      Alert.alert('Error', 'Invalid list price');
      return;
    }
    setSaving(true);
    try {
      await addOrganizationInventoryItem({
        organizationId: organization.id,
        description: d,
        category: category.trim(),
        size: size.trim() || undefined,
        listedPrice: price,
      });
      setDesc('');
      setCategory('');
      setSize('');
      setListedPrice('');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (row: OrganizationInventoryItem) => {
    const go = async () => {
      try {
        await deleteOrganizationInventoryItem(row.id);
        await load();
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete');
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Remove this row from organization inventory?')) void go();
    } else {
      Alert.alert('Remove item', 'Remove this row from organization inventory?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void go() },
      ]);
    }
  };

  const handleMarkDisposed = async (row: OrganizationInventoryItem) => {
    try {
      await updateOrganizationInventoryItem(row.id, { status: 'disposed' });
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update');
    }
  };

  if (adminUserLoading || !adminUser || adminUser.role !== 'admin') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
      </View>
    );
  }

  if (orgLoading || !organization) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
        <Text style={styles.muted}>Loading organization…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Post-event inventory</Text>
        <Text style={styles.subtitle}>
          Organization-level list (not tied to a single event). Add items you are keeping after the swap, or
          add them from pickup when an item is donated or unclaimed.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add item manually</Text>
        <Text style={styles.help}>
          Use this for stock you enter without a prior event item. Rows promoted from an event item store the
          original consignor as seller of record when available.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Description *"
          value={desc}
          onChangeText={setDesc}
        />
        <TextInput
          style={styles.input}
          placeholder="Category"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={styles.input}
          placeholder="Size"
          value={size}
          onChangeText={setSize}
        />
        <TextInput
          style={styles.input}
          placeholder="Listed price (optional)"
          value={listedPrice}
          onChangeText={setListedPrice}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity
          style={[styles.primaryBtn, saving && styles.btnDisabled]}
          onPress={handleAddManual}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Add to inventory</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inventory ({rows.length})</Text>
        {loading ? (
          <ActivityIndicator color={theme.activityIndicator} />
        ) : (
          rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle}>{row.description}</Text>
                <Text style={styles.badge}>{row.status}</Text>
              </View>
              {row.itemNumberSnapshot ? (
                <Text style={styles.meta}>#{row.itemNumberSnapshot}</Text>
              ) : null}
              <Text style={styles.meta}>
                {[row.category, row.size].filter(Boolean).join(' · ') || '—'}
              </Text>
              {row.listedPrice != null ? (
                <Text style={styles.meta}>List ${row.listedPrice.toFixed(2)}</Text>
              ) : null}
              {row.originNote ? <Text style={styles.meta}>{row.originNote}</Text> : null}
              <View style={styles.rowActions}>
                {row.status === 'in_stock' && (
                  <TouchableOpacity onPress={() => handleMarkDisposed(row)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>Mark disposed</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDelete(row)} style={styles.smallBtnDanger}>
                  <Text style={styles.smallBtnDangerText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        {!loading && rows.length === 0 && (
          <Text style={styles.muted}>No rows yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  muted: { color: theme.textSecondary, marginTop: 8 },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  back: { marginBottom: 12 },
  backText: { fontSize: 16, color: theme.link, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold', color: theme.text },
  subtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 8, lineHeight: 20 },
  card: {
    margin: 16,
    padding: 16,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 8 },
  help: { fontSize: 13, color: theme.textSecondary, marginBottom: 12, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
    color: theme.text,
    backgroundColor: theme.background,
  },
  primaryBtn: {
    backgroundColor: theme.button,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: theme.buttonText, fontWeight: '600', fontSize: 16 },
  section: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: theme.text },
  row: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.text, marginRight: 8 },
  badge: { fontSize: 12, color: theme.textSecondary, textTransform: 'capitalize' },
  meta: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  smallBtnText: { fontSize: 14, color: theme.text },
  smallBtnDanger: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.error,
  },
  smallBtnDangerText: { fontSize: 14, color: theme.error },
});
