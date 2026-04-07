import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAdminOrganization, useAdminUser, updatePriceReductionSettings } from 'shared';
import { useState, useEffect } from 'react';

export default function PriceReductionSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { organization, loading: orgLoading } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (adminUser && adminUser.role !== 'admin') router.replace('/(dashboard)');
  }, [adminUser, router]);

  const [settings, setSettings] = useState({
    sellerCanSetReduction: true,
    sellerCanSetTime: true,
    defaultReductionTime: '',
    allowedReductionTimes: [] as string[],
  });

  useEffect(() => {
    if (organization) {
      setSettings({
        sellerCanSetReduction: organization.priceReductionSettings.sellerCanSetReduction,
        sellerCanSetTime: organization.priceReductionSettings.sellerCanSetTime,
        defaultReductionTime: organization.priceReductionSettings.defaultReductionTime || '',
        allowedReductionTimes: organization.priceReductionSettings.allowedReductionTimes || [],
      });
    }
  }, [organization]);

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      await updatePriceReductionSettings(organization.id, {
        sellerCanSetReduction: settings.sellerCanSetReduction,
        sellerCanSetTime: settings.sellerCanSetTime,
        defaultReductionTime: settings.defaultReductionTime || undefined,
        allowedReductionTimes: settings.allowedReductionTimes,
      });
      Alert.alert('Success', 'Price reduction settings saved successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addAllowedTime = () => {
    Alert.prompt(
      'Add Allowed Time',
      'Enter time in HH:MM format (e.g., 16:00):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (time) => {
            if (time && /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
              if (!settings.allowedReductionTimes.includes(time)) {
                setSettings({
                  ...settings,
                  allowedReductionTimes: [...settings.allowedReductionTimes, time].sort(),
                });
              }
            } else {
              Alert.alert('Error', 'Please enter time in HH:MM format (e.g., 16:00)');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const removeAllowedTime = (time: string) => {
    setSettings({
      ...settings,
      allowedReductionTimes: settings.allowedReductionTimes.filter((t) => t !== time),
    });
  };

  if (orgLoading || adminUserLoading || !isAdmin) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
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
        <Text style={styles.title}>Price Reductions</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Control Settings</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.label}>Sellers Can Set Price Reductions</Text>
                <Text style={styles.helpText}>
                  Allow sellers to enable price reductions on their items
                </Text>
              </View>
              <Switch
                value={settings.sellerCanSetReduction}
                onValueChange={(value) => setSettings({ ...settings, sellerCanSetReduction: value })}
              />
            </View>
          </View>

          {settings.sellerCanSetReduction && (
            <View style={styles.settingCard}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.label}>Sellers Can Set Reduction Time</Text>
                  <Text style={styles.helpText}>
                    Allow sellers to choose when price reduction occurs
                  </Text>
                </View>
                <Switch
                  value={settings.sellerCanSetTime}
                  onValueChange={(value) => setSettings({ ...settings, sellerCanSetTime: value })}
                />
              </View>
            </View>
          )}

          {settings.sellerCanSetReduction && !settings.sellerCanSetTime && (
            <View style={styles.settingCard}>
              <Text style={styles.label}>Default Reduction Time</Text>
              <Text style={styles.helpText}>
                Time when price reductions occur (HH:MM format, e.g., 16:00)
              </Text>
              <TextInput
                style={styles.textInput}
                value={settings.defaultReductionTime}
                onChangeText={(text) => setSettings({ ...settings, defaultReductionTime: text })}
                placeholder="16:00"
                keyboardType="default"
              />
            </View>
          )}

          {settings.sellerCanSetReduction && settings.sellerCanSetTime && (
            <View style={styles.settingCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>Allowed Reduction Times</Text>
                <TouchableOpacity onPress={addAllowedTime} style={styles.addButton}>
                  <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helpText}>
                Times sellers can choose from (leave empty to allow any time)
              </Text>
              {settings.allowedReductionTimes.length > 0 ? (
                <View style={styles.timesList}>
                  {settings.allowedReductionTimes.map((time) => (
                    <View key={time} style={styles.timeChip}>
                      <Text style={styles.timeChipText}>{time}</Text>
                      <TouchableOpacity
                        onPress={() => removeAllowedTime(time)}
                        style={styles.removeTimeButton}
                      >
                        <Text style={styles.removeTimeButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No restrictions - sellers can choose any time</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <Text style={styles.infoText}>
            • If sellers can set reductions: Sellers can enable price reductions when adding items{'\n'}
            • If sellers can set time: Sellers choose when reduction occurs{'\n'}
            • If org controls time: All reductions happen at the default time{'\n'}
            • Allowed times: Restrict sellers to specific times (optional){'\n'}
            • Price reduction info will appear on item tags
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#007AFF',
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
    color: '#1A1A1A',
    marginBottom: 16,
  },
  settingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
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
    color: '#1A1A1A',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  addButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  timesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  timeChipText: {
    fontSize: 14,
    color: '#1A1A1A',
    marginRight: 8,
  },
  removeTimeButton: {
    padding: 4,
  },
  removeTimeButtonText: {
    fontSize: 18,
    color: '#DC3545',
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
});








