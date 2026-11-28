// ADMIN → Library: workout videos and foods & nutrition.

import { can, useAuth } from '@/lib/auth';
import { LibraryHub } from '@/components/library/LibraryHub';
import { Page } from '@/components/ui/UI';
import { ADMIN as p } from '@/theme/palettes';

export default function Library() {
  const { user } = useAuth();
  return (
    <Page p={p} kicker="ADMIN" title="Library" wide>
      <LibraryHub p={p} canEdit={true} canSend={can(user, 'view_users')} />
    </Page>
  );
}
