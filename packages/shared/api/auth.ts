import { supabase } from './supabase';
import { createSeller } from './sellers';
import { createOrganization } from './organizations';
import type { AdminCapabilities, AdminPermissions } from '../types/models';

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
}

export interface SellerSignUpCredentials {
  email: string; // Permanent, tied to account
  password: string;
  phone: string; // Can be changed later
  firstName: string; // Can be changed later
  lastName: string; // Can be changed later
}

export interface AdminSignUpCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  organizationSlug: string;
  commissionRate?: number;
  vendorCommissionRate?: number;
}

export interface PhoneAuthCredentials {
  phone: string;
}

/**
 * Sign in with email and password (for admin users)
 */
export const signInWithEmail = async (credentials: SignInCredentials) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) throw error;
  // Clear skip-auto-login so next app load can auto-login in dev if desired
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('auth:skipAutoLogin');
  }
  return data;
};

/**
 * Sign up with email and password (for admin users)
 */
export const signUpWithEmail = async (credentials: SignUpCredentials) => {
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: {
        first_name: credentials.firstName,
        last_name: credentials.lastName,
        phone: credentials.phone,
      },
    },
  });

  if (error) throw error;
  return data;
};

/**
 * Sign in with phone number (for sellers)
 * Sends OTP via SMS
 */
export const signInWithPhone = async (credentials: PhoneAuthCredentials) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: credentials.phone,
    options: {
      channel: 'sms',
    },
  });

  if (error) throw error;
  return data;
};

/**
 * Verify OTP code sent to phone
 */
export const verifyPhoneOTP = async (phone: string, token: string) => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });

  if (error) throw error;
  return data;
};

/**
 * Send password reset email (organizer email/password accounts).
 * Configure redirect URLs in Supabase Auth settings; pass `redirectTo` for deep links to reset-password.
 */
export const sendPasswordResetEmail = async (
  email: string,
  options?: { redirectTo?: string }
) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: options?.redirectTo,
  });
  if (error) throw error;
};

/**
 * Set a new password for the current session (e.g. after PASSWORD_RECOVERY deep link).
 */
export const updateAuthenticatedUserPassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

/**
 * Sign out current user
 */
export const signOut = async () => {
  console.log('[signOut] Starting sign out process...');
  // Set before signOut so useAuth’s effect (triggered by auth state change) sees it and skips auto-login
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('auth:skipAutoLogin', '1');
  }

  // Check current session before signing out
  const { data: { session: beforeSession } } = await supabase.auth.getSession();
  console.log('[signOut] Session before sign out:', {
    hasSession: !!beforeSession,
    userId: beforeSession?.user?.id,
    email: beforeSession?.user?.email,
  });
  
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('[signOut] Error signing out:', {
      message: error.message,
      status: error.status,
      name: error.name,
    });
    throw error;
  }

  console.log('[signOut] Sign out completed');
  
  // Verify session is cleared
  const { data: { session: afterSession } } = await supabase.auth.getSession();
  console.log('[signOut] Session after sign out:', {
    hasSession: !!afterSession,
    userId: afterSession?.user?.id,
  });
  
  if (afterSession) {
    console.warn('[signOut] WARNING: Session still exists after sign out!');
  } else {
    console.log('[signOut] Sign out successful - session cleared');
  }
};

/**
 * Get current session
 */
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

/**
 * Get current user
 */
export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
};

/**
 * Sign up as a seller with email and password
 * Email is permanent and tied to the account
 * First name, last name, and phone can be changed later
 */
export const signUpAsSeller = async (credentials: SellerSignUpCredentials) => {
  // First, create the auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Failed to create user');

  // Then create the seller profile
  const seller = await createSeller(authData.user.id, {
    email: credentials.email, // Permanent
    firstName: credentials.firstName,
    lastName: credentials.lastName,
    phone: credentials.phone,
  });

  return {
    user: authData.user,
    seller,
  };
};

/**
 * Sign up as an admin/organizer with email and password
 * Creates auth user, organization, and admin_users record
 */
