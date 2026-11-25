// FitZone typography: the Outfit font (bundled with the app, no internet needed).
// Returns true once the font is ready — or if it failed to load, in which case
// the screens simply fall back to the system font.

import {
  useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';

export function useFitZoneFonts(): boolean {
  const [loaded, error] = useFonts({
    Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold,
  });
  return loaded || !!error;
}
