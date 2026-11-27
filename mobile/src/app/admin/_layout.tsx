// Admin area (gold). Computer / tablet: menu in a left sidebar; phone: bottom tabs.
// Tabs follow the Admin's access switches (set by the Super Admin); the server
// enforces the same rules on the data.

import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { RequireRole } from '@/components/RequireRole';
import { tabIcon } from '@/components/TabIcon';
import { Sidebar, SIDEBAR_MIN_WIDTH } from '@/components/staff/Sidebar';
import { can, useAuth } from '@/lib/auth';
import { ADMIN, tabBarOptions } from '@/theme/palettes';

export default function AdminLayout() {
  const { user } = useAuth();
  const wide = useWindowDimensions().width >= SIDEBAR_MIN_WIDTH;
  return (
    <RequireRole roles={['admin']}>
      <Tabs
        screenOptions={{ ...tabBarOptions(ADMIN), tabBarPosition: wide ? 'left' : 'bottom' }}
        tabBar={wide ? (props) => <Sidebar {...props} p={ADMIN} /> : undefined}
      >
        <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: tabIcon('grid-outline') }} />
        <Tabs.Screen name="users" options={{
          title: 'Users', tabBarIcon: tabIcon('people-outline'), href: can(user, 'view_users') ? undefined : null,
        }} />
        <Tabs.Screen name="trainers" options={{ title: 'Trainers', tabBarIcon: tabIcon('barbell-outline') }} />
        <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: tabIcon('film-outline') }} />
        <Tabs.Screen name="invitations" options={{
          title: 'Invitations', tabBarIcon: tabIcon('mail-outline'), href: can(user, 'invite_trainers') ? undefined : null,
        }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle-outline') }} />
      </Tabs>
    </RequireRole>
  );
}
