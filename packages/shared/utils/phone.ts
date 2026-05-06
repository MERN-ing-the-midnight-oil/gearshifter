/**
 * Normalize a US-centric phone string to E.164 (+1…) for Supabase phone OTP.
 * Strips non-digits except a leading +.
 */
export function normalizePhoneE164US(raw: string): string {
  const t = raw.trim();
  if (!t) throw new Error('Phone number is required');

  const digits = t.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (t.startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }

  throw new Error('Enter a valid 10-digit US number or full international number with +');
}

/** Same rules as {@link normalizePhoneE164US} but returns null instead of throwing. */
export function tryNormalizePhoneE164US(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    return normalizePhoneE164US(t);
  } catch {
    return null;
  }
}

/** Placeholder email when sellers.email is NOT NULL but the user has no inbox (phone auth). */
export function sellerPlaceholderEmailForAuthUserId(authUserId: string): string {
  const compact = authUserId.replace(/-/g, '');
  return `${compact}@seller.phone.local`;
}
