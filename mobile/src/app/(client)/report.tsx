import { ComingSoon } from '@/components/ComingSoon';
import { client } from '@/theme/colors';

export default function ClientReport() {
  return (
    <ComingSoon title="Report" accent={client.lime} background={client.bg}
      description="Progress report: weight history, completed workouts and nutrition." batch={3} />
  );
}
