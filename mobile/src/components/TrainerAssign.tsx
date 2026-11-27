// "Trainer" section on a user's card: shows the assigned trainer and lets the
// Super Admin (any trainer) or an Admin (their own trainers) assign, change or
// remove it. The server enforces the same rules.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TrainerSummary, User } from '@/lib/types';
import { Button, type Palette } from './ui/UI';

export function TrainerAssign({ p, user, trainers, open, busy, onToggle, onAssign }: {
  p: Palette;
  user: User;
  /** Active trainers the signed-in person may assign (null while loading). */
  trainers: TrainerSummary[] | null;
  open: boolean;
  busy: boolean;
  onToggle(): void;
  onAssign(trainerId: string | null): void;
}) {
  const assigned = !!user.trainerId;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="barbell-outline" size={17} color={assigned ? p.accent : p.textSecondary} />
        <Text style={{ flex: 1, color: assigned ? p.text : p.textSecondary, fontSize: 14 }} numberOfLines={1}>
          {assigned ? `Trainer: ${user.trainerName ?? '—'}` : 'No trainer assigned'}
        </Text>
        <Button p={p} small kind={assigned ? 'outline' : 'primary'} label={open ? 'Close' : assigned ? 'Change' : 'Assign'}
          icon={open ? 'chevron-up' : undefined} onPress={onToggle} disabled={busy} />
      </View>

      {open && (
        <View style={{ gap: 6, paddingTop: 2 }}>
          {trainers === null && <Text style={{ color: p.textSecondary }}>Loading trainers…</Text>}
          {trainers?.length === 0 && (
            <Text style={{ color: p.textSecondary, fontSize: 13.5 }}>
              No active trainers yet. Invite a trainer first (Invitations).
            </Text>
          )}
          {trainers?.map((t) => {
            const current = t.uid === user.trainerId;
            return (
              <Pressable key={t.uid} disabled={busy || current} onPress={() => onAssign(t.uid)}
                accessibilityRole="button" accessibilityState={{ selected: current }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12,
                  borderRadius: 12, borderWidth: 1,
                  borderColor: current ? p.accent : p.border, backgroundColor: current ? p.accent + '1A' : p.elevated,
                }}>
                <Ionicons name={current ? 'checkmark-circle' : 'ellipse-outline'} size={19}
                  color={current ? p.accent : p.textSecondary} />
                <Text style={{ flex: 1, color: p.text, fontWeight: '700' }} numberOfLines={1}>
                  {t.displayName || t.email}
                </Text>
                <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>
                  {t.clientCount} {t.clientCount === 1 ? 'user' : 'users'}
                </Text>
              </Pressable>
            );
          })}
          {assigned && (
            <Button p={p} small kind="danger" label="Remove trainer" icon="close-circle-outline"
              onPress={() => onAssign(null)} disabled={busy} />
          )}
        </View>
      )}
    </View>
  );
}
