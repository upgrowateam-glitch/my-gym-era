import { ComingSoon } from '@/components/ComingSoon';
import { USER } from '@/theme/palettes';

export default function ClientDiary() {
  return (
    <ComingSoon title="Diary" accent={USER.accent} background={USER.bg}
      description="Calendar of daily plans and the weekly weigh-ins." batch={3} />
  );
}