export const signUpAsAdmin = async (credentials: AdminSignUpCredentials) => {
  console.log('[signUpAsAdmin] Starting signup process for:', credentials.email);
  
  // First, create the auth user
  console.log('[signUpAsAdmin] Step 1: Creating auth user...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
  });

  if (authError) {
    console.error('[signUpAsAdmin] Auth user creation failed:', authError);
    throw authError;
  }
  if (!authData.user) {
    console.error('[signUpAsAdmin] Auth user creation returned no user');
    throw new Error('Failed to create user');
  }
  
  console.log('[signUpAsAdmin] Auth user created:', authData.user.id);

  // Then create the organization
  console.log('[signUpAsAdmin] Step 2: Creating organization...');
  const organization = await createOrganization({
    name: credentials.organizationName,
    slug: credentials.organizationSlug,
    commissionRate: credentials.commissionRate,
    vendorCommissionRate: credentials.vendorCommissionRate,
  });
  
  console.log('[signUpAsAdmin] Organization created:', organization.id, organization.name);

  // Finally, create the admin_users record (first user is always org admin)
  console.log('[signUpAsAdmin] Step 3: Creating admin_users record...');
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .insert({
      id: authData.user.id,
      organization_id: organization.id,
      first_name: credentials.firstName,
      last_name: credentials.lastName,
      email: credentials.email,
      role: 'admin',
      is_org_admin: true,
      permissions: {
        stations: {
          check_in: true,
          pos: true,
          pickup: true,
          reports: true,
        },
      },
    })
    .select()
    .single();

  if (adminError) {
    // If admin creation fails, try to clean up the organization
    // (though this might fail due to RLS, it's worth trying)
    console.error('[signUpAsAdmin] Failed to create admin user:', adminError);
    console.error('[signUpAsAdmin] Error details:', {
      message: adminError.message,
      details: adminError.details,
      hint: adminError.hint,
      code: adminError.code,
    });
    throw adminError;
  }

  console.log('[signUpAsAdmin] Admin user created successfully:', adminUser.id);
  console.log('[signUpAsAdmin] Signup complete!');

  return {
    user: authData.user,
    organization,
    adminUser,
  };
};

const DEFAULT_PERMISSIONS: AdminPermissions = {
  stations: { check_in: true, pos: true, pickup: true, reports: true },
};

function normalizeAdminCapabilities(raw: unknown): AdminCapabilities {
  const d: AdminCapabilities = {
    create_users: true,
    change_passwords: true,
    manage_events: true,
    organization_settings: true,
    financial_reports: true,
  };
  if (!raw || typeof raw !== 'object') return d;
  const a = raw as Record<string, unknown>;
  return {
    create_users: a.create_users !== false,
    change_passwords: a.change_passwords !== false,
    manage_events: a.manage_events !== false,
    organization_settings: a.organization_settings !== false,
    financial_reports: a.financial_reports !== false,
  };
}

/** Normalize DB permissions (flat or nested) to AdminPermissions. */
function normalizePermissions(raw: unknown): AdminPermissions {
  if (!raw || typeof raw !== 'object') return DEFAULT_PERMISSIONS;
  const p = raw as Record<string, unknown>;
  const stations = p.stations as Record<string, boolean> | undefined;
  let result: AdminPermissions;
  if (stations && typeof stations === 'object') {
    result = {
      stations: {
        check_in: !!stations.check_in,
        pos: !!stations.pos,
        pickup: !!stations.pickup,
        reports: !!stations.reports,
      },
    };
  } else {
    result = {
      stations: {
        check_in: !!(p.check_in ?? true),
        pos: !!(p.pos ?? true),
        pickup: !!(p.pickup ?? true),
        reports: !!(p.reports ?? true),
      },
    };
  }
  if (p.admin !== undefined && p.admin !== null && typeof p.admin === 'object') {
    result = { ...result, admin: normalizeAdminCapabilities(p.admin) };
  }
  return result;
}

/**
 * Get typed permissions for the current (or given) admin user.
 * Returns default full access if user not found (e.g. before migration).
 */
