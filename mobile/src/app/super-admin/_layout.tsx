// Super Admin area (gold). Computer / tablet: menu in a left sidebar.
// Phone: bottom tabs.

import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { RequireRole } from '@/components/RequireRole';
import { tabIcon } from '@/components/TabIcon';
import { Sidebar, SIDEBAR_MIN_WIDTH } from '@/components/staff/Sidebar';
import { SUPER, tabBarOptions } from '@/theme/palettes';

export default function SuperAdminLayout() {
  const wide = useWindowDimensions().width >= SIDEBAR_MIN_WIDTH;
  return (
    <RequireRole roles={['super_admin']}>
      <Tabs
        screenOptions={{ ...tabBarOptions(SUPER), tabBarPosition: wide ? 'left' : 'bottom' }}
        tabBar={wide ? (props) => <Sidebar {...props} p={SUPER} /> : undefined}
      >
        <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: tabIcon('grid-outline') }} />
        <Tabs.Screen name="invitations" options={{ title: 'Invitations', tabBarIcon: tabIcon('mail-outline') }} />
        <Tabs.Screen name="users" options={{ title: 'Users', tabBarIcon: tabIcon('people-outline') }} />
        <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: tabIcon('film-outline') }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings-outline') }} />
      </Tabs>
    </RequireRole>
  );
}
