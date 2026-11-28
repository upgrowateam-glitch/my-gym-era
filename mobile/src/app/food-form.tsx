// Add or edit a food (Super Admin / Admins). /food-form or /food-form?id=<food>
// Values are for ONE serving: calories, protein, carbohydrates and fat.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { confirm } from '@/lib/confirm';
import { uploadFile } from '@/lib/workouts';
import { FOOD_DIETS, foodCache, foodsApi, round1, type Food, type FoodCategory, type FoodDiet } from '@/lib/nutrition';
import { RequireRole } from '@/components/RequireRole';
import { BackPage } from '@/components/staff/BackPage';
import { Button, Card, Chips, Field, Notice } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { FoodPicture, MacroChips } from '@/components/nutrition/NutritionUI';
import { SUPER as p } from '@/theme/palettes';

export default function FoodFormRoute() {
  return (
    <RequireRole roles={['super_admin', 'admin']}>
      <FoodFormPage />
    </RequireRole>
  );
}

function FoodFormPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  // Opened from the food list: everything is already loaded, so show it at once.
  const cachedFood = id ? foodCache.foods?.find((f) => f.id === id) ?? null : null;
  const instant = foodCache.categories && (!id || cachedFood);
  return (
    <BackPage p={p} kicker="FOODS & NUTRITION" title={id ? 'Edit food' : 'Add food'} maxWidth={720}>
      {instant ? <FoodForm categories={foodCache.categories!} food={cachedFood} /> : <LoadThenForm id={id} />}
    </BackPage>
  );
}

/** Opened directly (no list loaded yet): load both at the same time. */
function LoadThenForm({ id }: { id?: string }) {
  const data = useApi(async () => {
    const [categories, food] = await Promise.all([foodsApi.categories(), id ? foodsApi.food(id) : Promise.resolve(null)]);
    return { categories, food };
  });
  if (data.error) return <Notice text={data.error} />;
  if (!data.data) return <Loading />;
  return <FoodForm categories={data.data.categories} food={data.data.food} />;
}

const numText = (n: number | undefined) => (n === undefined ? '' : String(n));
const toNum = (t: string) => Number(t.replace(',', '.'));