export const getUserPermissions = async (userId: string | null): Promise<AdminPermissions | null> => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('admin_users')
    .select('permissions, is_org_admin')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return normalizePermissions(data.permissions);
};

/**
 * Get admin user information by user ID
 */
export const getAdminUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, first_name, last_name, email, organization_id, role, is_org_admin, permissions')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === '42703' || error.message?.includes('role') || error.message?.includes('is_org_admin')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, organization_id, permissions')
        .eq('id', userId)
        .maybeSingle();
      if (fallbackError) throw fallbackError;
      if (!fallbackData) throw new Error('Admin user record not found');
      return {
        id: fallbackData.id,
        first_name: fallbackData.first_name,
        last_name: fallbackData.last_name,
        email: fallbackData.email,
        organization_id: fallbackData.organization_id,
        role: 'admin' as const,
        is_org_admin: true,
        permissions: normalizePermissions(fallbackData.permissions),
      };
    }
    throw error;
  }

  if (!data) throw new Error('Admin user record not found');

  const result = {
    ...data,
    role: data.role || 'admin',
    is_org_admin: data.is_org_admin ?? (data.role === 'admin'),
    permissions: normalizePermissions(data.permissions),
  };
  console.log('[getAdminUser] DB row for', userId, '→', {
    role: result.role,
    is_org_admin: result.is_org_admin,
    email: result.email,
  });
  return result;
};

export type StaffAccountLevel = 'full' | 'limited';
export type StaffAccountDelivery = 'invite' | 'password';

export interface CreateStaffAccountParams {
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Full = org admin (manage staff, events, settings). Limited = station permissions only. */
  staffLevel: StaffAccountLevel;
  /** Invite sends Supabase email so they set a password; password = you set it and share securely. */
  delivery: StaffAccountDelivery;
  password?: string;
  /** Limited: station permissions. Full org admin: optional admin capabilities (defaults all true). */
  permissions?: AdminPermissions;
}

/**
 * Create a staff account via Edge Function (service role).
 * Does not call client signUp (avoids switching the current session away from the org admin).
 * Requires the signed-in user to be is_org_admin for the organization (enforced server-side).
 */
function formatEdgeFunctionJsonError(body: Record<string, unknown>): string | null {
  const err = body.error;
  if (typeof err !== 'string' || !err) return null;
  const parts = [err];
  const code = body.code;
  if (typeof code === 'string' && code) parts.push(`code: ${code}`);
  const status = body.status;
  if (typeof status === 'number') parts.push(`HTTP ${status}`);
  return parts.join(' · ');
}

