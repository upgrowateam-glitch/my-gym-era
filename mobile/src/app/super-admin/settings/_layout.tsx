import { Stack } from 'expo-router';
import { SUPER } from '@/theme/palettes';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: SUPER.bg },
        headerTintColor: SUPER.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: SUPER.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: 'My Profile', headerShown: false }} />
      <Stack.Screen name="support" options={{ title: 'Support WhatsApp', headerShown: false }} />
    </Stack>
  );
}
