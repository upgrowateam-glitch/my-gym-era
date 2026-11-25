import { Stack } from 'expo-router';
import { ADMIN } from '@/theme/palettes';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: ADMIN.bg },
        headerTintColor: ADMIN.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: ADMIN.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="users" options={{ title: 'User Management' }} />
      <Stack.Screen name="profile" options={{ title: 'My Profile', headerShown: false }} />
    </Stack>
  );
}