function FoodForm({ categories, food }: { categories: FoodCategory[]; food: Food | null }) {
  const [name, setName] = useState(food?.name ?? '');
  const [categoryId, setCategoryId] = useState(food?.categoryId ?? categories[0]?.id ?? '');
  const [serving, setServing] = useState(food?.servingSize ?? '');
  const [calories, setCalories] = useState(numText(food?.calories));
  const [protein, setProtein] = useState(numText(food?.protein));
  const [carbs, setCarbs] = useState(numText(food?.carbs));
  const [fat, setFat] = useState(numText(food?.fat));
  const [diet, setDiet] = useState<FoodDiet | 'none'>(food?.dietType ?? 'none');
  const [image, setImage] = useState<string | null>(food?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (categories.length === 0) {
    return (
      <Card p={p} style={{ gap: 12 }}>
        <Text style={{ color: p.text, fontSize: 15 }}>Add a food category first (Library → Foods → Manage categories).</Text>
        <Button p={p} label="Back" icon="chevron-back" onPress={() => router.back()} />
      </Card>
    );
  }

  const nums = { calories: toNum(calories), protein: toNum(protein), carbs: toNum(carbs), fat: toNum(fat) };
  const macroKcal = Math.round(nums.protein * 4 + nums.carbs * 4 + nums.fat * 9);
  const filled = [calories, protein, carbs, fat].every((t) => t.trim() !== '' && Number.isFinite(toNum(t)));

  async function pickPhoto() {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets[0]) return;
    setUploading(true);
    try {
      setImage(await uploadFile({ ...res.assets[0], mimeType: res.assets[0].mimeType ?? 'image/jpeg', fileName: res.assets[0].fileName ?? 'food.jpg' }, 'foods'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);
    if (!name.trim()) return setError('Please enter the food name.');
    if (!serving.trim()) return setError('Please enter the serving size, e.g. "1 cup (150 g)".');
    if (!filled) return setError('Please fill in calories, protein, carbohydrates and fat (use 0 if there is none).');
    if (Object.values(nums).some((n) => n < 0)) return setError('Values cannot be negative.');
    setSaving(true);
    try {
      await foodsApi.saveFood(food?.id ?? null, {
        name: name.trim(), categoryId, servingSize: serving.trim(), ...nums, dietType: diet === 'none' ? null : diet, imageUrl: image,
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!food || !(await confirm(`Delete "${food.name}"?`, 'It will be removed from the food list. Plans already sent keep it.', 'Delete'))) return;
    try {
      await foodsApi.deleteFood(food.id);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete the food.');
    }
  }

  const categoryName = categories.find((c) => c.id === categoryId)?.name;
  return (
    <View style={{ gap: 16 }}>
      {/* The food's picture, big at the top. Tap it to add or change the photo. */}
      <Pressable onPress={pickPhoto} disabled={uploading} accessibilityRole="button" accessibilityLabel={image ? 'Change photo' : 'Add a photo'}
        style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: p.border, backgroundColor: p.accent + '14' }}>
        {image ? (
          <Image source={{ uri: image }} style={{ width: '100%', aspectRatio: 16 / 10 }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
        ) : (
          <View style={{ width: '100%', aspectRatio: 16 / 10, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <FoodPicture p={p} name={name || 'Food'} category={categoryName} size={96} />
            <Text style={{ color: p.textSecondary, fontSize: 13.5 }}>No photo yet — tap to add one</Text>
          </View>
        )}
        <View style={{ position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', gap: 8 }}>
          {image && (
            <Pressable onPress={() => setImage(null)} accessibilityLabel="Remove photo"
              style={{ paddingHorizontal: 12, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Remove</Text>
            </Pressable>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: p.accent }}>
            <Ionicons name={uploading ? 'cloud-upload-outline' : 'camera-outline'} size={16} color={p.onAccent} />
            <Text style={{ color: p.onAccent, fontWeight: '800', fontSize: 13 }}>{uploading ? 'Uploading…' : image ? 'Change photo' : 'Add photo'}</Text>
          </View>
        </View>
      </Pressable>

      <Card p={p} style={{ gap: 14 }}>
        <Field p={p} label="Food name" icon="nutrition-outline" value={name} onChangeText={setName} placeholder="e.g. Upma" maxLength={100} />
        <Label text="Category" />
        <Chips p={p} value={categoryId} onChange={setCategoryId} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <Field p={p} label="Serving size" icon="resize-outline" value={serving} onChangeText={setServing}
          placeholder='e.g. 1 cup (150 g), 1 piece (40 g), 100 g' maxLength={60} />
      </Card>

      <Card p={p} style={{ gap: 14 }}>
        <Label text="Values for ONE serving" />
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Num label="Calories (kcal)" value={calories} onChange={setCalories} />
          <Num label="Protein (g)" value={protein} onChange={setProtein} />
          <Num label="Carbohydrates (g)" value={carbs} onChange={setCarbs} />
          <Num label="Fat (g)" value={fat} onChange={setFat} />
        </View>
        {filled && (
          <View style={{ gap: 6 }}>
            <MacroChips m={{ protein: round1(nums.protein), carbs: round1(nums.carbs), fat: round1(nums.fat) }} />
            <Text style={{ color: Math.abs(macroKcal - nums.calories) > Math.max(25, nums.calories * 0.2) ? '#FBBF24' : p.textSecondary, fontSize: 12.5 }}>
              Check: protein × 4 + carbs × 4 + fat × 9 = about {macroKcal} kcal
              {Math.abs(macroKcal - nums.calories) > Math.max(25, nums.calories * 0.2) ? ' — quite different from the calories you entered.' : '.'}
            </Text>
          </View>
        )}
      </Card>

      <Card p={p} style={{ gap: 14 }}>
        <Label text="Food type (optional)" />
        <Chips p={p} value={diet} onChange={setDiet} options={[{ value: 'none' as const, label: 'Not set' }, ...FOOD_DIETS.map((d) => ({ value: d.value, label: d.label }))]} />
      </Card>

      {error && <Notice text={error} />}
      <Button p={p} label={food ? 'Save changes' : 'Add food'} icon="checkmark" loading={saving} disabled={uploading} onPress={save} />
      {food && <Button p={p} kind="danger" label="Delete this food" icon="trash-outline" onPress={remove} />}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={{ color: p.textSecondary, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 }}>{text}</Text>;
}

function Num({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 140 }}>
      <Field p={p} label={label} value={value} keyboardType="decimal-pad" maxLength={6} placeholder="0"
        onChangeText={(t) => onChange(t.replace(/[^\d.,]/g, ''))} />
    </View>
  );
}
