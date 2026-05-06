import type { User } from '@supabase/supabase-js';
import type { Href } from 'expo-router';
import {
  getCurrentUser,
  mintSellerAccessTokenIfMissing,
  resolveSellerAfterPhoneSignIn,
  tryNormalizePhoneE164US,
} from 'shared';
import { extractEventIdFromSellerRedirect, resolveSellerPostAuthRedirect } from './postAuthRedirect';
import { setSellerDashboardEventId } from './sellerDashboardEventStorage';

export type SellerPhoneSessionRouter = {
  replace: (href: Href | { pathname: string; params?: Record<string, string> }) => void;
};

export type ContinueSellerPhoneAuthOptions = {
  /** When JWT/user omits `phone` (e.g. password session), use the number the user entered. */
  knownPhoneE164?: string;
  /** Prefer passing the user from `setSession` / `verifyOtp` so we do not race `getUser()` right after sign-in. */
  sessionUser?: User | null;
};

/**
 * Shared post-auth routing after phone verification (OTP or dev bypass).
 */
export async function continueSellerFlowAfterPhoneAuth(
  router: SellerPhoneSessionRouter,
  redirect: string | string[] | undefined,
  options?: ContinueSellerPhoneAuthOptions
): Promise<void> {
  const user =
    options?.sessionUser?.id != null ? options.sessionUser : await getCurrentUser();
  if (!user?.id) {
    throw new Error('Signed in, but user profile is missing. Try again.');
  }
  const fromUser = typeof user.phone === 'string' ? user.phone.trim() : '';
  const known = options?.knownPhoneE164?.trim() ?? '';
  const rawSession = fromUser || known;
  const sessionPhone =
    tryNormalizePhoneE164US(rawSession) ?? (rawSession.startsWith('+') ? rawSession : rawSession);
  if (!sessionPhone) {
    throw new Error('Your account has no phone on file after sign-in.');
  }

  const resolved = await resolveSellerAfterPhoneSignIn(user.id, sessionPhone);
  if (resolved.kind !== 'needs_profile') {
    await mintSellerAccessTokenIfMissing(user.id);
  }

  const eventIdFromLink = extractEventIdFromSellerRedirect(redirect);
  if (eventIdFromLink) {
    await setSellerDashboardEventId(eventIdFromLink);
  }

  if (resolved.kind === 'needs_profile') {
    router.replace({
      pathname: '/(auth)/complete-profile',
      params: {
        phone: sessionPhone,
        ...(redirect ? { redirect: String(redirect) } : {}),
      },
    });
    return;
  }

  router.replace(resolveSellerPostAuthRedirect(redirect));
}
