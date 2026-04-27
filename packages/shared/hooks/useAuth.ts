import { useEffect, useState, useRef } from 'react';
import { getCurrentUser, getSession, signInWithEmail } from '../api/auth';
import { supabase } from '../api/supabase';
import type { User } from '@supabase/supabase-js';

// Development auto-login: only when EXPO_PUBLIC_DEV_AUTO_LOGIN=true|1 (otherwise you see the login page).
// Set EXPO_PUBLIC_DEV_AUTO_LOGIN_EMAIL + PASSWORD, or rely on defaults per app variant.
// Organizer default: Axel Admin (yarn create:axel-admin). Seller: seller@test.com.
const DEV_AUTO_LOGIN_SELLER = {
  email: 'seller@test.com',
  password: 'testpass123',
};
const DEV_AUTO_LOGIN_ORGANIZER = {
  email: 'axel.admin@bellingham-skiswap.test',
  password: 'asdfasdf',
};

function isDevAutoLoginEnabled(): boolean {
  const v = typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_DEV_AUTO_LOGIN : undefined;
  return v === 'true' || v === '1';
}

function getDevAutoLoginCredentials(): { email: string; password: string } | null {
  if (!isDevAutoLoginEnabled()) return null;
  const appVariant = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_APP_VARIANT;
  // Seller app uses phone OTP; do not silently sign in with email/password in dev.
  if (appVariant === 'seller') return null;
  const envEmail = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_DEV_AUTO_LOGIN_EMAIL;
  const envPassword = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_DEV_AUTO_LOGIN_PASSWORD;
  if (envEmail && envPassword) return { email: envEmail, password: envPassword };
  return DEV_AUTO_LOGIN_ORGANIZER;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const autoLoginAttempted = useRef(false);

  useEffect(() => {
    // Load initial user
    loadUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Auto-login in development mode (skip if user just signed out)
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('auth:skipAutoLogin')) {
      // Do not remove the flag here — login screen's useAuth would then auto-login again
      return;
    }
    if (__DEV__ && !loading && !user && !autoLoginAttempted.current) {
      const credentials = getDevAutoLoginCredentials();
      if (!credentials) return;
      autoLoginAttempted.current = true;
      console.log('[useAuth] Development mode: auto-login as', credentials.email);
      signInWithEmail({
        email: credentials.email,
        password: credentials.password,
      })
        .then(() => {
          console.log('[useAuth] Auto-login successful for', credentials.email);
          // User will be set via auth state change listener
        })
        .catch((error) => {
          console.warn('[useAuth] Auto-login failed:', error.message);
          // Don't set loading to false here - let the normal flow handle it
        });
    }
  }, [loading, user]);

  const loadUser = async () => {
    try {
      console.log('[useAuth] Loading user session...');
      const session = await getSession();
      console.log('[useAuth] Session:', { 
        hasSession: !!session, 
        hasUser: !!session?.user,
        userId: session?.user?.id,
        expiresAt: session?.expires_at,
        accessToken: session?.access_token ? 'present' : 'missing'
      });
      
      // Verify session is valid - check if it exists and has required fields
      if (session?.user && session?.access_token) {
        // Also verify the user is actually valid by checking with Supabase
        const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();
        if (error || !verifiedUser) {
          console.log('[useAuth] Session invalid, clearing user. Error:', error);
          setUser(null);
        } else {
          console.log('[useAuth] Session valid, setting user:', verifiedUser.id);
          setUser(verifiedUser);
        }
      } else {
        console.log('[useAuth] No valid session - missing user or token');
        setUser(null);
      }
    } catch (error) {
      console.error('[useAuth] Error loading user:', error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log('[useAuth] Loading complete');
    }
  };

  return { user, loading, refetch: loadUser };
}
