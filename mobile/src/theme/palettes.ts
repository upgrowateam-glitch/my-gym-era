// Colour sets for each signed-in area (used by components/ui/UI.tsx).

import type { Palette } from '@/components/ui/UI';
import { staff } from './colors';

/** Super Admin and Admin areas: dark navy with purple accent. */
export const ADMIN: Palette = {
  bg: staff.bg, card: staff.card, elevated: staff.elevated, border: '#2A3448',
  text: staff.text, textSecondary: staff.textSecondary, accent: '#A66CFF', onAccent: '#FFFFFF',
};

/** Super Admin area: dark charcoal with FitZone gold (matches the logo and sign-in pages). */
export const SUPER: Palette = {
  bg: '#141518', card: '#1E1F23', elevated: '#26282D', border: '#2F3137',
  text: '#F4F4F5', textSecondary: '#A1A1AA', accent: '#C9A66B', onAccent: '#17120A',
};

/** Trainer area: dark navy with cyan accent. */
export const TRAINER: Palette = {
  bg: staff.bg, card: staff.card, elevated: staff.elevated, border: '#2A3448',
  text: staff.text, textSecondary: staff.textSecondary, accent: staff.trainer, onAccent: '#04121A',
};

/** User (client) area: dark charcoal with FitZone gold (was Neon Lime). */
export const USER: Palette = { ...SUPER };

/** Shared tab bar look for an area. */
export function tabBarOptions(p: Palette) {
  return {
    headerShown: false,
    tabBarActiveTintColor: p.accent,
    tabBarInactiveTintColor: p.textSecondary,
    tabBarStyle: { backgroundColor: p.card, borderTopColor: p.border },
    sceneStyle: { backgroundColor: p.bg },
  } as const;
}
