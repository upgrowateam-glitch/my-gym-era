// Staff actions on one User account, shared by the Users lists and the user's
// profile page: assign / change / remove the trainer, and activate / deactivate
// (with the confirmation popups and, on reactivation, the WhatsApp message).
// Each returns the updated account, or null when the person cancelled.
// Errors are thrown as ApiError (the server checks who may do what).

import { Linking } from 'react-native';
import { api } from './api';
import { confirm } from './confirm';
import { appBaseUrl, whatsappUrl } from './links';
import type { User } from './types';

const nameOf = (u: User) => u.displayName || u.email;

export async function assignTrainer(u: User, trainerId: string | null): Promise<User | null> {
  if (trainerId === null && !(await confirm(`Remove the trainer from ${nameOf(u)}?`,
    'They will have no trainer until you assign one again.', 'Remove'))) return null;
  return (await api.put<{ user: User }>(`/api/users/${u.uid}/trainer`, { trainerId })).user;
}

/**
 * Turns the account on or off. After turning it back on, offers to tell the
 * person on WhatsApp; `info` explains when that is not possible.
 */
export async function setAccountActive(u: User, active: boolean): Promise<{ user: User; info?: string } | null> {
  if (!active && !(await confirm(`Deactivate ${nameOf(u)}?`,
    'They will be signed out and cannot log in until reactivated.', 'Deactivate'))) return null;
  const user = (await api.patch<{ user: User }>(`/api/users/${u.uid}`, { isArchived: !active })).user;
  if (!active) return { user };

  const first = u.displayName?.split(' ')[0] || 'there';
  if (!u.whatsapp) {
    return { user, info: `${nameOf(u)} is active again. They have no WhatsApp number saved, so please let them know another way.` };
  }
  if (await confirm(`${nameOf(u)} is active again`, `Tell ${first} on WhatsApp that they can sign in now?`, 'Open WhatsApp',
    { tone: 'whatsapp' })) {
    const message = `Hi ${first}, good news! Your FitZone account is active again. You can sign in now: ${appBaseUrl()}/login`;
    try {
      await Linking.openURL(whatsappUrl(u.whatsapp, message));
    } catch {
      return { user, info: 'Could not open WhatsApp. Please check that WhatsApp is installed.' };
    }
  }
  return { user };
}
