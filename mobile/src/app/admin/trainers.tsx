// Admin → the trainers this Admin manages (invited).

import { can, useAuth } from '@/lib/auth';
import { AccountList } from '@/components/AccountList';
import { Notice, Page } from '@/components/ui/UI';
import { ADMIN as p } from '@/theme/palettes';

export default function AdminTrainers() {
  const { user } = useAuth();
  const mayToggle = can(user, 'manage_trainers');
  return (
    <Page p={p} kicker="ADMIN" title="My Trainers">
      {!mayToggle && <Notice kind="info" text="You can view your trainers. Activating / deactivating them needs access from the Super Admin." />}
      <AccountList p={p} roles={['trainer']} canToggle={mayToggle}
        emptyText="No trainers yet. Invite one from the Invitations tab." />
    </Page>
  );
}
