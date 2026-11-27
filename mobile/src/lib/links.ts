// Shareable links (invitations).

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_URL } from './api';

/**
 * Web address of the app, used in invitation links.
 * - EXPO_PUBLIC_APP_URL in mobile/.env (e.g. https://app.yourdomain.com) when set.
 * - Website: the address it was opened on.
 * - Installed app (APK): the server address — on the VPS the website and the
 *   server share one address (https://fitzone.upgrowa.cloud).
 * - Development (Expo Go): the web version on this computer (port 8081),
 *   so links can be opened on any device on the same Wi-Fi.
 */
export function appBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  if (!__DEV__) return API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:8081` : 'http://localhost:8081';
}

export function invitationUrl(token: string): string {
  return `${appBaseUrl()}/invite/${token}`;
}

/** wa.me link that opens WhatsApp with the message ready (number without +). */
export function whatsappUrl(number: string | null, message: string): string {
  let digits = (number ?? '').replace(/[^\d]/g, '');
  // WhatsApp needs the country code. A plain 10-digit number (no +) is taken as Indian (+91).
  if (digits.length === 10 && !(number ?? '').trim().startsWith('+')) digits = `91${digits}`;
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
