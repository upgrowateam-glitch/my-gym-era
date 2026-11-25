import { ProfileScreen } from '@/components/ProfileScreen';
import { ADMIN } from '@/theme/palettes';

export default function SuperAdminProfile() {
  return <ProfileScreen p={ADMIN} kicker="SUPER ADMIN" />;
}
