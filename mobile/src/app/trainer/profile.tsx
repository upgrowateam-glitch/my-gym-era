// Trainer → My Profile: name, WhatsApp, password, and how many users they coach.

import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ProfileScreen } from '@/components/ProfileScreen';
import { Card } from '@/components/ui/UI';
import { TRAINER as p } from '@/theme/palettes';

export default function TrainerProfile() {
  const stats = useApi(() => api.get<{ users: number; onboarding: number }>('/api/trainer/stats'));
  return (
    <ProfileScreen p={p} kicker="TRAINER" extra={
      <Card p={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name="people-outline" size={22} color={p.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }}>
            {stats.data ? `${stats.data.users} assigned ${stats.data.users === 1 ? 'user' : 'users'}` : 'Assigned users'}
          </Text>
          <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>Your gym admin assigns users to you. You see only your own users.</Text>
        </View>
      </Card>
    } />
  );
}
