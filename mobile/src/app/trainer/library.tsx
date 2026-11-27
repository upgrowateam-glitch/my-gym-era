// TRAINER → Workout video library.


import { LibraryScreen } from '@/components/library/LibraryScreen';
import { Page } from '@/components/ui/UI';
import { TRAINER as p } from '@/theme/palettes';

export default function Library() {
  return (
    <Page p={p} kicker="TRAINER" title="Workout Library" wide>
      <LibraryScreen p={p} canEdit={false} canSend={true} />
    </Page>
  );
}
