// Admin → all users of the gym (needs the "View all users" access).

import { Redirect } from 'expo-router';
import { can, useAuth } from '@/lib/auth';
import { AccountList } from '@/components/AccountList';
import { Page } from '@/components/ui/UI';
import { ADMIN as p } from '@/theme/palettes';

export default function AdminUsers() {
  const { user } = useAuth();
  if (!can(user, 'view_users')) return <Redirect href="/admin" />;
  return (
    <Page p={p} kicker="ADMIN" title="Users">
      <AccountList p={p} roles={['client']} canToggle={false} canAssignTrainer
        emptyText="No users yet. Users sign up in the app." />
    </Page>
  );
}
