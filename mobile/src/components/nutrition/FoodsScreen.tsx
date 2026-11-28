// Food list (FitZone gold) for the Super Admin, Admins and Trainers: search,
// filter by category and food type, see calories / protein / carbs / fat per
// serving. Super Admin and Admins also add / edit / delete foods and manage
// categories (canEdit). "Send a nutrition plan" for staff who may send.

import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { FOOD_DIETS, foodsApi, type FoodDiet } from '@/lib/nutrition';
import { Button, Chips, Empty, Field, Notice, type Palette } from '@/components/ui/UI';
import { Kpi, KpiRow, Loading } from '@/components/staff/DashboardUI';
import { CategoryManager } from '@/components/library/CategoryManager';
import { FoodRow } from './NutritionUI';

export function FoodsScreen({ p, canEdit, canSend }: { p: Palette; canEdit: boolean; canSend: boolean }) {
  const cats = useApi(foodsApi.categories);
  const foods = useApi(foodsApi.foods);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [diet, setDiet] = useState<FoodDiet | 'all'>('all');
  const [sort, setSort] = useState<'name' | 'protein' | 'calories'>('name');
  const [showCats, setShowCats] = useState(false);

  const all = foods.data ?? [];
  const q = search.trim().toLowerCase();
  const shown = all
    .filter((f) => (category === 'all' || f.categoryId === category) && (diet === 'all' || f.dietType === diet)
      && (!q || f.name.toLowerCase().includes(q) || f.categoryName.toLowerCase().includes(q)))
    .sort((a, b) => (sort === 'protein' ? b.protein - a.protein : sort === 'calories' ? a.calories - b.calories : a.name.localeCompare(b.name)));

  return (
    <View style={{ gap: 14 }}>
      <KpiRow>
        <Kpi minWidth={140} icon="nutrition-outline" label="Foods" value={foods.data ? all.length : undefined} note="Values per serving" />
        <Kpi minWidth={140} icon="albums-outline" label="Categories" value={cats.data?.length}
          onPress={canEdit ? () => setShowCats(!showCats) : undefined} note={canEdit ? 'Tap to manage' : undefined} />
        <Kpi minWidth={140} icon="barbell-outline" label="High protein" value={foods.data ? all.filter((f) => f.protein >= 15).length : undefined}
          note="15 g or more per serving" onPress={() => setSort('protein')} />
      </KpiRow>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {canEdit && <Button p={p} label="Add food" icon="add" onPress={() => router.push('/food-form')} />}
        {canEdit && <Button p={p} kind="outline" label={showCats ? 'Hide categories' : 'Manage categories'} icon="albums-outline" onPress={() => setShowCats(!showCats)} />}
        {canSend && <Button p={p} label="Send a nutrition plan" icon="paper-plane-outline" onPress={() => router.push('/nutrition-plan')} />}
      </View>

      {canEdit && showCats && (
        <CategoryManager p={p} word="food" placeholder="e.g. Breakfast items, Protein, Snacks"
          categories={cats.data?.map((c) => ({ id: c.id, name: c.name, count: c.foodCount })) ?? null}
          actions={{ add: foodsApi.addCategory, rename: foodsApi.renameCategory, remove: foodsApi.deleteCategory }}
          reload={() => { void cats.reload(); void foods.reload(); }} />
      )}
      {(cats.error || foods.error) && <Notice text={(cats.error ?? foods.error)!} />}

      <Field p={p} label="Search" icon="search-outline" value={search} onChangeText={setSearch} placeholder="Food or category" autoCapitalize="none" />
      {(cats.data?.length ?? 0) > 0 && (
        <Group p={p} label="Category">
          <Chips p={p} value={category} onChange={setCategory} options={[
            { value: 'all', label: 'All' }, ...(cats.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.foodCount})` })),
          ]} />
        </Group>
      )}
      <Group p={p} label="Food type">
        <Chips p={p} value={diet} onChange={setDiet} options={[{ value: 'all' as const, label: 'All' }, ...FOOD_DIETS.map((d) => ({ value: d.value, label: d.label }))]} />
      </Group>
      <Group p={p} label="Sort">
        <Chips p={p} value={sort} onChange={setSort} options={[
          { value: 'name' as const, label: 'Name A–Z' }, { value: 'protein' as const, label: 'Most protein' }, { value: 'calories' as const, label: 'Fewest calories' },
        ]} />
      </Group>

      {!foods.data && !foods.error && <Loading />}
      {foods.data && <Text style={{ color: p.textSecondary, fontSize: 13 }}>Showing {shown.length} of {all.length} foods · values are per serving</Text>}
      {foods.data && shown.length === 0 && (
        <Empty p={p} icon="nutrition-outline" text={all.length === 0 ? (canEdit ? 'No foods yet. Tap "Add food".' : 'No foods yet.') : 'No foods match.'} />
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {shown.map((f) => (
          <View key={f.id} style={{ flexGrow: 1, flexBasis: 340, maxWidth: 620 }}>
            <FoodRow p={p} food={f} onPress={canEdit ? () => router.push({ pathname: '/food-form', params: { id: f.id } }) : undefined} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Group({ p, label, children }: { p: Palette; label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: p.textSecondary, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
      {children}
    </View>
  );
}
