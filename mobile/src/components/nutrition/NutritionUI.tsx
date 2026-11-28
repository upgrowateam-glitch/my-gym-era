// Nutrition building blocks (FitZone gold): a food row with its values,
// the calories + protein / carbs / fat summary, and a whole plan by meal.

import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  MACRO_COLORS, MEALS, dietOf, scaled, servingsText, type Food, type Macros, type NutritionPlan, type PlanItem,
} from '@/lib/nutrition';
import type { Palette } from '@/components/ui/UI';

/** Small coloured dot: vegan / veg / egg / non-veg. */
export function DietDot({ diet }: { diet: Food['dietType'] }) {
  const d = dietOf(diet);
  if (!d) return null;
  return (
    <View accessibilityLabel={d.label} style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: d.color, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: d.color }} />
    </View>
  );
}

/** "P 4.3 g · C 44.5 g · F 0.4 g" as three coloured chips. */
export function MacroChips({ m, small }: { m: Omit<Macros, 'calories'>; small?: boolean }) {
  const chip = (label: string, value: number, color: string) => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: '#D4D4D8', fontSize: small ? 12 : 12.5 }}>{label} {value} g</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
      {chip('Protein', m.protein, MACRO_COLORS.protein)}
      {chip('Carbs', m.carbs, MACRO_COLORS.carbs)}
      {chip('Fat', m.fat, MACRO_COLORS.fat)}
    </View>
  );
}

/** One food: photo (if any), name, serving, calories and macros. */
export function FoodRow({ p, food, onPress, right }: { p: Palette; food: Food; onPress?: () => void; right?: React.ReactNode }) {
  const body = (
    <>
      <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: p.elevated, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {food.imageUrl ? <Image source={{ uri: food.imageUrl }} style={{ width: 46, height: 46 }} contentFit="cover" />
          : <Ionicons name="nutrition-outline" size={22} color={p.textSecondary} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <DietDot diet={food.dietType} />
          <Text style={{ flex: 1, color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{food.name}</Text>
        </View>
        <Text style={{ color: p.textSecondary, fontSize: 12.5 }} numberOfLines={1}>{food.servingSize} · {food.categoryName}</Text>
        <MacroChips m={food} small />
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '800' }}>{Math.round(food.calories)}</Text>
        <Text style={{ color: p.textSecondary, fontSize: 11.5 }}>kcal</Text>
      </View>
      {right}
    </>
  );
  const style: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: p.border, backgroundColor: p.card };
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [style, pressed && { backgroundColor: p.elevated }]}>{body}</Pressable>
  ) : <View style={style}>{body}</View>;
}

/** Big calories number with protein / carbs / fat bars (share of calories). */
export function TotalsCard({ p, totals, title = 'Daily total' }: { p: Palette; totals: Macros; title?: string }) {
  const kcal = { protein: totals.protein * 4, carbs: totals.carbs * 4, fat: totals.fat * 9 };
  const sum = kcal.protein + kcal.carbs + kcal.fat || 1;
  const bar = (key: 'protein' | 'carbs' | 'fat', label: string) => (
    <View key={key} style={{ flex: 1, minWidth: 90, gap: 5 }}>
      <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>{label}</Text>
      <Text style={{ color: p.text, fontSize: 17, fontWeight: '800' }}>{totals[key]} g</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: p.elevated, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${Math.round((kcal[key] / sum) * 100)}%`, backgroundColor: MACRO_COLORS[key] }} />
      </View>
      <Text style={{ color: p.textSecondary, fontSize: 11.5 }}>{Math.round((kcal[key] / sum) * 100)}% of calories</Text>
    </View>
  );
  return (
    <View style={{ gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: p.border, backgroundColor: p.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <Text style={{ color: p.text, fontSize: 34, fontWeight: '800' }}>{totals.calories}</Text>
        <Text style={{ color: p.textSecondary, fontSize: 14, marginBottom: 6 }}>kcal · {title.toLowerCase()}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
        {bar('protein', 'Protein')}
        {bar('carbs', 'Carbs')}
        {bar('fat', 'Fat')}
      </View>
    </View>
  );
}

/** One plan item: "1.5 × White rice, cooked (1 cup (158 g))" with its scaled values. */
export function PlanItemRow({ p, item }: { p: Palette; item: PlanItem }) {
  const m = scaled(item, item.servings);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <View style={{ minWidth: 40, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, backgroundColor: p.accent + '22', alignItems: 'center' }}>
        <Text style={{ color: p.accent, fontWeight: '800', fontSize: 13.5 }}>×{servingsText(item.servings)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>{item.name}</Text>
        <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>{servingsText(item.servings)} × {item.servingSize}</Text>
        {item.note ? <Text style={{ color: p.accent, fontSize: 12.5, fontWeight: '600' }}>{item.note}</Text> : null}
        <MacroChips m={m} small />
      </View>
      <Text style={{ color: p.text, fontSize: 15, fontWeight: '800' }}>{m.calories} <Text style={{ color: p.textSecondary, fontSize: 11.5, fontWeight: '400' }}>kcal</Text></Text>
    </View>
  );
}

/** A whole plan: totals, the trainer's message, then each meal with its foods. */
export function PlanView({ p, plan }: { p: Palette; plan: NutritionPlan }) {
  return (
    <View style={{ gap: 14 }}>
      <TotalsCard p={p} totals={plan.totals} />
      {plan.note ? (
        <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: p.border, backgroundColor: p.card }}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={p.accent} />
          <Text style={{ flex: 1, color: p.text, fontSize: 14.5, lineHeight: 21 }}>{plan.note}</Text>
        </View>
      ) : null}
      {MEALS.map((meal) => {
        const items = plan.items.filter((i) => i.meal === meal.value);
        if (items.length === 0) return null;
        const kcal = items.reduce((n, i) => n + i.calories * i.servings, 0);
        return (
          <View key={meal.value} style={{ padding: 14, borderRadius: 18, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: p.accent + '22' }}>
                <Ionicons name={meal.icon} size={18} color={p.accent} />
              </View>
              <Text style={{ flex: 1, color: p.text, fontSize: 16.5, fontWeight: '800' }}>{meal.label}</Text>
              <Text style={{ color: p.textSecondary, fontSize: 13 }}>{Math.round(kcal)} kcal</Text>
            </View>
            {items.map((i) => <PlanItemRow key={i.id} p={p} item={i} />)}
          </View>
        );
      })}
    </View>
  );
}
