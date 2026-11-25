// Super Admin → Settings → User Management.

import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AccountList } from '@/components/AccountList';
import { Chips } from '@/components/ui/UI';
import type { Role } from '@/lib/types';
import { ADMIN as p } from '@/theme/palettes';

type Tab = 'admins' | 'trainers' | 'users';
const ROLES: Record<Tab, Role[]> = { admins: ['super_admin', 'admin'], trainers: ['trainer'], users: ['client'] };
const EMPTY: Record<Tab, string> = {
  admins: 'No admins yet. Invite one from Invitations.',
  trainers: 'No trainers yet. Invite one from Invitations.',
  users: 'No users yet. Users sign up in the app.',
};

export default function UserManagement() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab && ROLES[params.tab] ? params.tab : 'admins');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 18, paddingBottom: 40, gap: 14, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
      <Chips p={p} value={tab} onChange={setTab} options={[
        { value: 'admins', label: 'Admins' }, { value: 'trainers', label: 'Trainers' }, { value: 'users', label: 'Users' },
      ]} />
      <View>
        {/* key: remount the list (and reload) when the tab changes */}
        <AccountList key={tab} p={p} roles={ROLES[tab]} canToggle canEditAccess={tab === 'admins'} emptyText={EMPTY[tab]} />
      </View>
    </ScrollView>
  );
}
