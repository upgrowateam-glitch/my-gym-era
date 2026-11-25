// Shareable links (invitations).

import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Web address of the app, used in invitation links.
 * - EXPO_PUBLIC_APP_URL in mobile/.env (e.g. https://app.yourdomain.com) when set.
 * - Otherwise (development): the web version on this computer (port 8081),
 *   so links can be opened on any device on the same Wi-Fi.
 */
export function appBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:8081` : 'http://localhost:8081';
}

export function invitationUrl(token: string): string {
  return `${appBaseUrl()}/invite/${token}`;
}

/** wa.me link that opens WhatsApp with the message ready (number without +). */
export function whatsappUrl(number: string | null, message: string): string {
  const digits = (number ?? '').replace(/[^\d]/g, '');
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
