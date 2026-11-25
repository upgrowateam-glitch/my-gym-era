// Small key-value storage for the login token.
// Phones: encrypted with expo-secure-store (Keychain / Android Keystore).
// Web: the browser's localStorage (expo-secure-store does not support web).

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Private mode / blocked storage: the user just has to log in again next time.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
