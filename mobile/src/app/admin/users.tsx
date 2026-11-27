// Admin → Users: all gym members (needs the "View all users" access):
// totals, search, filters, trainer assignment and active / deactivated status.

import { Redirect } from 'expo-router';
import { can, useAuth } from '@/lib/auth';
import { UsersManager } from '@/components/UsersManager';
import { Page } from '@/components/ui/UI';
import { ADMIN as p } from '@/theme/palettes';

export default function AdminUsers() {
  const { user } = useAuth();
  if (!can(user, 'view_users')) return <Redirect href="/admin" />;
  return (
    <Page p={p} kicker="ADMIN" title="Users" wide>
      <UsersManager p={p} canToggle />
    </Page>
  );
}
