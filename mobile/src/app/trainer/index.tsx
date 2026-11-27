// Trainer dashboard (gold): the users assigned to this trainer.
// A trainer only ever sees their own users — the server enforces this.
// Real data only; plans, progress and messages arrive in later phases.

import { useState } from 'react';
import { RefreshControl, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import type { TrainerUser } from '@/lib/types';
import { Button, Notice } from '@/components/ui/UI';
import {
  AMBER, dashboardStyles, fmt, Grid, Hero, Kpi, KpiRow, Loading, Locked, Muted, Panel, PersonRow, plural, shortDate,
  TWO_COLUMNS_MIN,
} from '@/components/staff/DashboardUI';
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

  const [width, setWidth] = useState(0);
  const twoCols = width >= TWO_COLUMNS_MIN;
  const first = user?.displayName?.split(' ')[0] || 'Coach';
  const onboarding = d?.users.filter((u) => !u.profileCompleted) ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={dashboardStyles.page}
        refreshControl={<RefreshControl refreshing={data.loading && !!d} onRefresh={data.reload} tintColor={p.accent} />}>
        <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ gap: 16 }}>
          <Hero wide={twoCols} hello={`Welcome back, ${first}`} title="Coach your clients"
            subtitle={d ? `${plural(d.stats.users, 'user')} assigned to you` : ''} />
          {data.error && <Notice text={data.error} />}

          <KpiRow>
            <Kpi minWidth={150} icon="people-outline" label="My users" value={d?.stats.users} note="Assigned to you" />
            <Kpi minWidth={150} icon="hourglass-outline" label="Still onboarding" value={d?.stats.onboarding}
              note={d?.stats.onboarding ? 'Profile not finished' : 'All profiles done'}
              noteColor={d?.stats.onboarding ? AMBER : undefined} />
            <Kpi minWidth={150} icon="chatbubbles-outline" label="Unread messages" value={d?.stats.unreadMessages}
              note="From your users" />
          </KpiRow>

          <Grid twoCols={twoCols}>
            {/* My assigned users */}
            <Panel title="My assigned users" icon="people-outline">
              {d && d.users.length > 0 && <Muted>Tap a user to see their fitness profile.</Muted>}
              {!d ? <Loading /> : d.users.length === 0
                ? <Muted>No users assigned to you yet. Your admin will assign users to you.</Muted>
                : d.users.map((u) => (
                  <PersonRow key={u.uid} name={u.displayName || u.email} onPress={() => router.push(`/member/${u.uid}`)}
                    right={u.unreadMessages ? `${fmt(u.unreadMessages)} new` : shortDate(u.createdAt)}
                    detail={`${u.profileCompleted ? 'Profile complete' : 'Onboarding not finished'}${u.currentStreak ? ` · 🔥 ${u.currentStreak}-day streak` : ''}`} />
                ))}
              {onboarding.length > 0 && (
                <Muted>{plural(onboarding.length, 'user')} still {onboarding.length === 1 ? 'needs' : 'need'} to finish the fitness profile.</Muted>
              )}
            </Panel>

            {/* Coming in later phases */}
            <View style={{ gap: 16 }}>
              <Panel title="Workouts" icon="barbell-outline" action={{ label: 'Library', onPress: () => router.push('/trainer/library') }}>
                <Muted>Choose videos from the library and send a workout to one of your users. You will see when they finish it.</Muted>
                <Button p={p} label="Send a workout" icon="paper-plane-outline" onPress={() => router.push('/send-workout')} />
                <Locked icon="construct-outline" text="Diet plans arrive in the nutrition phase." />
              </Panel>
              <Panel title="Progress tracking" icon="trending-up-outline">
                <Locked icon="construct-outline" text="Your users' progress (workouts done, weight, activity) arrives with progress tracking." />
              </Panel>
              <Panel title="Messages & feedback" icon="chatbubbles-outline">
                <Locked icon="construct-outline" text="Chat with your users arrives in the messaging phase." />
              </Panel>
            </View>
          </Grid>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
