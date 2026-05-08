import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useAuth,
  useAdminOrganization,
  useAdminUser,
  updateSaleBehaviorSettings,
  getOrganizationSellerReceiptTemplates,
  type SellerReceiptTemplate,
} from 'shared';
import { useState, useEffect } from 'react';

export default function SaleSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { organization, loading: orgLoading } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<SellerReceiptTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [notifyPush, setNotifyPush] = useState(true);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (adminUser && adminUser.role !== 'admin') router.replace('/(dashboard)');
  }, [adminUser, router]);

  useEffect(() => {
    if (!organization) return;
    const s = organization.saleBehaviorSettings;
    setNotifySms(Boolean(s.notifySellerSmsOnSale));
    setNotifyPush(s.notifySellerPushOnSale !== false);
    setDefaultTemplateId(s.defaultSellerReceiptTemplateId ?? undefined);
  }, [organization]);

  useEffect(() => {
    const load = async () => {
      if (!organization?.id) {
        setTemplatesLoading(false);
        return;
      }
      try {
        const list = await getOrganizationSellerReceiptTemplates(organization.id);
        setTemplates(list.filter((t) => t.isActive));
      } catch (e) {
        console.warn(e);
      } finally {
        setTemplatesLoading(false);
      }
    };
    void load();
  }, [organization?.id]);

  const handleSave = async () => {
    if (!organization) return;
    setSaving(true);
    try {
      await updateSaleBehaviorSettings(organization.id, {
        notifySellerSmsOnSale: notifySms,
        notifySellerPushOnSale: notifyPush,
        defaultSellerReceiptTemplateId: defaultTemplateId ?? null,
      });
      Alert.alert('Saved', 'Sale notification settings updated.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (orgLoading || adminUserLoading || !isAdmin) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>When sales happen</Text>
        <TouchableOpacity onPress={handleSave} style={styles.save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
        <Text style={styles.lead}>
          Choose how sellers are alerted after the POS marks an item sold, and pick the thermal receipt layout
          staff use when they print the seller slip.
        </Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>In-app notification</Text>
              <Text style={styles.rowHelp}>Expo push to the seller app (when the seller has push enabled).</Text>
            </View>
            <Switch value={notifyPush} onValueChange={setNotifyPush} />
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Text the seller</Text>
              <Text style={styles.rowHelp}>
                Sends an SMS using the same Twilio configuration as POS buyer receipts (requires seller phone on
                file).
              </Text>
            </View>
            <Switch value={notifySms} onValueChange={setNotifySms} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Default seller receipt template</Text>
          <Text style={styles.rowHelp}>
            Printed from the POS on the same printers as gear tags. Configure layouts under Seller receipts.
          </Text>
          {templatesLoading ? (
            <ActivityIndicator style={{ marginTop: 12 }} />
          ) : templates.length === 0 ? (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => router.push('/(dashboard)/seller-receipts')}
            >
              <Text style={styles.linkBtnText}>Create a seller receipt template</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, !defaultTemplateId && styles.chipOn]}
                onPress={() => setDefaultTemplateId(undefined)}
              >
                <Text style={styles.chipText}>Use ★ default only</Text>
              </TouchableOpacity>
              {templates.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.chip, defaultTemplateId === t.id && styles.chipOn]}
                  onPress={() => setDefaultTemplateId(t.id)}
                >
                  <Text style={styles.chipText}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/(dashboard)/seller-receipts')}>
          <Text style={styles.outlineBtnText}>Edit seller receipt templates →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF4',
    backgroundColor: '#fff',
  },
  back: { paddingVertical: 8, paddingHorizontal: 4 },
  backText: { color: '#007AFF', fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', flex: 1, textAlign: 'center' },
  save: { paddingVertical: 8, paddingHorizontal: 4 },
  saveText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollInner: { padding: 20, paddingBottom: 40 },
  lead: { fontSize: 14, color: '#4B5563', lineHeight: 20, marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8EDF4',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowDivider: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F0F4F8' },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  rowHelp: { fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 6 },
  linkBtn: { marginTop: 12, alignSelf: 'flex-start' },
  linkBtnText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  chips: { marginTop: 12, maxHeight: 44 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F4F8',
    marginRight: 8,
  },
  chipOn: { backgroundColor: '#DBEAFE' },
  chipText: { fontSize: 14, color: '#1E3A5F', fontWeight: '500' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnText: { color: '#007AFF', fontWeight: '600', fontSize: 15 },
});
