import { ComingSoon } from '@/components/ComingSoon';
import { client } from '@/theme/colors';

export default function ClientDiary() {
  return (
    <ComingSoon title="Diary" accent={client.lime} background={client.bg}
      description="Calendar of daily plans and the weekly weigh-ins." batch={3} />
  );
}
