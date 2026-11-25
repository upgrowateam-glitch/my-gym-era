// Remembers on this device that the welcome slides were seen,
// so returning visitors go straight to the login page.

import { getItem, setItem } from '@/lib/storage';

const KEY = 'fz_onboarding_done';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await setItem(KEY, '1');
  } catch {
    // Storage unavailable: the slides simply show again next time.
  }
}
