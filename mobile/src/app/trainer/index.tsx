// Trainer dashboard: counts and the users assigned to this trainer
// (assignment itself comes in a later phase). A trainer only ever sees
// their own users — the server enforces this.

import { Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import type { TrainerUser } from '@/lib/types';
import { Avatar, Card, Empty, Notice, Page, SectionTitle, StatTile } from '@/components/ui/UI';
import { TRAINER as p } from '@/theme/palettes';

interface TrainerStats { users: number; onboarding: number; unreadMessages: number }

export default function TrainerDashboard() {
  const { user } = useAuth();
  const data = useApi(async () => {
    const [stats, list] = await Promise.all([
      api.get<TrainerStats>('/api/trainer/stats'),
      api.get<{ users: TrainerUser[] }>('/api/trainer/users'),
    ]);
    return { stats, users: list.users };
  });
  const d = data.data;

  return (
    <Page p={p} kicker="TRAINER" title={`Welcome, ${user?.displayName?.split(' ')[0] || 'Coach'}`}
      onRefresh={data.reload} refreshing={data.loading && !!d}>
      {data.error && <Notice text={data.error} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatTile p={p} icon="people-outline" label="My users" value={d?.stats.users} />
        <StatTile p={p} icon="hourglass-outline" label="Still onboarding" value={d?.stats.onboarding} />
      </View>

      <SectionTitle p={p}>My users</SectionTitle>
      {d && d.users.length === 0 && (
        <Empty p={p} icon="people-outline" text="No users assigned to you yet. Your admin will assign users to you." />
      )}
      {d?.users.map((u) => (
        <Card key={u.uid} p={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar p={p} name={u.displayName || u.email} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }}>{u.displayName || u.email}</Text>
            <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>
              {u.profileCompleted ? 'Profile complete' : 'Onboarding not finished'}
              {u.currentStreak ? ` · 🔥 ${u.currentStreak}-day streak` : ''}
            </Text>
          </View>
        </Card>
      ))}
    </Page>
  );
}
