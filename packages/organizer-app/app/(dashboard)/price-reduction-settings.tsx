import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAdminOrganization, useAdminUser, updatePriceReductionSettings } from 'shared';
import { useState, useEffect } from 'react';

type ControlChoice = 'org' | 'seller';

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
    priceReductionValueControl: 'seller' as ControlChoice,
    priceReductionCountControl: 'seller' as ControlChoice,
    priceReductionTimingControl: 'seller' as ControlChoice,
    defaultReductionTime: '',
    allowedReductionTimes: [] as string[],
  });

  useEffect(() => {
    if (!organization) return;
    const prs = organization.priceReductionSettings;
    setSettings({
      priceReductionValueControl: prs.priceReductionValueControl ?? (prs.sellerCanSetReduction ? 'seller' : 'org'),
      priceReductionCountControl: prs.priceReductionCountControl ?? 'seller',
      priceReductionTimingControl: prs.priceReductionTimingControl ?? (prs.sellerCanSetTime ? 'seller' : 'org'),
      defaultReductionTime: prs.defaultReductionTime || '',
      allowedReductionTimes: prs.allowedReductionTimes || [],
    });
  }, [organization]);

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      await updatePriceReductionSettings(organization.id, {
        priceReductionValueControl: settings.priceReductionValueControl,
        priceReductionCountControl: settings.priceReductionCountControl,
        priceReductionTimingControl: settings.priceReductionTimingControl,
        sellerCanSetReduction: settings.priceReductionValueControl === 'seller',
        sellerCanSetTime:
          settings.priceReductionTimingControl === 'seller' &&
          settings.priceReductionCountControl === 'seller',
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

  const renderChoice = (
    value: ControlChoice,
    current: ControlChoice,
    setCurrent: (choice: ControlChoice) => void,
    label: string
  ) => (
    <TouchableOpacity
      style={[styles.radioOption, current === value && styles.radioOptionSelected]}
      onPress={() => setCurrent(value)}
    >
      <Text style={[styles.radioText, current === value && styles.radioTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

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
            <Text style={styles.label}>Type and amount</Text>
            <Text style={styles.helpText}>Who decides percent/flat and the reduction value.</Text>
            <View style={styles.radioGroup}>
              {renderChoice(
                'org',
                settings.priceReductionValueControl,
                (choice) => setSettings({ ...settings, priceReductionValueControl: choice }),
                'Org sets the price reduction by percent or flat amount'
              )}
              {renderChoice(
                'seller',
                settings.priceReductionValueControl,
                (choice) => setSettings({ ...settings, priceReductionValueControl: choice }),
                'Seller sets the price reduction by percent or flat amount'
              )}
            </View>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.label}>Number of reductions</Text>
            <Text style={styles.helpText}>Who decides how many reductions are configured.</Text>
            <View style={styles.radioGroup}>
              {renderChoice(
                'org',
                settings.priceReductionCountControl,
                (choice) => setSettings({ ...settings, priceReductionCountControl: choice }),
                'Org sets the number of price reductions'
              )}
              {renderChoice(
                'seller',
                settings.priceReductionCountControl,
                (choice) => setSettings({ ...settings, priceReductionCountControl: choice }),
                'Seller sets the number of price reductions and timing'
              )}
            </View>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.label}>Timing control</Text>
            <Text style={styles.helpText}>Who chooses when reductions happen.</Text>
            <View style={styles.radioGroup}>
              {renderChoice(
                'org',
                settings.priceReductionTimingControl,
                (choice) => setSettings({ ...settings, priceReductionTimingControl: choice }),
                'Organization sets timing'
              )}
              {renderChoice(
                'seller',
                settings.priceReductionTimingControl,
                (choice) => setSettings({ ...settings, priceReductionTimingControl: choice }),
                'Seller sets timing'
              )}
            </View>
          </View>

          {settings.priceReductionTimingControl === 'org' ? (
            <View style={styles.settingCard}>
              <Text style={styles.label}>Default Reduction Time</Text>
              <Text style={styles.helpText}>Time when reductions occur (HH:MM format, e.g., 16:00).</Text>
              <TextInput
                style={styles.textInput}
                value={settings.defaultReductionTime}
                onChangeText={(text) => setSettings({ ...settings, defaultReductionTime: text })}
                placeholder="16:00"
                keyboardType="default"
              />
            </View>
          ) : null}

          {settings.priceReductionTimingControl === 'seller' ? (
            <View style={styles.settingCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>Allowed Reduction Times</Text>
                <TouchableOpacity onPress={addAllowedTime} style={styles.addButton}>
                  <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helpText}>
                Times sellers can choose from (leave empty to allow any time).
              </Text>
              {settings.allowedReductionTimes.length > 0 ? (
                <View style={styles.timesList}>
                  {settings.allowedReductionTimes.map((time) => (
                    <View key={time} style={styles.timeChip}>
                      <Text style={styles.timeChipText}>{time}</Text>
                      <TouchableOpacity onPress={() => removeAllowedTime(time)} style={styles.removeTimeButton}>
                        <Text style={styles.removeTimeButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No restrictions - sellers can choose any time</Text>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <Text style={styles.infoText}>
            • Type and amount: choose whether org or seller controls percent/flat and value{'\n'}
            • Number of reductions: choose whether org or seller controls how many reductions apply{'\n'}
            • Timing control: choose whether org or seller sets reduction times{'\n'}
            • Allowed times: when seller timing is enabled, optionally restrict selectable times{'\n'}
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
  radioGroup: {
    marginTop: 8,
    gap: 10,
  },
  radioOption: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FBFD',
  },
  radioOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#EAF3FF',
  },
  radioText: {
    fontSize: 14,
    color: '#334155',
  },
  radioTextSelected: {
    color: '#0B5ED7',
    fontWeight: '600',
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








