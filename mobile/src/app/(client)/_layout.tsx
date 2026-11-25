// User area: bottom tabs (Home, Diary, Report, Profile). Lime design.
// (The onboarding roadmap comes back in its own phase.)

import { Tabs } from 'expo-router';
import { RequireRole } from '@/components/RequireRole';
import { tabIcon } from '@/components/TabIcon';
import { USER, tabBarOptions } from '@/theme/palettes';

export default function UserLayout() {
  return (
    <RequireRole roles={['client']}>
      <Tabs screenOptions={tabBarOptions(USER)}>
        <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline') }} />
        <Tabs.Screen name="diary" options={{ title: 'Diary', tabBarIcon: tabIcon('calendar-outline') }} />
        <Tabs.Screen name="report" options={{ title: 'Report', tabBarIcon: tabIcon('stats-chart-outline') }} />
        <Tabs.Screen name="more" options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle-outline') }} />
      </Tabs>
    </RequireRole>
  );
}
