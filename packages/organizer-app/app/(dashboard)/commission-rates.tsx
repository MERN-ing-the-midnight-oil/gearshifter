import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAdminOrganization, useAdminUser, updateCommissionRates } from 'shared';
import { useState, useEffect } from 'react';
import { theme } from '../../lib/theme';

export default function CommissionRatesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { organization, loading: orgLoading } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';
  const [saving, setSaving] = useState(false);

  // Commission rates are admin-only — redirect volunteers
  useEffect(() => {
    if (adminUserLoading || !adminUser) return;
    if (adminUser.role !== 'admin') {
      router.replace('/(dashboard)');
    }
  }, [adminUser, adminUserLoading, router]);

  const [commissionRate, setCommissionRate] = useState<string>('');
  const [vendorCommissionRate, setVendorCommissionRate] = useState<string>('');
  const [enableCommission, setEnableCommission] = useState(false);
  const [enableVendorCommission, setEnableVendorCommission] = useState(false);

  useEffect(() => {
    if (organization) {
      const hasCommission = organization.commissionRate != null;
      const hasVendorCommission = organization.vendorCommissionRate != null;
      
      setEnableCommission(hasCommission);
      setEnableVendorCommission(hasVendorCommission);
      setCommissionRate(hasCommission ? (organization.commissionRate * 100).toString() : '');
      setVendorCommissionRate(hasVendorCommission ? (organization.vendorCommissionRate * 100).toString() : '');
    }
  }, [organization]);

  const handleSave = async () => {
    if (!organization) return;

    // Validate rates if enabled
    if (enableCommission) {
      const rate = parseFloat(commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        Alert.alert('Error', 'Commission rate must be between 0 and 100');
        return;
      }
    }

    if (enableVendorCommission) {
      const rate = parseFloat(vendorCommissionRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        Alert.alert('Error', 'Vendor commission rate must be between 0 and 100');
        return;
      }
    }

    setSaving(true);
    try {
      await updateCommissionRates(organization.id, {
        commissionRate: enableCommission ? parseFloat(commissionRate) / 100 : null,
        vendorCommissionRate: enableVendorCommission ? parseFloat(vendorCommissionRate) / 100 : null,
      });
      Alert.alert('Success', 'Commission rates saved successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save commission rates');
    } finally {
      setSaving(false);
    }
  };

  if (orgLoading || adminUserLoading || !isAdmin) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
        <Text style={styles.loadingText}>
          {orgLoading || adminUserLoading ? 'Loading...' : 'Redirecting...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Commission Rates</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commission Settings</Text>
          <Text style={styles.description}>
            Configure commission rates for your organization. You can set rates for regular sellers and vendors separately, or disable commissions entirely.
          </Text>

          <View style={styles.settingCard}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.label}>Regular Seller Commission</Text>
                <Text style={styles.helpText}>
                  Percentage of sale price kept by organization for regular sellers
                </Text>
              </View>
              <Switch
                value={enableCommission}
                onValueChange={(value) => {
                  setEnableCommission(value);
                  if (!value) {
                    setCommissionRate('');
                  }
                }}
                trackColor={{ false: theme.border, true: theme.button }}
                thumbColor={theme.surface}
              />
            </View>

            {enableCommission && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Commission Rate (%)</Text>
                <TextInput
                  style={styles.textInput}
                  value={commissionRate}
                  onChangeText={setCommissionRate}
                  placeholder="25"
                  keyboardType="decimal-pad"
                  editable={!saving}
                />
                <Text style={styles.helpText}>
                  Enter as percentage (e.g., 25 for 25%)
                </Text>
              </View>
            )}
          </View>

          <View style={styles.settingCard}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.label}>Vendor Commission</Text>
                <Text style={styles.helpText}>
                  Percentage of sale price kept by organization for business vendors
                </Text>
              </View>
              <Switch
                value={enableVendorCommission}
                onValueChange={(value) => {
                  setEnableVendorCommission(value);
                  if (!value) {
                    setVendorCommissionRate('');
                  }
                }}
                trackColor={{ false: theme.border, true: theme.button }}
                thumbColor={theme.surface}
              />
            </View>

            {enableVendorCommission && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Vendor Commission Rate (%)</Text>
                <TextInput
                  style={styles.textInput}
                  value={vendorCommissionRate}
                  onChangeText={setVendorCommissionRate}
                  placeholder="20"
                  keyboardType="decimal-pad"
                  editable={!saving}
                />
                <Text style={styles.helpText}>
                  Enter as percentage (e.g., 20 for 20%)
                </Text>
              </View>
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>ℹ️ About Commission Rates</Text>
            <Text style={styles.infoText}>
              • Commission rates are optional - you can disable them entirely{'\n'}
              • Regular seller commission applies to individual sellers{'\n'}
              • Vendor commission applies to business vendors (when vendor support is implemented){'\n'}
              • If no commission rate is set, sellers receive 100% of the sale price
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: theme.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 40,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.link,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: theme.link,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  settingCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  helpText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
  },
  inputContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
  },
  infoCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});

