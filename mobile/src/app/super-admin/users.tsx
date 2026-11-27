// Super Admin → Users: all accounts (Admins, Trainers, Users) — activate /
// deactivate, Admin access switches, and trainer assignment for Users.
// Open a tab directly with /super-admin/users?tab=trainers.

import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AccountList } from '@/components/AccountList';
import { UsersManager } from '@/components/UsersManager';
import { Chips, Page } from '@/components/ui/UI';
import type { Role } from '@/lib/types';
import { SUPER as p } from '@/theme/palettes';

type Tab = 'admins' | 'trainers' | 'users';
const ROLES: Record<Tab, Role[]> = { admins: ['super_admin', 'admin'], trainers: ['trainer'], users: ['client'] };
const EMPTY: Record<Tab, string> = {
  admins: 'No admins yet. Invite one from Invitations.',
  trainers: 'No trainers yet. Invite one from Invitations.',
  users: 'No users yet. Users sign up in the app.',
};
const isTab = (x: unknown): x is Tab => typeof x === 'string' && x in ROLES;

export default function UserManagement() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(isTab(params.tab) ? params.tab : 'admins');

  // Links from the dashboard (e.g. "Trainers") switch the tab even when this
  // screen is already open (React's "adjust state when a prop changes" pattern).
  const [seenParam, setSeenParam] = useState(params.tab);
  if (params.tab !== seenParam) {
    setSeenParam(params.tab);
    if (isTab(params.tab)) setTab(params.tab);
  }

  return (
    <Page p={p} kicker="SUPER ADMIN" title="Users" wide={tab === 'users'}>
      <Chips p={p} value={tab} onChange={setTab} options={[
        { value: 'admins', label: 'Admins' }, { value: 'trainers', label: 'Trainers' }, { value: 'users', label: 'Users' },
      ]} />
      <View>
        {/* key: remount the list (and reload) when the tab changes */}
        {tab === 'users'
          ? <UsersManager p={p} canToggle />
          : <AccountList key={tab} p={p} roles={ROLES[tab]} canToggle canEditAccess={tab === 'admins'} emptyText={EMPTY[tab]} />}
      </View>
    </Page>
  );
}
