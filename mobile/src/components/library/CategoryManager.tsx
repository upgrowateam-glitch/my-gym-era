// Add, rename and delete categories (workout video categories and food categories).

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { Button, Field, Notice, type Palette } from '@/components/ui/UI';
import { Loading, Panel } from '@/components/staff/DashboardUI';

/** Add, rename and delete categories (Super Admin / Admins). */
export function CategoryManager({ p, categories, actions, reload, word, placeholder }: {
  p: Palette;
  categories: { id: string; name: string; count: number }[] | null;
  actions: { add: (name: string) => Promise<unknown>; rename: (id: string, name: string) => Promise<unknown>; remove: (id: string) => Promise<unknown> };
  reload: () => void;
  /** "video" / "food" — for "3 videos" */
  word: string;
  placeholder: string;
}) {
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Categories" icon="albums-outline">
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field p={p} label="New category" icon="add-circle-outline" value={name} onChangeText={setName} placeholder={placeholder}
            onSubmitEditing={() => name.trim() && run(async () => { await actions.add(name.trim()); setName(''); })} />
        </View>
        <Button p={p} label="Add" icon="add" loading={busy} disabled={!name.trim()}
          onPress={() => run(async () => { await actions.add(name.trim()); setName(''); })} />
      </View>
      {error && <Notice text={error} />}
      {categories === null ? <Loading /> : categories.length === 0
        ? <Text style={{ color: p.textSecondary }}>No categories yet.</Text>
        : categories.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
            <Ionicons name="albums-outline" size={18} color={p.accent} />
            {editId === c.id ? (
              <TextInput value={editName} onChangeText={setEditName} autoFocus selectionColor={p.accent}
                style={{ flex: 1, color: p.text, fontSize: 15, borderBottomWidth: 1, borderColor: p.accent, paddingVertical: 4, outlineStyle: 'none' } as never}
                onSubmitEditing={() => run(async () => { await actions.rename(c.id, editName.trim()); setEditId(null); })} />
            ) : (
              <Text style={{ flex: 1, color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                {c.name} <Text style={{ color: p.textSecondary, fontWeight: '400', fontSize: 13 }}>· {c.count} {c.count === 1 ? word : `${word}s`}</Text>
              </Text>
            )}
            {editId === c.id ? (
              <>
                <IconBtn p={p} icon="checkmark" label="Save" disabled={busy}
                  onPress={() => run(async () => { await actions.rename(c.id, editName.trim()); setEditId(null); })} />
                <IconBtn p={p} icon="close" label="Cancel" onPress={() => setEditId(null)} />
              </>
            ) : (
              <>
                <IconBtn p={p} icon="create-outline" label="Rename" onPress={() => { setEditId(c.id); setEditName(c.name); }} />
                <IconBtn p={p} icon="trash-outline" label="Delete" danger disabled={busy}
                  onPress={async () => {
                    if (await confirm(`Delete "${c.name}"?`, c.count ? `It still has ${word}s: move or delete them first.` : 'This category will be removed.', 'Delete')) {
                      void run(() => actions.remove(c.id));
                    }
                  }} />
              </>
            )}
          </View>
        ))}
    </Panel>
  );
}

function IconBtn({ p, icon, label, onPress, danger, disabled }: {
  p: Palette; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} hitSlop={6}
      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: p.elevated, opacity: disabled ? 0.5 : 1 }}>
      <Ionicons name={icon} size={18} color={danger ? '#EF5350' : p.accent} />
    </Pressable>
  );
}
