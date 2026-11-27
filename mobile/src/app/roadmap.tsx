// Client "Evolution Roadmap" (6-step onboarding) — rebuilt in batch 2.

import { RequireRole } from '@/components/RequireRole';
import { ComingSoon } from '@/components/ComingSoon';
import { USER } from '@/theme/palettes';

export default function RoadmapScreen() {
  return (
    <RequireRole roles={['client']} needsProfile={false}>
      <ComingSoon
        title="Evolution Roadmap"
        accent={USER.accent}
        background={USER.bg}
        description="New clients complete a 6-step profile here: Personal, Health, Body, Lifestyle, Preferences and Plan."
        batch={2}
        showLogout
      />
    </RequireRole>
  );
}
