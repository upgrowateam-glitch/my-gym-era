// Questions in FitZone style (dark card, gold), same on phones and web.
// <ConfirmHost /> is mounted once in the root layout.
//
//   confirm(): Yes / No            → true (OK) or false (Cancel / tapped outside)
//     if (await confirm('Log out', 'Do you want to log out?', 'Log out')) ...
//   ask(): OK / other choice / Cancel → 'ok' | 'alt' | 'cancel'
//     await ask('Trainer has 3 users', '…', 'Move users first', { altLabel: 'Deactivate anyway' })

import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fitzone as c, font } from '@/theme/colors';

type IconName = keyof typeof Ionicons.glyphMap;
type Tone = 'gold' | 'danger' | 'whatsapp';
export type Answer = 'ok' | 'alt' | 'cancel';

export interface ConfirmOptions {
  tone?: Tone;
  icon?: IconName;
  /** Only an OK button (for messages). */
  hideCancel?: boolean;
  /** A second choice besides OK (ask() only), e.g. "Deactivate anyway". */
  altLabel?: string;
  altTone?: Tone;
}

interface Request {
  title: string; message: string; okLabel: string; icon: IconName; tone: Tone; hideCancel: boolean;
  altLabel: string | null; altTone: Tone; resolve: (a: Answer) => void;
}

const GOLD = '#C9A66B';
const TONES: Record<Tone, { color: string; on: string; icon: IconName }> = {
  gold: { color: GOLD, on: '#17120A', icon: 'help-circle-outline' },
  danger: { color: '#EF5350', on: '#FFFFFF', icon: 'alert-circle-outline' },
  whatsapp: { color: '#25D366', on: '#FFFFFF', icon: 'logo-whatsapp' },
};
// Actions that remove or switch something off are shown in red.
const DANGER_WORDS = ['deactivate', 'remove', 'revoke', 'log out', 'delete'];
const toneFor = (label: string): Tone => (DANGER_WORDS.includes(label.toLowerCase()) ? 'danger' : 'gold');

let show: ((r: Request) => void) | null = null;

export function ask(title: string, message: string, okLabel = 'OK', options: ConfirmOptions = {}): Promise<Answer> {
  const tone = options.tone ?? toneFor(okLabel);
  return new Promise((resolve) => {
    const request: Request = {
      title, message, okLabel, tone, hideCancel: !!options.hideCancel,
      altLabel: options.altLabel ?? null, altTone: options.altTone ?? toneFor(options.altLabel ?? ''),
      icon: options.icon ?? (okLabel.toLowerCase() === 'log out' ? 'log-out-outline' : TONES[tone].icon), resolve,
    };
    if (show) show(request);
    else resolve('cancel'); // host not mounted (should not happen)
  });
}

export async function confirm(title: string, message: string, okLabel = 'OK', options: ConfirmOptions = {}): Promise<boolean> {
  return (await ask(title, message, okLabel, { ...options, altLabel: undefined })) === 'ok';
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  useEffect(() => {
    show = (r) => setReq((cur) => { cur?.resolve('cancel'); return r; });
    return () => { show = null; };
  }, []);

  const close = (a: Answer) => {
    req?.resolve(a);
    setReq(null);
  };
  if (!req) return null;
  const t = TONES[req.tone];
  const alt = TONES[req.altTone];
  const three = !!req.altLabel; // three buttons: stack them

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close('cancel')} statusBarTranslucent>
      <Pressable style={st.backdrop} onPress={() => close('cancel')} accessibilityLabel="Close">
        <Pressable style={st.card} onPress={() => {}} accessibilityRole="alert">
          <View style={[st.iconWrap, { backgroundColor: t.color + '1F', borderColor: t.color + '55' }]}>
            <Ionicons name={req.icon} size={28} color={t.color} />
          </View>
          <Text style={st.title}>{req.title}</Text>
          {!!req.message && <Text style={st.message}>{req.message}</Text>}
          <View style={[st.buttons, three && { flexDirection: 'column' }]}>
            {!req.hideCancel && !three && <CancelButton onPress={() => close('cancel')} />}
            <Pressable onPress={() => close('ok')} accessibilityRole="button"
              style={({ pressed }) => [st.button, three && st.full, { backgroundColor: t.color }, pressed && { opacity: 0.85 }]}>
              {req.tone === 'whatsapp' && <Ionicons name="logo-whatsapp" size={18} color={t.on} />}
              <Text style={[st.okText, { color: t.on }]} numberOfLines={1}>{req.okLabel}</Text>
            </Pressable>
            {three && (
              <Pressable onPress={() => close('alt')} accessibilityRole="button"
                style={({ pressed }) => [st.button, st.full, { borderWidth: 1, borderColor: alt.color }, pressed && { opacity: 0.85 }]}>
                <Text style={[st.okText, { color: alt.color }]} numberOfLines={1}>{req.altLabel}</Text>
              </Pressable>
            )}
            {!req.hideCancel && three && <CancelButton full onPress={() => close('cancel')} />}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CancelButton({ onPress, full }: { onPress: () => void; full?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [st.button, full && st.full, st.cancel, pressed && { opacity: 0.8 }]}>
      <Text style={st.cancelText}>Cancel</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 400, alignItems: 'center', gap: 10, paddingTop: 26, paddingBottom: 20, paddingHorizontal: 22,
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(201,166,107,0.35)', backgroundColor: '#1E1F23',
  },
  iconWrap: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { color: c.text, fontFamily: font.bold, fontSize: 19, textAlign: 'center' },
  message: { color: c.textSecondary, fontFamily: font.regular, fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 12, alignSelf: 'stretch' },
  button: {
    flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 12,
  },
  full: { flex: 0, alignSelf: 'stretch' },
  cancel: { borderWidth: 1, borderColor: '#3A3C42', backgroundColor: 'transparent' },
  cancelText: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  okText: { fontFamily: font.bold, fontSize: 15 },
});
