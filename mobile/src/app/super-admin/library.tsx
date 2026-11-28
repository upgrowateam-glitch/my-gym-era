// SUPER ADMIN → Library: workout videos and foods & nutrition.


import { LibraryHub } from '@/components/library/LibraryHub';
import { Page } from '@/components/ui/UI';
import { SUPER as p } from '@/theme/palettes';

export default function Library() {
  return (
    <Page p={p} kicker="SUPER ADMIN" title="Library" wide>
      <LibraryHub p={p} canEdit={true} canSend={true} />
    </Page>
  );
}
