// Super Admin dashboard (gold). Everything comes from GET /api/admin/overview
// (Super Admin only) — real numbers only, nothing made up.
// Wide screens: two-column grid next to the sidebar. Phones: one column.

import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import type { SuperOverview } from '@/lib/types';
import { Badge, Button, Notice } from '@/components/ui/UI';
import {
  Bars, dashboardStyles, fmt, Grid, GREEN, Hero, plural, Kpi, KpiRow, LinkList, Loading, Mini, MiniRow, Muted, Panel,
  PersonRow, shortDate, SubHead, TrainerLoadRow, TWO_COLUMNS_MIN, WarnBox,
} from '@/components/staff/DashboardUI';
import { SUPER as p } from '@/theme/palettes';

const go = (href: Href) => router.push(href);
const usersTab = (tab: 'admins' | 'trainers' | 'users') => go({ pathname: '/super-admin/users', params: { tab } });
const thisMonth = (n?: number) => (n === undefined ? undefined : n ? `+${fmt(n)} this month` : 'None new this month');

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const overview = useApi(() => api.get<SuperOverview>('/api/admin/overview'));
  const d = overview.data;
  const [width, setWidth] = useState(0);
  const twoCols = width >= TWO_COLUMNS_MIN;
  const first = user?.displayName?.split(' ')[0] || 'Super Admin';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={dashboardStyles.page}
        refreshControl={<RefreshControl refreshing={overview.loading && !!d} onRefresh={overview.reload} tintColor={p.accent} />}>
        <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ gap: 16 }}>
          <Hero wide={twoCols} hello={`Welcome back, ${first}`} title="Your gym at a glance"
            subtitle={d ? `${plural(d.totals.users, 'user')} · ${plural(d.totals.trainers, 'trainer')} · ${plural(d.totals.admins, 'admin')}` : ''}>
            <Button p={p} small label="Invite Admin" icon="person-add-outline" onPress={() => go('/super-admin/invitations')} />
            <Button p={p} small kind="outline" label="Manage users" icon="people-outline" onPress={() => usersTab('users')} />
          </Hero>
          {overview.error && <Notice text={overview.error} />}

          <KpiRow>
            <Kpi icon="shield-checkmark-outline" label="Admins" value={d?.totals.admins} onPress={() => usersTab('admins')}
              note={thisMonth(d?.totals.newThisMonth.admins)} noteColor={d?.totals.newThisMonth.admins ? GREEN : undefined} />
            <Kpi icon="barbell-outline" label="Trainers" value={d?.totals.trainers} onPress={() => usersTab('trainers')}
              note={thisMonth(d?.totals.newThisMonth.trainers)} noteColor={d?.totals.newThisMonth.trainers ? GREEN : undefined} />
            <Kpi icon="people-outline" label="Users" value={d?.totals.users} onPress={() => usersTab('users')}
              note={thisMonth(d?.totals.newThisMonth.users)} noteColor={d?.totals.newThisMonth.users ? GREEN : undefined} />
          </KpiRow>

          <Grid twoCols={twoCols}>
            {/* User overview */}
            <Panel title="User overview" icon="people-outline" action={{ label: 'All users', onPress: () => usersTab('users') }}>
              {!d ? <Loading /> : (
                <>
                  <MiniRow>
                    <Mini label="Active" value={fmt(d.users.active)} />
                    <Mini label="Deactivated" value={fmt(d.users.inactive)} />
                    <Mini label="Profile done"
                      value={`${d.users.active ? Math.round((d.users.profilesCompleted / d.users.active) * 100) : 0}%`} />
                    <Mini label="No trainer" value={fmt(d.users.unassigned)} warn={d.users.unassigned > 0} />
                  </MiniRow>
                  <SubHead>New users per month</SubHead>
                  <Bars data={d.users.signupsByMonth} />
                  <SubHead>Newest users</SubHead>
                  {d.users.recent.length === 0 ? <Muted>No users yet. Users sign up in the app.</Muted>
                    : d.users.recent.map((r) => (
                      <PersonRow key={r.uid} name={r.displayName || r.email} right={shortDate(r.createdAt)}
                        detail={`${r.trainerName ? `Trainer: ${r.trainerName}` : 'No trainer yet'}${r.isArchived ? ' · Deactivated' : ''}`} />
                    ))}
                </>
              )}
            </Panel>

            {/* Invitations */}
            <Panel title="Invitations" icon="mail-outline" action={{ label: 'Manage', onPress: () => go('/super-admin/invitations') }}>
              {!d ? <Loading /> : (
                <>
                  <MiniRow>
                    <Mini label="Pending" value={fmt(d.invitations.pending)} />
                    <Mini label="Used" value={fmt(d.invitations.used)} />
                    <Mini label="Expired" value={fmt(d.invitations.expired)} />
                    <Mini label="Revoked" value={fmt(d.invitations.revoked)} />
                  </MiniRow>
                  <SubHead>Latest invitations</SubHead>
                  {d.invitations.latest.length === 0 ? <Muted>No invitations yet.</Muted>
                    : d.invitations.latest.map((i) => (
                      <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{
                          width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                          backgroundColor: i.role === 'admin' ? p.accent + '33' : '#38BDF833',
                        }}>
                          <Ionicons name={i.role === 'admin' ? 'shield-checkmark-outline' : 'barbell-outline'} size={16}
                            color={i.role === 'admin' ? p.accent : '#38BDF8'} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{i.name}</Text>
                          <Text style={{ color: p.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
                            {i.role === 'admin' ? 'Admin' : 'Trainer'} · {shortDate(i.createdAt)}{i.invitedByName ? ` · by ${i.invitedByName}` : ''}
                          </Text>
                        </View>
                        <Badge label={i.status} tone={i.status} />
                      </View>
                    ))}
                  <Button p={p} label="Invite an Admin or Trainer" icon="person-add-outline" onPress={() => go('/super-admin/invitations')} />
                </>
              )}
            </Panel>
          </Grid>

          <Grid twoCols={twoCols}>
            {/* Trainer assignments */}
            <Panel title="Trainer assignments" icon="git-network-outline" action={{ label: 'Assign', onPress: () => usersTab('users') }}>
              {!d ? <Loading /> : (
                <>
                  {d.users.unassigned > 0 && (
                    <WarnBox action="Assign" onPress={() => usersTab('users')}
                      text={`${d.users.unassigned === 1 ? '1 user has' : `${fmt(d.users.unassigned)} users have`} no trainer yet.`} />
                  )}
                  {d.trainers.length === 0 ? <Muted>No trainers yet. Invite one from Invitations.</Muted>
                    : d.trainers.map((t) => (
                      <TrainerLoadRow key={t.uid} name={t.displayName || t.email} count={t.clientCount}
                        max={Math.max(...d.trainers.map((x) => x.clientCount))}
                        detail={t.managerName ? `Invited by ${t.managerName}` : t.email} />
                    ))}
                </>
              )}
            </Panel>

            {/* Library + settings (one column) */}
            <View style={{ gap: 16 }}>
            <Panel title="Workout & nutrition library" icon="library-outline">
              {!d ? <Loading /> : (
                <MiniRow>
                  <Mini label="Exercises" value={fmt(d.library.exercises)} />
                  <Mini label="Videos" value={fmt(d.library.videos)} />
                  <Mini label="Folders" value={fmt(d.library.folders)} />
                  <Mini label="Food items" value="Not set up" small />
                </MiniRow>
              )}
              <Muted>The library screens arrive in the workout & nutrition phase.</Muted>
            </Panel>
            <Panel title="Application settings" icon="settings-outline">
              <LinkList items={[
                { icon: 'people-circle-outline', label: 'User management', onPress: () => go('/super-admin/users') },
                { icon: 'mail-outline', label: 'Invitations', onPress: () => go('/super-admin/invitations') },
                { icon: 'person-outline', label: 'My profile', onPress: () => go('/super-admin/settings/profile') },
                { icon: 'settings-outline', label: 'All settings', onPress: () => go('/super-admin/settings') },
              ]} />
            </Panel>
            </View>
          </Grid>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
