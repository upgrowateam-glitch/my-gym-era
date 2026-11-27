// Phone / WhatsApp number with a country picker (flag + dialling code).
// The value is one text like "+91 98765 43210" (empty when no number), so the
// server and the WhatsApp links get the country code every time.
// Two looks: the staff areas (PhoneField, via a Palette) and the FitZone profile
// form (FZPhoneInput) — both use the same picker.

import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRIES, flagOf, joinPhone, splitPhone, type Country } from '@/lib/countries';
import { fitzone as c, font } from '@/theme/colors';
import type { Palette } from '@/components/ui/UI';

interface Colors { bg: string; border: string; accent: string; text: string; muted: string; fontFamily?: string }

export function PhoneInput({ value, onChangeText, colors, placeholder = '98765 43210', radius = 14 }: {
  value: string; onChangeText: (v: string) => void; colors: Colors; placeholder?: string; radius?: number;
}) {
  const [country, setCountry] = useState<Country>(() => splitPhone(value).country);
  const [national, setNational] = useState(() => splitPhone(value).national);
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);

  // The parent cleared the field (e.g. after sending an invitation): clear the number too.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value === '' && national !== '') setNational('');
  }

  const change = (cty: Country, num: string) => {
    const next = joinPhone(cty, num);
    setLastValue(next);
    onChangeText(next);
  };

  return (
    <>
      <View style={[st.field, { backgroundColor: colors.bg, borderColor: focused ? colors.accent : colors.border, borderRadius: radius }]}>
        <Pressable onPress={() => setPicking(true)} accessibilityRole="button"
          accessibilityLabel={`Country code: ${country.name} +${country.dial}. Change`}
          style={[st.countryBtn, { borderRightColor: colors.border }]}>
          <Text style={st.flag}>{flagOf(country.code)}</Text>
          <Text style={[st.dial, { color: colors.text, fontFamily: colors.fontFamily }]}>+{country.dial}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.muted} />
        </Pressable>
        <TextInput
          value={national}
          onChangeText={(t) => { const clean = t.replace(/[^\d\s-]/g, ''); setNational(clean); change(country, clean); }}
          keyboardType="phone-pad"
          autoComplete="tel-national"
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={18}
          style={[st.input, { color: colors.text, fontFamily: colors.fontFamily }]}
        />
      </View>
      <CountryPicker visible={picking} selected={country} onClose={() => setPicking(false)}
        onPick={(cty) => { setCountry(cty); setPicking(false); change(cty, national); }} />
    </>
  );
}

/** Staff areas: label + phone input + error, like <Field>. */
export function PhoneField({ p, label, value, onChangeText, error }: {
  p: Palette; label: string; value: string; onChangeText: (v: string) => void; error?: string | null;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: p.textSecondary, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
      <PhoneInput value={value} onChangeText={onChangeText}
        colors={{ bg: p.elevated, border: p.border, accent: p.accent, text: p.text, muted: p.textSecondary + '99' }} />
      {error ? <Text style={{ color: '#EF9A9A', fontSize: 12.5 }}>{error}</Text> : null}
    </View>
  );
}

/** FitZone profile form look. */
export function FZPhoneInput({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
  return (
    <PhoneInput value={value} onChangeText={onChangeText} radius={16}
      colors={{ bg: 'rgba(17,21,24,0.9)', border: c.border, accent: c.mint, text: c.text, muted: c.muted, fontFamily: font.regular }} />
  );
}

function CountryPicker({ visible, selected, onPick, onClose }: {
  visible: boolean; selected: Country; onPick: (c: Country) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^\+/, '');
    if (!s) return COUNTRIES;
    return COUNTRIES.filter((x) => x.name.toLowerCase().includes(s) || x.dial.startsWith(s) || x.code.toLowerCase() === s);
  }, [q]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <View style={st.sheetHead}>
            <Text style={st.sheetTitle}>Choose country</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </View>
          <View style={st.search}>
            <Ionicons name="search-outline" size={18} color={GOLD} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search country or code" placeholderTextColor={c.muted}
              selectionColor={GOLD} autoCorrect={false} style={st.searchInput} />
          </View>
          <FlatList
            data={list}
            keyExtractor={(x) => x.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            ListEmptyComponent={<Text style={st.empty}>No country found.</Text>}
            renderItem={({ item }) => {
              const on = item.code === selected.code;
              return (
                <Pressable onPress={() => { setQ(''); onPick(item); }}
                  style={({ pressed }) => [st.row, on && st.rowOn, pressed && { opacity: 0.8 }]}>
                  <Text style={st.flag}>{flagOf(item.code)}</Text>
                  <Text style={[st.rowName, on && { color: c.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[st.rowDial, on && { color: GOLD }]}>+{item.dial}</Text>
                  {on && <Ionicons name="checkmark" size={18} color={GOLD} />}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const GOLD = '#C9A66B';

const st = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, minHeight: 50, overflow: 'hidden' },
  countryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, alignSelf: 'stretch', borderRightWidth: 1 },
  flag: { fontSize: 20 },
  dial: { fontSize: 15.5, fontWeight: '600' },
  input: { flex: 1, fontSize: 15.5, paddingVertical: 12, paddingHorizontal: 12, outlineStyle: 'none' } as never,
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: {
    width: '100%', maxWidth: 440, maxHeight: '80%', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(201,166,107,0.35)',
    backgroundColor: '#1E1F23', padding: 16, gap: 12,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: c.text, fontFamily: font.bold, fontSize: 18 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#2F3137', borderRadius: 14,
    paddingHorizontal: 12, backgroundColor: '#26282D',
  },
  searchInput: { flex: 1, color: c.text, fontFamily: font.regular, fontSize: 15, paddingVertical: 11, outlineStyle: 'none' } as never,
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12 },
  rowOn: { backgroundColor: 'rgba(201,166,107,0.12)' },
  rowName: { flex: 1, color: c.textSecondary, fontFamily: font.medium, fontSize: 15 },
  rowDial: { color: c.muted, fontFamily: font.semibold, fontSize: 14.5 },
  empty: { color: c.muted, fontFamily: font.regular, textAlign: 'center', paddingVertical: 20 },
});
