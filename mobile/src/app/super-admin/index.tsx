// Super Admin dashboard: overall counts and shortcuts.

import { View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import type { AdminStats } from '@/lib/types';
import { Button, Card, Notice, Page, SectionTitle, StatTile } from '@/components/ui/UI';
import { ADMIN as p } from '@/theme/palettes';

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const stats = useApi(() => api.get<AdminStats>('/api/admin/stats'));
  const s = stats.data;
  const manage = (tab: string) => router.push({ pathname: '/super-admin/settings/users', params: { tab } });

  return (
    <Page p={p} kicker="SUPER ADMIN" title={`Welcome, ${user?.displayName?.split(' ')[0] || 'Super Admin'}`}
      onRefresh={stats.reload} refreshing={stats.loading && !!s}>
      {stats.error && <Notice text={stats.error} />}
      <SectionTitle p={p}>Overview</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatTile p={p} icon="shield-outline" label="Admins" value={s?.admins} onPress={() => manage('admins')} />
        <StatTile p={p} icon="barbell-outline" label="Trainers" value={s?.trainers} onPress={() => manage('trainers')} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatTile p={p} icon="people-outline" label="Active users" value={s?.clients} onPress={() => manage('users')} />
        <StatTile p={p} icon="mail-unread-outline" label="Pending invitations" value={s?.pendingInvitations}
          onPress={() => router.push('/super-admin/invitations')} />
      </View>

      <SectionTitle p={p}>Quick actions</SectionTitle>
      <Card p={p}>
        <Button p={p} label="Invite an Admin or Trainer" icon="person-add-outline" onPress={() => router.push('/super-admin/invitations')} />
        <Button p={p} kind="outline" label="User Management" icon="people-circle-outline" onPress={() => manage('admins')} />
      </Card>
    </Page>
  );
}
