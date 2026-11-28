// Food list (FitZone gold) for the Super Admin, Admins and Trainers: search,
// filter by category and food type, see calories / protein / carbs / fat per
// serving. Super Admin and Admins also add / edit / delete foods and manage
// categories (canEdit). "Send a nutrition plan" for staff who may send.

import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { FOOD_DIETS, foodsApi } from '@/lib/nutrition';
import { Filters, initialFilters, matches, type FilterSection, type FilterValue } from '@/components/filters/Filters';
import { Button, Empty, Field, Notice, type Palette } from '@/components/ui/UI';
import { Kpi, KpiRow, Loading } from '@/components/staff/DashboardUI';
import { CategoryManager } from '@/components/library/CategoryManager';
import { FoodRow } from './NutritionUI';

export function FoodsScreen({ p, canEdit, canSend }: { p: Palette; canEdit: boolean; canSend: boolean }) {
  const cats = useApi(foodsApi.categories);
  const foods = useApi(foodsApi.foods);
  const [search, setSearch] = useState('');
  const [showCats, setShowCats] = useState(false);

  const all = foods.data ?? [];
  const sections: FilterSection[] = [
    { key: 'category', title: 'Category', options: (cats.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.foodCount})` })) },
    { key: 'diet', title: 'Food type', options: FOOD_DIETS.map((d) => ({ value: d.value, label: d.label, color: d.color })) },
    { key: 'protein', title: 'Protein per serving', options: [
      { value: 'high', label: '15 g or more' }, { value: 'mid', label: '5–15 g' }, { value: 'low', label: 'Under 5 g' },
    ] },
    { key: 'calories', title: 'Calories per serving', options: [
      { value: 'low', label: 'Under 100 kcal' }, { value: 'mid', label: '100–250 kcal' }, { value: 'high', label: 'Over 250 kcal' },
    ] },
    { key: 'sort', title: 'Sort by', single: true, defaultValue: 'name', options: [
      { value: 'name', label: 'Name A–Z' }, { value: 'protein', label: 'Most protein' }, { value: 'calories', label: 'Fewest calories' },
    ] },
  ];
  const [filters, setFilters] = useState<FilterValue>(() => initialFilters(sections));
  const band = (n: number, low: number, high: number) => (n < low ? 'low' : n >= high ? 'high' : 'mid');
  const apply = (v: FilterValue) => {
    const q = search.trim().toLowerCase();
    const sort = v.sort?.[0] ?? 'name';
    return all
      .filter((f) => matches(v, 'category', (c) => f.categoryId === c) && matches(v, 'diet', (d) => f.dietType === d)
        && matches(v, 'protein', (b) => band(f.protein, 5, 15) === b) && matches(v, 'calories', (b) => band(f.calories, 100, 250.0001) === b)
        && (!q || f.name.toLowerCase().includes(q) || f.categoryName.toLowerCase().includes(q)))
      .sort((a, b) => (sort === 'protein' ? b.protein - a.protein : sort === 'calories' ? a.calories - b.calories : a.name.localeCompare(b.name)));
  };
  const shown = apply(filters);

  return (
    <View style={{ gap: 14 }}>
      <KpiRow>
        <Kpi minWidth={140} icon="nutrition-outline" label="Foods" value={foods.data ? all.length : undefined} note="Values per serving" />
        <Kpi minWidth={140} icon="albums-outline" label="Categories" value={cats.data?.length}
          onPress={canEdit ? () => setShowCats(!showCats) : undefined} note={canEdit ? 'Tap to manage' : undefined} />
        <Kpi minWidth={140} icon="barbell-outline" label="High protein" value={foods.data ? all.filter((f) => f.protein >= 15).length : undefined}
          note="15 g or more per serving" onPress={() => setFilters({ ...filters, protein: ['high'], sort: ['protein'] })} />
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
      <Filters p={p} sections={sections} value={filters} onChange={setFilters} count={(v) => apply(v).length} />

      {!foods.data && !foods.error && <Loading />}
      {foods.data && <Text style={{ color: p.textSecondary, fontSize: 13 }}>Showing {shown.length} of {all.length} foods · values are per serving</Text>}
      {foods.data && shown.length === 0 && all.length === 0 && (
        <Empty p={p} icon="nutrition-outline" text={canEdit ? 'No foods yet. Tap "Add food".' : 'No foods yet.'} />
      )}
      {foods.data && shown.length === 0 && all.length > 0 && (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 20 }}>
          <Empty p={p} icon="nutrition-outline" text={`No foods match these filters${search.trim() ? ` and "${search.trim()}"` : ''}.${
            (filters.diet ?? []).length === 1 && filters.diet[0] === 'vegan' && (filters.category ?? []).length ? ' (Dairy, eggs, meat and fish are never vegan.)' : ''}`} />
          <Button p={p} small kind="outline" label="Clear filters" icon="close"
            onPress={() => { setFilters(initialFilters(sections)); setSearch(''); }} />
        </View>
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

