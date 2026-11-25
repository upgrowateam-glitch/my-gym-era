import { Tabs } from 'expo-router';
import { RequireRole } from '@/components/RequireRole';
import { tabIcon } from '@/components/TabIcon';
import { TRAINER, tabBarOptions } from '@/theme/palettes';

export default function TrainerLayout() {
  return (
    <RequireRole roles={['trainer']}>
      <Tabs screenOptions={tabBarOptions(TRAINER)}>
        <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: tabIcon('grid-outline') }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle-outline') }} />
      </Tabs>
    </RequireRole>
  );
}
