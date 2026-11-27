// Shown on the sign-in page when an account is deactivated. First only a
// "Message admin on WhatsApp" link; tapping it opens the box where the person picks
// what they need, can add a few words, and sends it to the gym's support
// WhatsApp (the number the Super Admin sets in Settings → Support WhatsApp).
// The message starts with "Hi, I am <name>" so the gym knows who it is.

import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { whatsappUrl } from '@/lib/links';
import { fitzone as c, font } from '@/theme/colors';
import { GOLD } from './AuthUI';

export interface SupportDetails { name: string | null; email: string; supportWhatsapp: string | null }

const REASONS = [
  "I can't log in",
  'My account was deactivated by mistake',
  'Please reactivate my account',
  'I want to renew my membership',
  'Something else',
];

const WHATSAPP_GREEN = '#25D366';

export function SupportContact({ details }: { details: SupportDetails }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const who = details.name?.trim() || details.email;

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" style={st.link}>
        <Ionicons name="logo-whatsapp" size={16} color={GOLD.main} />
        <Text style={st.linkText}>Message admin on WhatsApp</Text>
        <Ionicons name="chevron-forward" size={15} color={GOLD.main} />
      </Pressable>
    );
  }

  if (!details.supportWhatsapp) {
    return (
      <View style={st.card}>
        <Text style={st.title}>Need help?</Text>
        <Text style={st.text}>The gym has not added a support WhatsApp number yet. Please contact the gym directly.</Text>
      </View>
    );
  }

  async function send() {
    if (!reason) return setError('Please choose what you need.');
    if (reason === 'Something else' && !note.trim()) return setError('Please tell us what you need.');
    setError(null);
    const lines = [
      `Hi, I am ${who}${details.name ? ` (${details.email})` : ''}.`,
      'My FitZone account has been deactivated.',
      '',
      `Request: ${reason}`,
    ];
    if (note.trim()) lines.push(`Message: ${note.trim()}`);
    const message = lines.join('\n');
    try {
      await Linking.openURL(whatsappUrl(details.supportWhatsapp, message));
    } catch {
      setError('Could not open WhatsApp. Please check that WhatsApp is installed.');
    }
  }

  return (
    <View style={st.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="logo-whatsapp" size={20} color={WHATSAPP_GREEN} />
        <Text style={st.title}>Report to the gym admin</Text>
        <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Close">
          <Ionicons name="close" size={20} color={c.muted} />
        </Pressable>
      </View>
      <Text style={st.text}>
        Your message will start with <Text style={{ color: c.text, fontFamily: font.semibold }}>&quot;Hi, I am {who}&quot;</Text>.
        Choose what you need:
      </Text>

      <View style={{ gap: 8 }}>
        {REASONS.map((r) => {
          const on = r === reason;
          return (
            <Pressable key={r} onPress={() => { setReason(r); setError(null); }} accessibilityRole="radio"
              accessibilityState={{ checked: on }} style={[st.option, on && st.optionOn]}>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? GOLD.main : c.muted} />
              <Text style={[st.optionText, on && { color: c.text }]}>{r}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput value={note} onChangeText={setNote} placeholder="Add a message (optional)" placeholderTextColor={c.muted}
        multiline maxLength={300} style={st.input} />

      {error && <Text style={st.error}>{error}</Text>}

      <Pressable onPress={send} accessibilityRole="button"
        style={({ pressed }) => [st.button, pressed && { opacity: 0.85 }]}>
        <Ionicons name="logo-whatsapp" size={20} color="#fff" />
        <Text style={st.buttonText}>Share on WhatsApp</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    gap: 12, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: `rgba(${GOLD.rgb},0.35)`,
    backgroundColor: 'rgba(17,21,24,0.92)',
  },
  title: { color: c.text, fontFamily: font.bold, fontSize: 16, flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, alignSelf: 'flex-end', marginTop: -4 },
  linkText: { color: GOLD.main, fontFamily: font.semibold, fontSize: 14 },
  text: { color: c.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 14,
    borderWidth: 1, borderColor: c.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  optionOn: { borderColor: `rgba(${GOLD.rgb},0.7)`, backgroundColor: `rgba(${GOLD.rgb},0.1)` },
  optionText: { color: c.textSecondary, fontFamily: font.medium, fontSize: 14.5, flex: 1 },
  input: {
    minHeight: 70, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border, color: c.text,
    fontFamily: font.regular, fontSize: 14.5, textAlignVertical: 'top', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  error: { color: '#EF9A9A', fontFamily: font.medium, fontSize: 13.5 },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 26,
    backgroundColor: WHATSAPP_GREEN,
  },
  buttonText: { color: '#fff', fontFamily: font.bold, fontSize: 16 },
});
