import { useEffect, useState } from 'react';
import { getAdminUser } from '../api/auth';
import type { AdminPermissions } from '../types/models';

export interface AdminUserInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  organization_id: string;
  role: 'admin' | 'volunteer';
  is_org_admin: boolean;
  permissions: AdminPermissions;
}

export function useAdminUser(userId: string | null) {
  const [adminUser, setAdminUser] = useState<AdminUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setAdminUser(null);
      return;
    }

    loadAdminUser();
  }, [userId]);

  const loadAdminUser = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getAdminUser(userId);
      setAdminUser(data);
      // Log who is logged on and whether they are org admin or volunteer (for debugging)
      const roleLabel = data.is_org_admin ? 'Org Admin' : 'Volunteer';
      console.log('[useAdminUser] Logged-in user:', {
        userId: data.id,
        email: data.email,
        name: `${data.first_name} ${data.last_name}`,
        role: data.role,
        is_org_admin: data.is_org_admin,
        effectiveLabel: roleLabel,
        summary: `${data.first_name} ${data.last_name} (${data.email}) — ${roleLabel}`,
      });
    } catch (err) {
      console.log('[useAdminUser] No admin/volunteer record for userId:', userId, '(error:', err instanceof Error ? err.message : err, ')');
      setError(err instanceof Error ? err : new Error('Failed to load admin user'));
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  };

  return { adminUser, loading, error, refetch: loadAdminUser };
}

