import { ComingSoon } from '@/components/ComingSoon';
import { USER } from '@/theme/palettes';

export default function ClientReport() {
  return (
    <ComingSoon title="Report" accent={USER.accent} background={USER.bg}
      description="Progress report: weight history, completed workouts and nutrition." batch={3} />
  );
}
