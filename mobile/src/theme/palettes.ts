// Colour sets for each signed-in area (used by components/ui/UI.tsx).

import type { Palette } from '@/components/ui/UI';

/** FitZone gold on dark charcoal (matches the logo and sign-in pages). */
export const SUPER: Palette = {
  bg: '#141518', card: '#1E1F23', elevated: '#26282D', border: '#2F3137',
  text: '#F4F4F5', textSecondary: '#A1A1AA', accent: '#C9A66B', onAccent: '#17120A',
};

/** Admin area: same FitZone gold (was dark navy + purple). */
export const ADMIN: Palette = { ...SUPER };

/** Trainer area: same FitZone gold (was dark navy + cyan). */
export const TRAINER: Palette = { ...SUPER };

/** User (client) area: same FitZone gold (was Neon Lime). */
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
