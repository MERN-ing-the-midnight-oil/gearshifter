/**
 * Thermal seller receipt layouts (printed from POS using the same hardware as gear tags).
 */
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  useAuth,
  useAdminOrganization,
  useAdminUser,
  getOrganizationSellerReceiptTemplates,
  getOrganizationGearTagTemplates,
  createSellerReceiptTemplate,
  updateSellerReceiptTemplate,
  deleteSellerReceiptTemplate,
  seedSellerReceiptTemplatesFromGearTagTemplates,
  DEFAULT_SELLER_RECEIPT_TAG_FIELDS,
  SELLER_RECEIPT_AVAILABLE_FIELDS,
  FORM_CONTROL_MAX_WIDTH,
  type SellerReceiptTemplate,
  type GearTagTemplate,
  type TagField,
  type QRCodePosition,
  type TagPrintOrientation,
  type TagLayoutType,
} from 'shared';
import { useState, useEffect, useCallback } from 'react';
import TagPreviewMockup from '../../components/TagPreviewMockup';

const QR_POSITIONS: { value: QRCodePosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'center', label: 'Center' },
];

function orientationFromMm(widthMm: string, heightMm: string): TagPrintOrientation {
  const w = parseFloat(widthMm) || 0;
  const h = parseFloat(heightMm) || 0;
  return w > h ? 'landscape' : 'portrait';
}

function blankTagFieldForReceiptField(fieldName: string): TagField | null {
  const meta = SELLER_RECEIPT_AVAILABLE_FIELDS.find((f) => f.name === fieldName);
  if (!meta) return null;
  const fmt =
    fieldName === 'sold_price' || fieldName === 'seller_amount' || fieldName === 'commission_amount'
      ? '$%.2f'
      : undefined;
  return {
    field: fieldName,
    label: meta.defaultLabel || meta.label,
    hideLabelOnTag: fieldName === 'sale_summary',
    maxLength: fieldName === 'item_description' ? 60 : fieldName === 'sale_summary' ? 140 : 36,
    fontSize: fieldName === 'sold_price' || fieldName === 'buyer_name' ? 11 : 10,
    fontWeight: fieldName === 'sold_price' || fieldName === 'buyer_name' ? 'bold' : 'normal',
    required: false,
    ...(fmt ? { format: fmt, dataType: 'number' as const } : { dataType: 'text' as const }),
  };
}

