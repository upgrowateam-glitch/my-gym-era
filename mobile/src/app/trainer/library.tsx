// TRAINER → Library: workout videos and foods & nutrition.


import { LibraryHub } from '@/components/library/LibraryHub';
import { Page } from '@/components/ui/UI';
import { TRAINER as p } from '@/theme/palettes';

export default function Library() {
  return (
    <Page p={p} kicker="TRAINER" title="Library" wide>
      <LibraryHub p={p} canEdit={false} canSend={true} />
    </Page>
  );
}
