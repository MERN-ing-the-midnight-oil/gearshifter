import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  useAuth,
  useAdminOrganization,
  useAdminUser,
  getOrganizationFieldDefinitions,
  updateSellerItemPreRegistrationSettings,
  type ItemFieldDefinition,
} from 'shared';

export default function ItemPreRegistrationFieldsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { organization, loading: orgLoading } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';

  const [fields, setFields] = useState<ItemFieldDefinition[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowedFieldNames, setAllowedFieldNames] = useState<string[]>([]);
  const [allowTagTemplateOnlyFields, setAllowTagTemplateOnlyFields] = useState(false);

  useEffect(() => {
    if (adminUser && adminUser.role !== 'admin') {
      router.replace('/(dashboard)');
    }
  }, [adminUser, router]);

  useEffect(() => {
    if (!organization) return;
    const preReg = organization.priceReductionSettings.sellerItemPreRegistration;
    setAllowedFieldNames(preReg?.allowedFieldNames ?? []);
    setAllowTagTemplateOnlyFields(Boolean(preReg?.allowTagTemplateOnlyFields));
  }, [organization]);

  useEffect(() => {
    if (!organization?.id) {
      setLoadingFields(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingFields(true);
      try {
        const defs = await getOrganizationFieldDefinitions(organization.id);
        if (!cancelled) setFields(defs);
      } catch (error) {
        if (!cancelled) {
          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load item fields');
        }
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  const configurableFields = useMemo(
    () =>
      fields.filter(
        (field) =>
          field.name !== 'category' &&
          field.name !== 'category_id' &&
          !field.isPriceField &&
          !field.isPriceReductionField
      ),
    [fields]
  );

  const toggleField = (fieldName: string, nextEnabled: boolean) => {
    if (nextEnabled) {
      setAllowedFieldNames((prev) => Array.from(new Set([...prev, fieldName])));
      return;
    }
    setAllowedFieldNames((prev) => prev.filter((name) => name !== fieldName));
  };

  const handleSave = async () => {
    if (!organization) return;
    setSaving(true);
    try {
      await updateSellerItemPreRegistrationSettings(organization.id, {
        allowedFieldNames,
        allowTagTemplateOnlyFields,
      });
      Alert.alert('Saved', 'Seller pre-registration field settings were updated.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (orgLoading || adminUserLoading || !isAdmin || loadingFields) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Seller Item Pre-registration</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton} disabled={saving}>
          <Text style={styles.headerButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Always shown to sellers</Text>
          <Text style={styles.helpText}>
            Item nickname, item type/category, price, and price drops (when your price reduction settings allow sellers
            to set them). Use the switches below for everything else—including item description (on by default until you
            change it).
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pre-registration fields (seller can enter)</Text>
          <Text style={styles.helpText}>
            Choose which optional item fields sellers may fill before check-in. Item description defaults to allowed;
            turn it off if staff will enter descriptions at check-in.
          </Text>
          {configurableFields.length === 0 ? (
            <Text style={styles.emptyText}>No extra item fields are configured yet.</Text>
          ) : (
            configurableFields.map((field) => {
              const enabled = allowedFieldNames.includes(field.name);
              return (
                <View key={field.id} style={styles.toggleRow}>
                  <View style={styles.toggleTextWrap}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <Text style={styles.fieldName}>{field.name}</Text>
                  </View>
                  <Switch value={enabled} onValueChange={(next) => toggleField(field.name, next)} />
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.fieldLabel}>Tag-template-only fields</Text>
              <Text style={styles.helpText}>Allow fields that exist only in a tag template (not in field definitions).</Text>
            </View>
            <Switch value={allowTagTemplateOnlyFields} onValueChange={setAllowTagTemplateOnlyFields} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 10, color: '#666' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFF',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  headerButton: { padding: 8 },
  headerButtonText: { color: '#007AFF', fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  helpText: { fontSize: 13, color: '#666' },
  emptyText: { marginTop: 10, color: '#666', fontStyle: 'italic' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  toggleTextWrap: { flex: 1, marginRight: 12 },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  fieldName: { fontSize: 12, color: '#666', marginTop: 2 },
});
