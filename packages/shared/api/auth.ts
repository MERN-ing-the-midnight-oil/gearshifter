import { supabase } from './supabase';

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
 * Sign out current user
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
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

