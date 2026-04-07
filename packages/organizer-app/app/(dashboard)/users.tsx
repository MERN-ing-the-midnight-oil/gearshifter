import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAdminOrganization, useAdminUser, createVolunteerAccount, getOrgUsers } from 'shared';
import { useState, useEffect } from 'react';
import { theme } from '../../lib/theme';

interface OrgUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'admin' | 'volunteer';
  created_at: string;
}

export default function UsersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { organization } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id || null);
  
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const isAdmin = adminUser?.role === 'admin';

  useEffect(() => {
    if (organization && isAdmin) {
      loadUsers();
    }
  }, [organization, isAdmin]);

  // Redirect volunteers away from this screen (admin-only)
  useEffect(() => {
    if (adminUserLoading || !adminUser) return;
    if (adminUser.role !== 'admin') {
      router.replace('/(dashboard)');
    }
  }, [adminUser, adminUserLoading, router]);

  const loadUsers = async () => {
    if (!organization) return;
    
    try {
      setLoading(true);
      const data = await getOrgUsers(organization.id);
      setUsers(data as OrgUser[]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVolunteer = async () => {
    if (!organization) {
      Alert.alert('Error', 'Organization not found');
      return;
    }

    // Validate form
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Alert.alert('Error', 'Please enter first and last name');
      return;
    }

    if (!formData.email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await createVolunteerAccount({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        organizationId: organization.id,
      });

      Alert.alert(
        'Success',
        'Volunteer account created successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowCreateForm(false);
              setFormData({
                firstName: '',
                lastName: '',
                email: '',
                password: '',
                confirmPassword: '',
              });
              loadUsers();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create volunteer account');
    } finally {
      setSubmitting(false);
    }
  };

  // Redirecting or still loading admin role — show minimal UI
  if (adminUserLoading || !isAdmin) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
        <Text style={styles.loadingText}>
          {adminUserLoading ? 'Loading...' : 'Redirecting...'}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Team Members</Text>
        {organization && (
          <Text style={styles.organizationName}>{organization.name}</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Organization Users</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCreateForm(!showCreateForm)}
          >
            <Text style={styles.addButtonText}>
              {showCreateForm ? '− Cancel' : '+ Add Volunteer'}
            </Text>
          </TouchableOpacity>
        </View>

        {showCreateForm && (
          <View style={styles.createForm}>
            <Text style={styles.formTitle}>Create Volunteer Account</Text>
            
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              placeholder="Enter first name"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              placeholder="Enter last name"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="Enter email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              placeholder="Enter password (min 6 characters)"
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              placeholder="Confirm password"
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleCreateVolunteer}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={theme.buttonText} />
              ) : (
                <Text style={styles.submitButtonText}>Create Volunteer Account</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No team members yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Create volunteer accounts to allow others to help manage your swap events
            </Text>
          </View>
        ) : (
          <View style={styles.usersList}>
            {users.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userCardContent}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {user.first_name} {user.last_name}
                    </Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                  </View>
                  <View style={[
                    styles.roleBadge,
                    user.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeVolunteer
                  ]}>
                    <Text style={styles.roleBadgeText}>
                      Org User · {user.role === 'admin' ? 'Admin' : 'Volunteer'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
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
    padding: 20,
    paddingTop: 40,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.link,
    fontWeight: '500',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  organizationName: {
    fontSize: 18,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  addButton: {
    backgroundColor: theme.button,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: theme.buttonText,
    fontSize: 14,
    fontWeight: '600',
  },
  createForm: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.text,
  },
  submitButton: {
    backgroundColor: theme.button,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  usersList: {
    marginTop: 8,
  },
  userCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleBadgeAdmin: {
    backgroundColor: theme.primary,
  },
  roleBadgeVolunteer: {
    backgroundColor: theme.secondary,
  },
  roleBadgeText: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.error,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
});

