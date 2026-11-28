// "Add food to <meal>" popup (FitZone style): search and pick foods.
// Stays open so several foods can be added; each tap adds 1 serving.

import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Food } from '@/lib/nutrition';
import type { Palette } from '@/components/ui/UI';
import { FoodRow } from './NutritionUI';

export function FoodPicker({ p, visible, title, foods, addedIds, onAdd, onClose }: {
  p: Palette; visible: boolean; title: string; foods: Food[]; addedIds: string[]; onAdd: (f: Food) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const s = q.trim().toLowerCase();
  const categories = [...new Map(foods.map((f) => [f.categoryId, f.categoryName])).entries()];
  const list = foods.filter((f) => (category === 'all' || f.categoryId === category) && (!s || f.name.toLowerCase().includes(s)));

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={[st.sheet, { backgroundColor: p.card }]} onPress={() => {}}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ flex: 1, color: p.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button"
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: p.accent }}>
              <Text style={{ color: p.onAccent, fontWeight: '800' }}>Done</Text>
            </Pressable>
          </View>
          <View style={[st.search, { borderColor: p.border, backgroundColor: p.elevated }]}>
            <Ionicons name="search-outline" size={18} color={p.accent} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search food" placeholderTextColor={p.textSecondary + '99'}
              selectionColor={p.accent} autoCorrect={false} style={[st.input, { color: p.text }]} />
          </View>
          <FlatList horizontal data={[['all', 'All'] as [string, string], ...categories]} keyExtractor={([id]) => id}
            showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}
            renderItem={({ item: [id, name] }) => {
              const on = id === category;
              return (
                <Pressable onPress={() => setCategory(id)}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? p.accent : p.border, backgroundColor: on ? p.accent + '22' : p.elevated }}>
                  <Text style={{ color: on ? p.accent : p.text, fontWeight: '700', fontSize: 13 }}>{name}</Text>
                </Pressable>
              );
            }} />
          <FlatList data={list} keyExtractor={(f) => f.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            ListEmptyComponent={<Text style={{ color: p.textSecondary, textAlign: 'center', paddingVertical: 20 }}>No foods match.</Text>}
            renderItem={({ item }) => {
              const count = addedIds.filter((id) => id === item.id).length;
              return (
                <FoodRow p={p} food={item} onPress={() => onAdd(item)} right={
                  <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: count ? '#4ADE80' : p.accent }}>
                    {count ? <Ionicons name="checkmark" size={18} color="#0B1A10" /> : <Ionicons name="add" size={20} color={p.onAccent} />}
                  </View>
                } />
              );
            }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 620, maxHeight: '88%', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(201,166,107,0.35)', padding: 16, gap: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 15, paddingVertical: 11, outlineStyle: 'none' } as never,
});
