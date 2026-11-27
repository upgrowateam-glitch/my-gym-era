// Admin → Trainers: every trainer (with "View all users"), their users,
// moving users between trainers, and status for the trainers this Admin invited.

import { can, useAuth } from '@/lib/auth';
import { TrainersManager } from '@/components/TrainersManager';
import { Page } from '@/components/ui/UI';
import { ADMIN as p } from '@/theme/palettes';

export default function AdminTrainers() {
  const { user } = useAuth();
  return (
    <Page p={p} kicker="ADMIN" title="Trainers" wide>
      <TrainersManager p={p} inviteHref={can(user, 'invite_trainers') ? '/admin/invitations' : undefined} />
    </Page>
  );
}
