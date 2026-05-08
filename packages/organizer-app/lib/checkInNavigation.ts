import type { Router } from 'expo-router';

/** Prefer pop; avoid GO_BACK when there is no stack entry (e.g. web refresh, deep link). */
export function popOrCheckInHome(router: Router, eventId: string | undefined) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  if (eventId) {
    router.replace(`/(event)/check-in?id=${eventId}` as any);
  }
}
