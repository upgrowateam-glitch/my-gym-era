// HTTP client for the My Gym Era Node.js server (backend/).

import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Server address.
 * - If EXPO_PUBLIC_API_URL is set in mobile/.env (e.g. the online server), use it.
 * - Otherwise (development) work it out automatically, so it keeps working when
 *   the laptop's Wi-Fi address changes:
 *     web:     the same computer the page was loaded from, port 4000
 *     Expo Go: the computer running `npx expo start`, port 4000
 */
function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  const devHost = devServerHost();
  if (devHost) return `http://${devHost}:4000`;
  return 'http://localhost:4000';
}

/**
 * The address of the computer running `npx expo start`, as seen by the phone.
 * Expo exposes it in several places depending on the SDK / Expo Go version,
 * so try them all (e.g. "192.168.1.20:8081" or "exp://192.168.1.20:8081").
 */
function devServerHost(): string | null {
  const C = Constants as any;
  const candidates: (string | undefined)[] = [
    C.expoConfig?.hostUri,
    C.expoGoConfig?.debuggerHost,
    C.manifest2?.extra?.expoGo?.debuggerHost,
    C.manifest2?.extra?.expoClient?.hostUri,
    C.manifest?.debuggerHost,
    C.manifest?.hostUri,
    C.linkingUri,
    C.experienceUrl,
  ];
  for (const raw of candidates) {
    if (typeof raw !== 'string' || !raw) continue;
    const host = raw.replace(/^[a-z+.-]+:\/\//i, '').split('/')[0].split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  }
  return null;
}

export const API_URL = resolveApiUrl().replace(/\/+$/, '');
if (__DEV__) console.log('[api] API_URL in dev =', API_URL);

/** An error from the server (or a connection problem, status 0). `message` is safe to show. */
export class ApiError extends Error {
  /** details: extra data some errors carry (e.g. who to contact when an account is deactivated). */
  constructor(public status: number, message: string, public code?: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

let token: string | null = null;
let onSessionInvalid: (() => void) | null = null;

export function setAuthToken(value: string | null) {
  token = value;
}

/** The sign-in header, for requests made outside api (file uploads with progress). */
export function authHeader(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Called when the server says the login is no longer valid (expired / archived). */
export function setSessionInvalidHandler(handler: (() => void) | null) {
  onSessionInvalid = handler;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query) {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: {
        // FormData (file uploads) sets its own Content-Type with the boundary.
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, __DEV__
      ? `Cannot reach the server at ${API_URL}. Check that the backend is running and that this device is on the same Wi-Fi as the computer.`
      : 'Cannot reach FitZone right now. Check your internet connection and try again.', 'network');
  }

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const code: string | undefined = data?.code;
    const message: string = data?.error ?? `Request failed (${res.status}).`;
    const sessionProblem =
      (res.status === 401 && (code === 'invalid_token' || code === 'unauthorized')) || code === 'account_archived';
    if (sessionProblem && token && !path.startsWith('/api/auth/login')) onSessionInvalid?.();
    throw new ApiError(res.status, message, code, data?.details ?? undefined);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  /** multipart/form-data upload (e.g. a video file in the field "file"). */
  upload: <T>(path: string, form: FormData, query?: Query) => request<T>('POST', path, form, query),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