/** Non-2xx Edge Function responses set data to null; the JSON body is on the Response in error.context. */
async function readEdgeFunctionErrorBody(data: unknown, fnError: unknown): Promise<string | null> {
  if (data && typeof data === 'object' && 'error' in data) {
    const formatted = formatEdgeFunctionJsonError(data as Record<string, unknown>);
    if (formatted) return formatted;
  }

  if (!fnError || typeof fnError !== 'object' || !('context' in fnError)) return null;
  const ctx = (fnError as { context?: unknown }).context;
  if (!ctx || typeof ctx !== 'object' || typeof (ctx as Response).clone !== 'function') return null;
  const res = ctx as Response;
  try {
    const body = await res.clone().json();
    if (body && typeof body === 'object') {
      const formatted = formatEdgeFunctionJsonError(body as Record<string, unknown>);
      if (formatted) return formatted;
      if ('message' in body && typeof (body as { message: unknown }).message === 'string') {
        return (body as { message: string }).message;
      }
    }
  } catch {
    try {
      const text = await res.clone().text();
      const t = text.trim();
      if (t) return t.length > 500 ? `${t.slice(0, 500)}…` : t;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export const createStaffAccount = async (params: CreateStaffAccountParams) => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('You must be signed in to create staff accounts.');
  }

  // functions.invoke uses fetchWithAuth: if no Authorization header, it uses getSession() and
  // falls back to the anon key when access_token is missing (seen on Expo web). The Edge Function
  // then gets Bearer <anon> → getUser() has no caller → 401. Refresh + explicit user JWT fixes it.
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  let accessToken = refreshed.session?.access_token;
  if (!accessToken) {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token;
  }
  if (!accessToken) {
    throw new Error(
      refreshError?.message ||
        'Could not get a session token. Sign out and sign in again, then retry.'
    );
  }

  let token = accessToken.trim();
  if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }

  if (params.delivery === 'password') {
    const pw = params.password ?? '';
    if (pw.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
  }

  const body: Record<string, unknown> = {
    organization_id: params.organizationId,
    email: params.email.trim().toLowerCase(),
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    staff_level: params.staffLevel,
    delivery: params.delivery,
  };

  if (params.delivery === 'password' && params.password) {
    body.password = params.password;
  }

  if (params.permissions) {
    body.permissions = params.permissions;
  }

  const { data, error } = await supabase.functions.invoke('create-staff-account', {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = data as {
    error?: string;
    code?: string;
    status?: number;
    admin_user?: unknown;
    delivery?: StaffAccountDelivery;
  } | null;
  if (payload && typeof payload === 'object' && payload.error) {
    const formatted = formatEdgeFunctionJsonError(payload as Record<string, unknown>);
    if (formatted) throw new Error(formatted);
  }

  const bodyMessage = await readEdgeFunctionErrorBody(data, error);
  if (bodyMessage) {
    throw new Error(bodyMessage);
  }

  if (error) {
    const msg = (error as { message?: string }).message;
    throw new Error(msg || 'Failed to create staff account');
  }

  if (!payload?.admin_user) {
    throw new Error('Failed to create staff account');
  }

  return { admin_user: payload.admin_user, delivery: payload.delivery ?? params.delivery };
};

/**
 * Create a volunteer account (limited staff) with a password you set (legacy API).
 * Prefer createStaffAccount with delivery "invite" when possible.
 */
export interface CreateVolunteerCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationId: string;
}

export const createVolunteerAccount = async (credentials: CreateVolunteerCredentials) => {
  return createStaffAccount({
    organizationId: credentials.organizationId,
    email: credentials.email,
    firstName: credentials.firstName,
    lastName: credentials.lastName,
    staffLevel: 'limited',
    delivery: 'password',
    password: credentials.password,
    permissions: {
      stations: { check_in: true, pos: true, pickup: true, reports: true },
    },
  });
};

/**
 * Get all org users for an organization (admin-only)
 * Returns both admins and volunteers
 */
export const getOrgUsers = async (organizationId: string) => {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, first_name, last_name, email, organization_id, role, is_org_admin, permissions, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

/** Response from `exchange-seller-session` Edge Function (Supabase Auth session pair). */
export type ExchangeSellerSessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: unknown;
};

/**
 * Exchange a seller row `access_token` (opaque) for a normal Supabase session.
 * Call `supabase.auth.setSession` with the returned tokens.
 */
export const exchangeSellerOpaqueTokenForAuthSession = async (
  sellerOpaqueToken: string
): Promise<ExchangeSellerSessionPayload> => {
  const trimmed = sellerOpaqueToken.trim();
  if (!trimmed) throw new Error('Missing seller access token');

  const { data, error } = await supabase.functions.invoke('exchange-seller-session', {
    body: { seller_access_token: trimmed },
  });

  const payload = data as ({ error?: string } & Partial<ExchangeSellerSessionPayload>) | null;
  if (payload && typeof payload === 'object' && typeof payload.error === 'string' && payload.error) {
    throw new Error(payload.error);
  }

  if (error && !payload?.access_token) {
    throw new Error((error as { message?: string }).message || 'Token exchange failed');
  }

  if (!payload?.access_token || !payload?.refresh_token) {
    throw new Error('Token exchange returned no session');
  }

  return payload as ExchangeSellerSessionPayload;
};

export const signInWithSellerOpaqueToken = async (sellerOpaqueToken: string) => {
  const tokens = await exchangeSellerOpaqueTokenForAuthSession(sellerOpaqueToken);
  const { error } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  if (error) throw error;
};

