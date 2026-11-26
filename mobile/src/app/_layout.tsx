import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth';
import { UpdateBanner } from '@/components/UpdateBanner';
import { useFitZoneFonts } from '@/lib/fonts';
import { fitzone } from '@/theme/colors';

export default function RootLayout() {
  useFitZoneFonts(); // starts loading the Outfit font straight away

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: fitzone.bg }, animation: 'fade' }} />
        <UpdateBanner />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
