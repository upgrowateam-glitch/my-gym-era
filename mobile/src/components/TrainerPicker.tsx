// "Choose a trainer" popup (FitZone style): active trainers with how many
// users each has. Used to move one user, or all of a trainer's users.

import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TrainerSummary } from '@/lib/types';
import { fitzone as c, font } from '@/theme/colors';

const GOLD = '#C9A66B';

export function TrainerPicker({ visible, title, subtitle, trainers, excludeId, onPick, onClose }: {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** All trainers (deactivated ones and `excludeId` are left out). */
  trainers: TrainerSummary[];
  excludeId?: string | null;
  onPick: (t: TrainerSummary) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const list = trainers
    .filter((t) => !t.isArchived && t.uid !== excludeId)
    .filter((t) => !s || (t.displayName || '').toLowerCase().includes(s) || t.email.toLowerCase().includes(s));

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <View style={st.head}>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>{title}</Text>
              {subtitle ? <Text style={st.subtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </View>
          <View style={st.search}>
            <Ionicons name="search-outline" size={18} color={GOLD} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search trainer" placeholderTextColor={c.muted}
              selectionColor={GOLD} autoCorrect={false} style={st.searchInput} />
          </View>
          <FlatList
            data={list}
            keyExtractor={(t) => t.uid}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={st.empty}>No other active trainers. Invite one from Invitations.</Text>}
            renderItem={({ item }) => (
              <Pressable onPress={() => { setQ(''); onPick(item); }}
                style={({ pressed }) => [st.row, pressed && { backgroundColor: 'rgba(201,166,107,0.12)' }]}>
                <View style={st.avatar}><Ionicons name="barbell-outline" size={17} color={GOLD} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.name} numberOfLines={1}>{item.displayName || item.email}</Text>
                  <Text style={st.detail} numberOfLines={1}>{item.email}</Text>
                </View>
                <Text style={st.count}>{item.clientCount} {item.clientCount === 1 ? 'user' : 'users'}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: {
    width: '100%', maxWidth: 440, maxHeight: '80%', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(201,166,107,0.35)',
    backgroundColor: '#1E1F23', padding: 16, gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { color: c.text, fontFamily: font.bold, fontSize: 18 },
  subtitle: { color: c.textSecondary, fontFamily: font.regular, fontSize: 13.5, marginTop: 3 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#2F3137', borderRadius: 14,
    paddingHorizontal: 12, backgroundColor: '#26282D',
  },
  searchInput: { flex: 1, color: c.text, fontFamily: font.regular, fontSize: 15, paddingVertical: 11, outlineStyle: 'none' } as never,
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(201,166,107,0.14)',
  },
  name: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  detail: { color: c.muted, fontFamily: font.regular, fontSize: 12.5 },
  count: { color: c.textSecondary, fontFamily: font.semibold, fontSize: 13 },
  empty: { color: c.muted, fontFamily: font.regular, textAlign: 'center', paddingVertical: 20 },
});
