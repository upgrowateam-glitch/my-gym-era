// Yes/No question in FitZone style (dark card, gold), same on phones and web.
// <ConfirmHost /> is mounted once in the root layout; confirm() opens it and
// resolves true (OK) or false (Cancel / tapped outside).
//
//   if (await confirm('Log out', 'Do you want to log out?', 'Log out')) ...

import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fitzone as c, font } from '@/theme/colors';

type IconName = keyof typeof Ionicons.glyphMap;
type Tone = 'gold' | 'danger' | 'whatsapp';

export interface ConfirmOptions {
  tone?: Tone;
  icon?: IconName;
  /** Only an OK button (for messages). */
  hideCancel?: boolean;
}

interface Request extends Required<Omit<ConfirmOptions, 'icon'>> {
  title: string; message: string; okLabel: string; icon: IconName; resolve: (ok: boolean) => void;
}

const GOLD = '#C9A66B';
const TONES: Record<Tone, { color: string; on: string; icon: IconName }> = {
  gold: { color: GOLD, on: '#17120A', icon: 'help-circle-outline' },
  danger: { color: '#EF5350', on: '#FFFFFF', icon: 'alert-circle-outline' },
  whatsapp: { color: '#25D366', on: '#FFFFFF', icon: 'logo-whatsapp' },
};
// Actions that remove or switch something off are shown in red.
const DANGER_WORDS = ['deactivate', 'remove', 'revoke', 'log out', 'delete'];

let show: ((r: Request) => void) | null = null;

export function confirm(title: string, message: string, okLabel = 'OK', options: ConfirmOptions = {}): Promise<boolean> {
  const tone = options.tone ?? (DANGER_WORDS.includes(okLabel.toLowerCase()) ? 'danger' : 'gold');
  return new Promise((resolve) => {
    const request: Request = {
      title, message, okLabel, tone, hideCancel: !!options.hideCancel,
      icon: options.icon ?? (okLabel.toLowerCase() === 'log out' ? 'log-out-outline' : TONES[tone].icon), resolve,
    };
    if (show) show(request);
    else resolve(false); // host not mounted (should not happen)
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  useEffect(() => {
    show = (r) => setReq((cur) => { cur?.resolve(false); return r; });
    return () => { show = null; };
  }, []);

  const close = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };
  if (!req) return null;
  const t = TONES[req.tone];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent>
      <Pressable style={st.backdrop} onPress={() => close(false)} accessibilityLabel="Close">
        <Pressable style={st.card} onPress={() => {}} accessibilityRole="alert">
          <View style={[st.iconWrap, { backgroundColor: t.color + '1F', borderColor: t.color + '55' }]}>
            <Ionicons name={req.icon} size={28} color={t.color} />
          </View>
          <Text style={st.title}>{req.title}</Text>
          {!!req.message && <Text style={st.message}>{req.message}</Text>}
          <View style={st.buttons}>
            {!req.hideCancel && (
              <Pressable onPress={() => close(false)} accessibilityRole="button"
                style={({ pressed }) => [st.button, st.cancel, pressed && { opacity: 0.8 }]}>
                <Text style={st.cancelText}>Cancel</Text>
              </Pressable>
            )}
            <Pressable onPress={() => close(true)} accessibilityRole="button"
              style={({ pressed }) => [st.button, { backgroundColor: t.color }, pressed && { opacity: 0.85 }]}>
              {req.tone === 'whatsapp' && <Ionicons name="logo-whatsapp" size={18} color={t.on} />}
              <Text style={[st.okText, { color: t.on }]} numberOfLines={1}>{req.okLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
  cancel: { borderWidth: 1, borderColor: '#3A3C42', backgroundColor: 'transparent' },
  cancelText: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  okText: { fontFamily: font.bold, fontSize: 15 },
});
