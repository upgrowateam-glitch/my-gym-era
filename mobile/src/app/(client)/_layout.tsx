// User area: bottom tabs (Home, Diary, Report, Profile). FitZone gold.
// Only for Users who have finished the fitness profile; others are sent to /profile-setup.

import { Tabs } from 'expo-router';
import { RequireRole } from '@/components/RequireRole';
import { tabIcon } from '@/components/TabIcon';
import { USER, tabBarOptions } from '@/theme/palettes';

export default function UserLayout() {
  return (
    <RequireRole roles={['client']} needsProfile>
      <Tabs screenOptions={tabBarOptions(USER)}>
        <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline') }} />
        <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: tabIcon('today-outline') }} />
        <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: tabIcon('barbell-outline') }} />
        <Tabs.Screen name="nutrition" options={{ title: 'Nutrition', tabBarIcon: tabIcon('nutrition-outline') }} />
        <Tabs.Screen name="diary" options={{ title: 'Diary', tabBarIcon: tabIcon('calendar-outline'), href: null }} />
        <Tabs.Screen name="report" options={{ title: 'Report', tabBarIcon: tabIcon('stats-chart-outline'), href: null }} />
        <Tabs.Screen name="more" options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle-outline') }} />
      </Tabs>
    </RequireRole>
  );
}
