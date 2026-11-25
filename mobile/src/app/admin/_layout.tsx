// Admin area. Tabs follow the Admin's access switches (set by the Super Admin);
// the server enforces the same rules on the data.

import { Tabs } from 'expo-router';
import { RequireRole } from '@/components/RequireRole';
import { tabIcon } from '@/components/TabIcon';
import { can, useAuth } from '@/lib/auth';
import { ADMIN, tabBarOptions } from '@/theme/palettes';

export default function AdminLayout() {
  const { user } = useAuth();
  return (
    <RequireRole roles={['admin']}>
      <Tabs screenOptions={tabBarOptions(ADMIN)}>
        <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: tabIcon('grid-outline') }} />
        <Tabs.Screen name="trainers" options={{ title: 'Trainers', tabBarIcon: tabIcon('barbell-outline') }} />
        <Tabs.Screen name="users" options={{
          title: 'Users', tabBarIcon: tabIcon('people-outline'), href: can(user, 'view_users') ? undefined : null,
        }} />
        <Tabs.Screen name="invitations" options={{
          title: 'Invitations', tabBarIcon: tabIcon('mail-outline'), href: can(user, 'invite_trainers') ? undefined : null,
        }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle-outline') }} />
      </Tabs>
    </RequireRole>
  );
}
