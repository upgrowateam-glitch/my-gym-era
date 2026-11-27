// SUPER ADMIN → Workout video library.


import { LibraryScreen } from '@/components/library/LibraryScreen';
import { Page } from '@/components/ui/UI';
import { SUPER as p } from '@/theme/palettes';

export default function Library() {
  return (
    <Page p={p} kicker="SUPER ADMIN" title="Workout Library" wide>
      <LibraryScreen p={p} canEdit={true} canSend={true} />
    </Page>
  );
}
