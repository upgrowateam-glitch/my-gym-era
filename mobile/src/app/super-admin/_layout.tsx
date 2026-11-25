import { Tabs } from 'expo-router';
import { RequireRole } from '@/components/RequireRole';
import { tabIcon } from '@/components/TabIcon';
import { ADMIN, tabBarOptions } from '@/theme/palettes';

export default function SuperAdminLayout() {
  return (
    <RequireRole roles={['super_admin']}>
      <Tabs screenOptions={tabBarOptions(ADMIN)}>
        <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: tabIcon('grid-outline') }} />
        <Tabs.Screen name="invitations" options={{ title: 'Invitations', tabBarIcon: tabIcon('mail-outline') }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings-outline') }} />
      </Tabs>
    </RequireRole>
  );
}
