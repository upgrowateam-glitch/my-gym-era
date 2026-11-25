// Admin dashboard: counts, shortcuts and the Admin's own access.

import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ALL_PERMISSIONS, PERMISSION_LABELS, type AdminStats } from '@/lib/types';
import { Button, Card, Notice, Page, SectionTitle, StatTile } from '@/components/ui/UI';
import { ADMIN as p } from '@/theme/palettes';

export default function AdminDashboard() {
  const { user } = useAuth();
  const stats = useApi(() => api.get<AdminStats>('/api/admin/stats'));
  const s = stats.data;

  return (
    <Page p={p} kicker="ADMIN" title={`Welcome, ${user?.displayName?.split(' ')[0] || 'Admin'}`}
      onRefresh={stats.reload} refreshing={stats.loading && !!s}>
      {stats.error && <Notice text={stats.error} />}
      <SectionTitle p={p}>Overview</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatTile p={p} icon="barbell-outline" label="My trainers" value={s?.myTrainers} onPress={() => router.push('/admin/trainers')} />
        {can(user, 'view_users') && (
          <StatTile p={p} icon="people-outline" label="Active users" value={s?.clients} onPress={() => router.push('/admin/users')} />
        )}
        {can(user, 'invite_trainers') && (
          <StatTile p={p} icon="mail-unread-outline" label="Pending invitations" value={s?.pendingInvitations}
            onPress={() => router.push('/admin/invitations')} />
        )}
      </View>

      {can(user, 'invite_trainers') && (
        <Button p={p} label="Invite a trainer" icon="person-add-outline" onPress={() => router.push('/admin/invitations')} />
      )}

      <SectionTitle p={p}>My access</SectionTitle>
      <Card p={p} style={{ gap: 10 }}>
        {ALL_PERMISSIONS.map((perm) => {
          const on = can(user, perm);
          return (
            <View key={perm} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={on ? 'checkmark-circle' : 'close-circle-outline'} size={20} color={on ? '#4CAF50' : p.textSecondary} />
              <Text style={{ color: on ? p.text : p.textSecondary, fontSize: 14.5 }}>{PERMISSION_LABELS[perm].title}</Text>
            </View>
          );
        })}
        <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>Access is set by the Super Admin.</Text>
      </Card>
    </Page>
  );
}
