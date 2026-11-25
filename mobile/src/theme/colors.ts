// Design tokens.
// - `login`: the orange login / sign-up pages.
// - `client`: the lime client portal (Evolution Roadmap etc.).
// - `admin` / `trainer`: accents for the staff areas.

export const login = {
  bg: '#080A0E',
  bgSecondary: '#11151B',
  card: '#171B22',
  elevated: '#20252D',
  orange: '#FF6B00',
  orangeLight: '#FF8A24',
  text: '#FFFFFF',
  textSecondary: '#A5AAB3',
  border: '#303640',
} as const;

export const client = {
  bg: '#080D14',
  bgSecondary: '#101720',
  card: '#151E29',
  elevated: '#1B2633',
  lime: '#C6F000',
  limeDark: '#A7CC00',
  text: '#F5F7FA',
  textSecondary: '#A3ABB6',
  muted: '#697380',
  border: '#293340',
  onLime: '#080D14',
} as const;

export const staff = {
  bg: '#070E1D',
  card: '#161F33',
  elevated: '#1B263B',
  text: '#DFE5FA',
  textSecondary: '#A4ABBF',
  border: '#414859',
  admin: '#8A2BE2',
  trainer: '#00E5FF',
} as const;

export const danger = '#EF5350';

// FitZone brand (splash + onboarding): black / charcoal, muted mint, white.
export const fitzone = {
  bg: '#050607',
  bgSecondary: '#0B0E10',
  card: '#111518',
  elevated: '#181D21',
  border: '#232A2F',
  mint: '#6FE0A0',
  mintDark: '#4FBF82',
  onMint: '#04140B',
  text: '#FFFFFF',
  textSecondary: '#A7AEB4',
  muted: '#6B7379',
} as const;

/** Outfit font family names, loaded once in the root layout. */
export const font = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  extrabold: 'Outfit_800ExtraBold',
} as const;