export default function SellerReceiptsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width > 760;
  const { user } = useAuth();
  const { organization } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';
  const [templates, setTemplates] = useState<SellerReceiptTemplate[]>([]);
  const [gearTags, setGearTags] = useState<GearTagTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedingFromGearTags, setSeedingFromGearTags] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SellerReceiptTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    layoutType: 'standard' as TagLayoutType,
    widthMm: '58',
    heightMm: '80',
    tagFields: [] as TagField[],
    qrCodeSize: '14',
    qrCodePosition: 'bottom-right' as QRCodePosition,
    qrCodeOffsetXMm: '0',
    qrCodeOffsetYMm: '0',
    qrCodeEnabled: false,
    tagOrientation: 'portrait' as TagPrintOrientation,
    isDefault: false,
  });

  useEffect(() => {
    if (adminUser && adminUser.role !== 'admin') router.replace('/(dashboard)');
  }, [adminUser, router]);

  const loadData = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const [sellerRows, tagRows] = await Promise.all([
        getOrganizationSellerReceiptTemplates(organization.id),
        getOrganizationGearTagTemplates(organization.id),
      ]);
      setTemplates(sellerRows);
      setGearTags(tagRows);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load receipt templates');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  const handleSeedFromItemTagSizes = async () => {
    if (!organization?.id) return;
    if (gearTags.length === 0) {
      Alert.alert(
        'No item tag templates',
        'Create item tag templates under Item Registration/Tags first. Each one can spawn a seller receipt with the same label size.'
      );
      return;
    }
    setSeedingFromGearTags(true);
    try {
      const { created, skipped } = await seedSellerReceiptTemplatesFromGearTagTemplates(organization.id);
      await loadData();
      if (created === 0 && skipped > 0) {
        Alert.alert(
          'Already up to date',
          `All ${skipped} item tag template(s) already have a matching seller receipt.`
        );
      } else {
        Alert.alert(
          'Done',
          `Created ${created} seller receipt template(s) from item tag sizes.${
            skipped > 0 ? ` Skipped ${skipped} that were already linked.` : ''
          }`
        );
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create templates');
    } finally {
      setSeedingFromGearTags(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!organization?.id) {
        setLoading(false);
        return;
      }
      void loadData();
    }, [organization?.id, loadData])
  );

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setFormData({
      name: '',
      layoutType: 'standard',
      widthMm: '58',
      heightMm: '80',
      tagFields: [],
      qrCodeSize: '14',
      qrCodePosition: 'bottom-right',
      qrCodeOffsetXMm: '0',
      qrCodeOffsetYMm: '0',
      qrCodeEnabled: false,
      tagOrientation: 'portrait',
      isDefault: false,
    });
  };

  const startCreate = () => {
    const names = new Set(templates.map((t) => t.name));
    let name = 'Default seller receipt';
    let n = 1;
    while (names.has(name)) {
      n += 1;
      name = `Seller receipt (${n})`;
    }
    setEditing(null);
    setFormData({
      name,
      layoutType: 'standard',
      widthMm: '58',
      heightMm: '80',
      tagFields: DEFAULT_SELLER_RECEIPT_TAG_FIELDS.map((tf) => ({ ...tf })),
      qrCodeSize: '14',
      qrCodePosition: 'bottom-right',
      qrCodeOffsetXMm: '0',
      qrCodeOffsetYMm: '0',
      qrCodeEnabled: false,
      tagOrientation: orientationFromMm('58', '80'),
      isDefault: templates.length === 0,
    });
    setShowForm(true);
  };

  const startEdit = (t: SellerReceiptTemplate) => {
    setEditing(t);
    setFormData({
      name: t.name,
      layoutType: t.layoutType,
      widthMm: String(t.widthMm),
      heightMm: String(t.heightMm),
      tagFields: t.tagFields.map((f) => ({ ...f })),
      qrCodeSize: String(t.qrCodeSize),
      qrCodePosition: t.qrCodePosition,
      qrCodeOffsetXMm: String(t.qrCodeOffsetXMm ?? 0),
      qrCodeOffsetYMm: String(t.qrCodeOffsetYMm ?? 0),
      qrCodeEnabled: t.qrCodeEnabled,
      tagOrientation: t.tagOrientation ?? orientationFromMm(String(t.widthMm), String(t.heightMm)),
      isDefault: t.isDefault,
    });
    setShowForm(true);
  };

  const addFieldNamed = (fieldName: string) => {
    if (formData.tagFields.some((f) => f.field === fieldName)) return;
    const next = blankTagFieldForReceiptField(fieldName);
    if (!next) return;
    setFormData((fd) => ({ ...fd, tagFields: [...fd.tagFields, next] }));
  };

  const moveField = (index: number, dir: 'up' | 'down') => {
    setFormData((fd) => {
      const nf = [...fd.tagFields];
      const j = dir === 'up' ? index - 1 : index + 1;
      if (j < 0 || j >= nf.length) return fd;
      [nf[index], nf[j]] = [nf[j], nf[index]];
      return { ...fd, tagFields: nf };
    });
  };

  const removeFieldAt = (index: number) => {
    setFormData((fd) => ({
      ...fd,
      tagFields: fd.tagFields.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!organization) return;
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Template name is required');
      return;
    }
    if (formData.tagFields.length === 0) {
      Alert.alert('Error', 'Add at least one field to the receipt.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateSellerReceiptTemplate(editing.id, {
          name: formData.name.trim(),
          layoutType: formData.layoutType,
          widthMm: parseFloat(formData.widthMm),
          heightMm: parseFloat(formData.heightMm),
          tagFields: formData.tagFields,
          qrCodeSize: parseFloat(formData.qrCodeSize),
          qrCodePosition: formData.qrCodePosition,
          qrCodeOffsetXMm: parseFloat(formData.qrCodeOffsetXMm) || 0,
          qrCodeOffsetYMm: parseFloat(formData.qrCodeOffsetYMm) || 0,
          qrCodeEnabled: formData.qrCodeEnabled,
          tagOrientation: formData.tagOrientation,
          isDefault: formData.isDefault,
        });
      } else {
        await createSellerReceiptTemplate(organization.id, {
          name: formData.name.trim(),
          layoutType: formData.layoutType,
          widthMm: parseFloat(formData.widthMm),
          heightMm: parseFloat(formData.heightMm),
          tagFields: formData.tagFields,
          qrCodeSize: parseFloat(formData.qrCodeSize),
          qrCodePosition: formData.qrCodePosition,
          qrCodeOffsetXMm: parseFloat(formData.qrCodeOffsetXMm) || 0,
          qrCodeOffsetYMm: parseFloat(formData.qrCodeOffsetYMm) || 0,
          qrCodeEnabled: formData.qrCodeEnabled,
          tagOrientation: formData.tagOrientation,
          isDefault: formData.isDefault,
        });
      }
      Alert.alert('Success', 'Receipt template saved');
      resetForm();
      await loadData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (t: SellerReceiptTemplate) => {
    const run = async () => {
      try {
        await deleteSellerReceiptTemplate(t.id);
        await loadData();
        Alert.alert('Deleted', '');
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed');
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Delete "${t.name}"?`)) void run();
    } else {
      Alert.alert('Delete template', `Delete "${t.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void run() },
      ]);
    }
  };

  if (adminUserLoading || !isAdmin) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (showForm ? resetForm() : router.back())}>
          <Text style={styles.back}>{showForm ? '← Cancel' : '← Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Seller receipts</Text>
        {showForm ? (
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={styles.save}>{saving ? '…' : 'Save'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={startCreate}>
            <Text style={styles.save}>+ New</Text>
          </TouchableOpacity>
        )}
      </View>

      {!showForm ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={styles.help}>
              New templates default to one line: Sold to (buyer) at (date and time) for (sale amount). Sizes match
              your item tag templates when you use “Create from item tag sizes.” Turn on QR to add the buyer’s full
              digital receipt link.
            </Text>

            {gearTags.length > 0 ? (
              <TouchableOpacity
                style={[styles.seedButton, seedingFromGearTags && styles.seedButtonDisabled]}
                onPress={handleSeedFromItemTagSizes}
                disabled={seedingFromGearTags}
              >
                {seedingFromGearTags ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.seedButtonText}>
                    Create seller receipts from item tag sizes ({gearTags.length} tag
                    {gearTags.length === 1 ? '' : 's'})
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={styles.mutedHelp}>
                Add item tag templates under Item Registration/Tags to copy each tag’s width and height as a seller
                receipt layout in one tap.
              </Text>
            )}

            {templates.map((t) => (
              <Pressable key={t.id} style={styles.tile} onPress={() => startEdit(t)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tileTitle}>
                    {t.name}
                    {t.isDefault ? ' ★' : ''}
                  </Text>
                  <Text style={styles.tileMeta}>
                    {t.widthMm}×{t.heightMm} mm · QR {t.qrCodeEnabled ? 'on' : 'off'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(t)}
                  hitSlop={10}
                  style={styles.delBtn}
                >
                  <Text style={styles.delBtnText}>Delete</Text>
                </TouchableOpacity>
              </Pressable>
            ))}
          </ScrollView>
        )
      ) : (
        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={[styles.formInner, !isWide && { maxWidth: FORM_CONTROL_MAX_WIDTH }]}
        >
          <Text style={styles.sectionLabel}>Template name</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(name) => setFormData((f) => ({ ...f, name }))}
            placeholder="e.g. Swap receipt"
          />

          <Text style={styles.sectionLabel}>Label size (mm)</Text>
          <View style={styles.row2}>
            <TextInput
              style={[styles.input, styles.half]}
              value={formData.widthMm}
              onChangeText={(widthMm) =>
                setFormData((f) => ({
                  ...f,
                  widthMm,
                  tagOrientation: orientationFromMm(widthMm, f.heightMm),
                }))
              }
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, styles.half]}
              value={formData.heightMm}
              onChangeText={(heightMm) =>
                setFormData((f) => ({
                  ...f,
                  heightMm,
                  tagOrientation: orientationFromMm(f.widthMm, heightMm),
                }))
              }
              keyboardType="decimal-pad"
            />
          </View>

          <View style={[styles.previewRow, isWide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
            <View style={[isWide && { flex: 1 }]}>
              <Text style={styles.sectionLabel}>Fields (tap to add)</Text>
              <View style={styles.addGrid}>
                {SELLER_RECEIPT_AVAILABLE_FIELDS.map((af) => {
                  const here = formData.tagFields.some((x) => x.field === af.name);
                  return (
                    <TouchableOpacity
                      key={af.name}
                      style={[styles.addChip, here && styles.addChipMuted]}
                      onPress={() => addFieldNamed(af.name)}
                      disabled={here}
                    >
                      <Text style={styles.addChipText}>{af.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.sectionLabel}>Receipt lines</Text>
              {formData.tagFields.map((tf, idx) => (
                <View key={`${tf.field}-${idx}`} style={styles.lineRow}>
                  <Text style={styles.lineText} numberOfLines={1}>
                    {tf.label || tf.field}
                  </Text>
                  <View style={styles.lineActions}>
                    <TouchableOpacity onPress={() => moveField(idx, 'up')}>
                      <Text style={styles.lineBtn}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveField(idx, 'down')}>
                      <Text style={styles.lineBtn}>↓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeFieldAt(idx)}>
                      <Text style={[styles.lineBtn, { color: '#B91C1C' }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
            <View style={[styles.previewAside, isWide && { flex: 1 }]}>
              <TagPreviewMockup
                widthMm={parseFloat(formData.widthMm) || 58}
                heightMm={parseFloat(formData.heightMm) || 80}
                tagFields={formData.tagFields}
                qrCodePosition={formData.qrCodePosition}
                qrCodeSize={parseFloat(formData.qrCodeSize) || 14}
                qrCodeOffsetXMm={parseFloat(formData.qrCodeOffsetXMm) || 0}
                qrCodeOffsetYMm={parseFloat(formData.qrCodeOffsetYMm) || 0}
                tagOrientation={formData.tagOrientation}
                availableFields={SELLER_RECEIPT_AVAILABLE_FIELDS}
              />
              {formData.qrCodeEnabled ? (
                <Text style={styles.qrLegend}>QR preview marks where the encoded buyer receipt link will print.</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Default template</Text>
              <Text style={styles.switchHelp}>Used when no other template is selected in POS.</Text>
            </View>
            <Switch value={formData.isDefault} onValueChange={(v) => setFormData((f) => ({ ...f, isDefault: v }))} />
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Buyer receipt QR (optional)</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Encode digital receipt URL</Text>
              <Text style={styles.switchHelp}>Scanning opens the buyer’s full receipt page (photos, exit QR, etc.).</Text>
            </View>
            <Switch
              value={formData.qrCodeEnabled}
              onValueChange={(qrCodeEnabled) => setFormData((f) => ({ ...f, qrCodeEnabled }))}
            />
          </View>
          {formData.qrCodeEnabled ? (
            <>
              <Text style={styles.miniLabel}>Position</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.posScroll}>
                {QR_POSITIONS.map((p) => (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.posChip, formData.qrCodePosition === p.value && styles.posChipOn]}
                    onPress={() => setFormData((f) => ({ ...f, qrCodePosition: p.value }))}
                  >
                    <Text style={styles.posChipText}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.miniLabel}>QR size (mm)</Text>
              <TextInput
                style={styles.input}
                value={formData.qrCodeSize}
                onChangeText={(qrCodeSize) => setFormData((f) => ({ ...f, qrCodeSize }))}
                keyboardType="decimal-pad"
              />
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EAF0',
    backgroundColor: '#fff',
  },
  back: { color: '#2563EB', fontSize: 16 },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  save: { color: '#2563EB', fontSize: 16, fontWeight: '700' },
  list: { flex: 1 },
  help: { fontSize: 14, color: '#57534E', lineHeight: 20, marginBottom: 14 },
  mutedHelp: { fontSize: 13, color: '#94A3B8', lineHeight: 19, marginBottom: 16, fontStyle: 'italic' },
  seedButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  seedButtonDisabled: { opacity: 0.65 },
  seedButtonText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E7EEF6',
  },
  tileTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  tileMeta: { marginTop: 4, fontSize: 13, color: '#64748B' },
  delBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  delBtnText: { color: '#B91C1C', fontSize: 14, fontWeight: '600' },
  formScroll: { flex: 1 },
  formInner: { padding: 16, paddingBottom: 48 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 6, marginTop: 14, color: '#1e293b' },
  miniLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D9E6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  row2: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  addGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  addChip: { backgroundColor: '#E0EAFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addChipMuted: { opacity: 0.45 },
  addChipText: { fontSize: 13, color: '#1E3A8A', fontWeight: '600' },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  lineText: { flex: 1, fontSize: 14, color: '#334155' },
  lineActions: { flexDirection: 'row', gap: 8 },
  lineBtn: { fontSize: 18, paddingHorizontal: 4, color: '#2563EB' },
  previewRow: { marginTop: 8, gap: 16 },
  previewAside: { marginTop: 8 },
  qrLegend: { fontSize: 12, color: '#64748B', marginTop: 8, textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 },
  switchTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  switchHelp: { fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 18 },
  posScroll: { marginBottom: 8, maxHeight: 44 },
  posChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  posChipOn: { backgroundColor: '#BFDBFE' },
  posChipText: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
});
