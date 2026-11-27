// Admin dashboard (gold): user management, trainer management, assigning
// trainers, workout videos, food & nutrition and user progress.
// What an Admin sees follows their access switches (set by the Super Admin);
// the server enforces the same rules. Real data only.

import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { can, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ALL_PERMISSIONS, PERMISSION_LABELS, type AdminStats, type TrainerSummary, type User } from '@/lib/types';
import { Button, Notice } from '@/components/ui/UI';
import {
  Bars, dashboardStyles, fmt, Grid, Hero, plural, Kpi, KpiRow, Locked, Loading, Mini, MiniRow, Muted, Panel, PersonRow,
  shortDate, SubHead, TrainerLoadRow, TWO_COLUMNS_MIN, WarnBox, AMBER,
} from '@/components/staff/DashboardUI';
import { ADMIN as p } from '@/theme/palettes';

const go = (href: Href) => router.push(href);
const NEEDS_VIEW_USERS = 'Needs the "View all users" access from the Super Admin.';

/** New users per month for the last 6 months (this month last). */
function signupsByMonth(users: User[]) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { month, count: users.filter((u) => u.createdAt.slice(0, 7) === month).length };
  });
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const viewUsers = can(user, 'view_users');
  const inviteTrainers = can(user, 'invite_trainers');

  const data = useApi(async () => {
    const [stats, trainers, users, exercises, media] = await Promise.all([
      api.get<AdminStats>('/api/admin/stats'),
      api.get<{ trainers: TrainerSummary[] }>('/api/admin/trainers').then((r) => r.trainers),
      viewUsers ? api.get<{ users: User[] }>('/api/users', { role: 'client' }).then((r) => r.users) : Promise.resolve(null),
      api.get<{ exercises: unknown[] }>('/api/exercises').then((r) => r.exercises.length),
      api.get<{ items: { type: string }[] }>('/api/media', { all: true }).then((r) => r.items),
    ]);
    return { stats, trainers, users, exercises, videos: media.filter((m) => m.type === 'video').length };
  });
  const d = data.data;

  const [width, setWidth] = useState(0);
  const twoCols = width >= TWO_COLUMNS_MIN;
  const first = user?.displayName?.split(' ')[0] || 'Admin';

  const users = d?.users ?? null;
  const active = users?.filter((u) => !u.isArchived) ?? [];
  const unassigned = active.filter((u) => !u.trainerId);
  const newest = users ? [...users].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5) : [];
  const profilePct = active.length ? Math.round((active.filter((u) => u.profileCompleted).length / active.length) * 100) : 0;
  const newThisMonth = users ? users.filter((u) => u.createdAt.slice(0, 7) === new Date().toISOString().slice(0, 7)).length : 0;
  const maxLoad = Math.max(1, ...(d?.trainers ?? []).map((t) => t.clientCount));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={dashboardStyles.page}
        refreshControl={<RefreshControl refreshing={data.loading && !!d} onRefresh={data.reload} tintColor={p.accent} />}>
        <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ gap: 16 }}>
          <Hero wide={twoCols} hello={`Welcome back, ${first}`} title="Manage your gym"
            subtitle={d ? [viewUsers ? plural(d.stats.clients, 'user') : null, `${plural(d.stats.myTrainers, 'trainer')} you manage`]
              .filter(Boolean).join(' · ') : ''}>
            {inviteTrainers && <Button p={p} small label="Invite trainer" icon="person-add-outline" onPress={() => go('/admin/invitations')} />}
            {viewUsers && <Button p={p} small kind="outline" label="Manage users" icon="people-outline" onPress={() => go('/admin/users')} />}
          </Hero>
          {data.error && <Notice text={data.error} />}

          <KpiRow>
            {viewUsers && <Kpi minWidth={150} icon="people-outline" label="Users" value={d?.stats.clients} onPress={() => go('/admin/users')}
              note={d ? `${fmt(d.stats.archivedClients)} deactivated` : undefined} />}
            <Kpi minWidth={150} icon="barbell-outline" label="My trainers" value={d?.stats.myTrainers} onPress={() => go('/admin/trainers')}
              note="Trainers you invited" />
            {viewUsers && <Kpi minWidth={150} icon="sparkles-outline" label="New this month" value={users ? newThisMonth : undefined}
              onPress={() => go('/admin/users')} note="New registrations" />}
            {viewUsers && <Kpi minWidth={150} icon="git-network-outline" label="No trainer" value={d?.stats.unassignedClients}
              onPress={() => go('/admin/users')} note={d?.stats.unassignedClients ? 'Need a trainer' : 'Everyone assigned'}
              noteColor={d?.stats.unassignedClients ? AMBER : undefined} />}
            {inviteTrainers && <Kpi minWidth={150} icon="mail-unread-outline" label="Invitations" value={d?.stats.pendingInvitations}
              onPress={() => go('/admin/invitations')} note="Pending" />}
          </KpiRow>

          <Grid twoCols={twoCols}>
            {/* 1. User management */}
            <Panel title="User management" icon="people-outline"
              action={viewUsers ? { label: 'All users', onPress: () => go('/admin/users') } : undefined}>
              {!viewUsers ? <Locked text={NEEDS_VIEW_USERS} /> : !users ? <Loading /> : (
                <>
                  <MiniRow>
                    <Mini label="Active" value={fmt(active.length)} />
                    <Mini label="Deactivated" value={fmt(users.length - active.length)} />
                    <Mini label="Profile done" value={`${profilePct}%`} />
                  </MiniRow>
                  <SubHead>New users per month</SubHead>
                  <Bars data={signupsByMonth(users)} />
                  <SubHead>Newest users</SubHead>
                  {newest.length === 0 ? <Muted>No users yet. Users sign up in the app.</Muted>
                    : newest.map((u) => (
                      <PersonRow key={u.uid} name={u.displayName || u.email} right={shortDate(u.createdAt)} onPress={() => go(`/member/${u.uid}`)}
                        detail={`${u.trainerName ? `Trainer: ${u.trainerName}` : 'No trainer yet'}${u.isArchived ? ' · Deactivated' : ''}`} />
                    ))}
                </>
              )}
            </Panel>

            {/* 2. Trainer management */}
            <Panel title="Trainer management" icon="barbell-outline" action={{ label: 'All trainers', onPress: () => go('/admin/trainers') }}>
              {!d ? <Loading /> : (
                <>
                  {d.trainers.length === 0
                    ? <Muted>No trainers yet.{inviteTrainers ? ' Invite one to get started.' : ''}</Muted>
                    : d.trainers.map((t) => (
                      <TrainerLoadRow key={t.uid} name={t.displayName || t.email} detail={t.email} count={t.clientCount} max={maxLoad}
                        onPress={() => go(`/coach/${t.uid}`)} />
                    ))}
                  {!can(user, 'manage_trainers') && (
                    <Muted>Activating / deactivating trainers needs access from the Super Admin.</Muted>
                  )}
                  {inviteTrainers && <Button p={p} label="Invite a trainer" icon="person-add-outline" onPress={() => go('/admin/invitations')} />}
                </>
              )}
            </Panel>
          </Grid>

          <Grid twoCols={twoCols}>
            {/* 3. Assign trainers to users */}
            <Panel title="Assign trainers to users" icon="git-network-outline"
              action={viewUsers ? { label: 'Assign', onPress: () => go('/admin/users') } : undefined}>
              {!viewUsers ? <Locked text={NEEDS_VIEW_USERS} /> : !users ? <Loading /> : (
                <>
                  {unassigned.length === 0 ? <Muted>Every active user has a trainer.</Muted> : (
                    <WarnBox action="Assign" onPress={() => go('/admin/users')}
                      text={`${unassigned.length === 1 ? '1 user has' : `${fmt(unassigned.length)} users have`} no trainer yet.`} />
                  )}
                  {unassigned.slice(0, 5).map((u) => (
                    <PersonRow key={u.uid} name={u.displayName || u.email} onPress={() => go(`/member/${u.uid}`)} detail={`Joined ${shortDate(u.createdAt)}`}
                      right={<Ionicons name="chevron-forward" size={18} color={p.textSecondary} />} />
                  ))}
                  <Muted>Each user has one trainer at a time; you can assign any active trainer and reassign whenever needed.</Muted>
                </>
              )}
            </Panel>

            {/* 4–6. Library and progress (later phases) */}
            <View style={{ gap: 16 }}>
              <Panel title="Workout video management" icon="play-circle-outline">
                {!d ? <Loading /> : (
                  <MiniRow>
                    <Mini label="Exercises" value={fmt(d.exercises)} />
                    <Mini label="Videos" value={fmt(d.videos)} />
                  </MiniRow>
                )}
                <Locked icon="construct-outline" text="Adding and editing workout videos arrives in the workout library phase." />
              </Panel>
              <Panel title="Food & nutrition management" icon="nutrition-outline">
                <Locked icon="construct-outline" text="The master food database arrives in the nutrition library phase." />
              </Panel>
              <Panel title="User progress overview" icon="trending-up-outline">
                <Locked icon="construct-outline" text="Progress (workouts done, weight, activity) arrives with progress tracking." />
              </Panel>
            </View>
          </Grid>

          {/* My access */}
          <Panel title="My access" icon="key-outline">
            {ALL_PERMISSIONS.map((perm) => {
              const on = can(user, perm);
              return (
                <View key={perm} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name={on ? 'checkmark-circle' : 'close-circle-outline'} size={20} color={on ? p.accent : p.textSecondary} />
                  <Text style={{ color: on ? p.text : p.textSecondary, fontSize: 14.5, flex: 1 }}>{PERMISSION_LABELS[perm].title}</Text>
                </View>
              );
            })}
            <Muted>Access is set by the Super Admin.</Muted>
          </Panel>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
