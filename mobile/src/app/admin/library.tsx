// ADMIN → Workout video library.

import { can, useAuth } from '@/lib/auth';
import { LibraryScreen } from '@/components/library/LibraryScreen';
import { Page } from '@/components/ui/UI';
import { ADMIN as p } from '@/theme/palettes';

export default function Library() {
  const { user } = useAuth();
  return (
    <Page p={p} kicker="ADMIN" title="Workout Library" wide>
      <LibraryScreen p={p} canEdit={true} canSend={can(user, 'view_users')} />
    </Page>
  );
}
