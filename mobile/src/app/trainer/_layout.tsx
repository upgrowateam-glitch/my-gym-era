// Trainer area (gold). Computer / tablet: menu in a left sidebar; phone: bottom tabs.

import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { RequireRole } from '@/components/RequireRole';
import { tabIcon } from '@/components/TabIcon';
import { Sidebar, SIDEBAR_MIN_WIDTH } from '@/components/staff/Sidebar';
import { TRAINER, tabBarOptions } from '@/theme/palettes';

export default function TrainerLayout() {
  const wide = useWindowDimensions().width >= SIDEBAR_MIN_WIDTH;
  return (
    <RequireRole roles={['trainer']}>
      <Tabs
        screenOptions={{ ...tabBarOptions(TRAINER), tabBarPosition: wide ? 'left' : 'bottom' }}
        tabBar={wide ? (props) => <Sidebar {...props} p={TRAINER} /> : undefined}
      >
        <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: tabIcon('grid-outline') }} />
        <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: tabIcon('film-outline') }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle-outline') }} />
      </Tabs>
    </RequireRole>
  );
}
