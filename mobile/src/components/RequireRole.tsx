// Guards a group of screens: only signed-in users with an allowed role get
// in; everyone else is sent to the login page or to their own home.

import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { homeRouteFor, useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';
import { LoadingScreen } from './LoadingScreen';

export function RequireRole({ roles, children, needsProfile }: {
  roles: Role[];
  children: ReactNode;
  /** clients only: true = must have finished onboarding, false = must NOT have */
  needsProfile?: boolean;
}) {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect href="/login" />;
  if (!roles.includes(user.role)) return <Redirect href={homeRouteFor(user)} />;
  if (user.role === 'client' && needsProfile !== undefined && user.profileCompleted !== needsProfile) {
    return <Redirect href={homeRouteFor(user)} />;
  }
  return <>{children}</>;
}
