-- Phase 6: food & nutrition.
--
-- food_categories       e.g. "Grains & cereals", "Dairy" (Super Admin / Admins manage)
-- foods                 one food with its serving size and the calories, protein,
--                       carbohydrates and fat in ONE serving
-- nutrition_plans       a diet plan a trainer (or admin) sends to a user. The newest
--                       one is the user's current plan; older ones are history.
-- nutrition_plan_items  the foods in that plan, per meal, with how many servings.
--                       The food's name, serving and values are copied in, so a plan
--                       does not change if the food is edited or deleted later.

CREATE TABLE food_categories (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX food_categories_name_idx ON food_categories (lower(name));
CREATE TRIGGER food_categories_updated_at BEFORE UPDATE ON food_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE foods (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category_id   TEXT NOT NULL REFERENCES food_categories (id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  serving_size  TEXT NOT NULL,                 -- e.g. "1 cup (158 g)"
  calories      NUMERIC(7,1) NOT NULL CHECK (calories BETWEEN 0 AND 5000),
  protein_g     NUMERIC(6,1) NOT NULL CHECK (protein_g BETWEEN 0 AND 500),
  carbs_g       NUMERIC(6,1) NOT NULL CHECK (carbs_g BETWEEN 0 AND 500),
  fat_g         NUMERIC(6,1) NOT NULL CHECK (fat_g BETWEEN 0 AND 500),
  diet_type     TEXT CHECK (diet_type IN ('vegan', 'veg', 'egg', 'non_veg')),
  image_url     TEXT,
  created_by    TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX foods_category_idx ON foods (category_id);
CREATE TRIGGER foods_updated_at BEFORE UPDATE ON foods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE nutrition_plans (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sent_by     TEXT REFERENCES users (id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX nutrition_plans_user_idx ON nutrition_plans (user_id, created_at DESC);

CREATE TABLE nutrition_plan_items (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plan_id       TEXT NOT NULL REFERENCES nutrition_plans (id) ON DELETE CASCADE,
  food_id       TEXT REFERENCES foods (id) ON DELETE SET NULL,
  meal          TEXT NOT NULL CHECK (meal IN ('breakfast', 'mid_morning', 'lunch', 'pre_workout', 'post_workout', 'evening_snack', 'dinner')),
  position      INTEGER NOT NULL,
  servings      NUMERIC(5,2) NOT NULL CHECK (servings > 0 AND servings <= 20),
  note          TEXT NOT NULL DEFAULT '',
  food_name     TEXT NOT NULL,
  serving_size  TEXT NOT NULL,
  calories      NUMERIC(7,1) NOT NULL,
  protein_g     NUMERIC(6,1) NOT NULL,
  carbs_g       NUMERIC(6,1) NOT NULL,
  fat_g         NUMERIC(6,1) NOT NULL
);
CREATE INDEX nutrition_plan_items_plan_idx ON nutrition_plan_items (plan_id, position);

-- ── Starter food list ───────────────────────────────────────────────────────
-- Values per serving from standard nutrition tables (USDA FoodData Central;
-- IFCT for paneer and roasted chana). Brands and recipes vary: admins can edit.
INSERT INTO food_categories (name) VALUES
  ('Grains & cereals'), ('Pulses & legumes'), ('Vegetables'), ('Fruits'), ('Dairy'),
  ('Eggs, meat & fish'), ('Nuts & seeds'), ('Snacks'), ('Drinks'), ('Supplements'), ('Fats & oils');

INSERT INTO foods (category_id, name, serving_size, calories, protein_g, carbs_g, fat_g, diet_type)
SELECT fc.id, f.name, f.serving, f.kcal, f.prot, f.carb, f.fat, f.diet
FROM (VALUES
  ('Grains & cereals', 'White rice, cooked', '1 cup (158 g)', 205, 4.3, 44.5, 0.4, 'vegan'),
  ('Grains & cereals', 'Brown rice, cooked', '1 cup (195 g)', 216, 5.0, 44.8, 1.8, 'vegan'),
  ('Grains & cereals', 'Chapati / roti (no ghee)', '1 medium (30 g flour)', 102, 4.0, 21.6, 0.8, 'vegan'),
  ('Grains & cereals', 'Oats, dry', '1/2 cup (40 g)', 152, 5.3, 27.1, 2.6, 'vegan'),
  ('Grains & cereals', 'Poha (flattened rice), dry', '1/2 cup (40 g)', 138, 2.6, 30.8, 0.5, 'vegan'),
  ('Grains & cereals', 'Idli', '1 piece (40 g)', 58, 1.6, 12.0, 0.2, 'vegan'),
  ('Grains & cereals', 'Whole wheat bread', '1 slice (32 g)', 81, 4.0, 13.8, 1.1, 'vegan'),
  ('Grains & cereals', 'White bread', '1 slice (25 g)', 67, 1.9, 12.7, 0.8, 'vegan'),
  ('Grains & cereals', 'Quinoa, cooked', '1 cup (185 g)', 222, 8.1, 39.4, 3.6, 'vegan'),
  ('Pulses & legumes', 'Lentil dal, cooked (no oil)', '1 bowl (150 g)', 174, 13.5, 30.0, 0.6, 'vegan'),
  ('Pulses & legumes', 'Rajma (kidney beans), cooked', '1 cup (177 g)', 225, 15.3, 40.4, 0.9, 'vegan'),
  ('Pulses & legumes', 'Chickpeas (chana), cooked', '1 cup (164 g)', 269, 14.5, 45.0, 4.2, 'vegan'),
  ('Pulses & legumes', 'Moong sprouts', '1 cup (104 g)', 31, 3.2, 6.2, 0.2, 'vegan'),
  ('Pulses & legumes', 'Soya chunks, dry', '50 g', 173, 26.0, 16.5, 0.3, 'vegan'),
  ('Pulses & legumes', 'Tofu, firm', '100 g', 144, 17.3, 2.8, 8.7, 'vegan'),
  ('Vegetables', 'Potato, boiled', '1 medium (150 g)', 130, 2.8, 30.2, 0.2, 'vegan'),
  ('Vegetables', 'Sweet potato, boiled', '100 g', 76, 1.4, 17.7, 0.1, 'vegan'),
  ('Vegetables', 'Spinach, cooked', '1 cup (180 g)', 41, 5.3, 6.8, 0.5, 'vegan'),
  ('Vegetables', 'Broccoli, cooked', '1 cup (156 g)', 55, 3.7, 11.2, 0.6, 'vegan'),
  ('Vegetables', 'Green peas, cooked', '1 cup (160 g)', 134, 8.6, 25.0, 0.4, 'vegan'),
  ('Vegetables', 'Cucumber', '1 cup sliced (104 g)', 16, 0.7, 3.8, 0.1, 'vegan'),
  ('Vegetables', 'Tomato', '1 medium (123 g)', 22, 1.1, 4.8, 0.2, 'vegan'),
  ('Vegetables', 'Carrot', '1 medium (61 g)', 25, 0.6, 5.8, 0.1, 'vegan'),
  ('Fruits', 'Banana', '1 medium (118 g)', 105, 1.3, 27.0, 0.4, 'vegan'),
  ('Fruits', 'Apple', '1 medium (182 g)', 95, 0.5, 25.0, 0.3, 'vegan'),
  ('Fruits', 'Orange', '1 medium (131 g)', 62, 1.2, 15.4, 0.2, 'vegan'),
  ('Fruits', 'Papaya', '1 cup pieces (145 g)', 62, 0.7, 15.7, 0.4, 'vegan'),
  ('Fruits', 'Mango', '1 cup pieces (165 g)', 99, 1.4, 24.7, 0.6, 'vegan'),
  ('Fruits', 'Watermelon', '1 cup pieces (152 g)', 46, 0.9, 11.5, 0.2, 'vegan'),
  ('Fruits', 'Grapes', '1 cup (151 g)', 104, 1.1, 27.3, 0.2, 'vegan'),
  ('Fruits', 'Guava', '1 medium (55 g)', 37, 1.4, 7.9, 0.5, 'vegan'),
  ('Fruits', 'Dates (Medjool)', '1 piece (24 g)', 66, 0.4, 18.0, 0.0, 'vegan'),
  ('Dairy', 'Milk, whole', '1 glass (250 ml)', 150, 8.0, 11.8, 8.0, 'veg'),
  ('Dairy', 'Milk, skimmed', '1 glass (250 ml)', 85, 8.4, 12.2, 0.2, 'veg'),
  ('Dairy', 'Curd / plain yogurt (whole milk)', '1 cup (245 g)', 149, 8.5, 11.4, 8.0, 'veg'),
  ('Dairy', 'Greek yogurt, plain non-fat', '1 cup (170 g)', 100, 17.3, 6.1, 0.7, 'veg'),
  ('Dairy', 'Paneer', '100 g', 265, 18.3, 1.2, 20.8, 'veg'),
  ('Dairy', 'Cheddar cheese', '1 slice (28 g)', 113, 7.0, 0.4, 9.3, 'veg'),
  ('Dairy', 'Buttermilk, low-fat', '1 glass (245 ml)', 98, 8.1, 11.7, 2.2, 'veg'),
  ('Eggs, meat & fish', 'Egg, whole (boiled)', '1 large (50 g)', 78, 6.3, 0.6, 5.3, 'egg'),
  ('Eggs, meat & fish', 'Egg white', '1 large (33 g)', 17, 3.6, 0.2, 0.1, 'egg'),
  ('Eggs, meat & fish', 'Chicken breast, cooked (skinless)', '100 g', 165, 31.0, 0.0, 3.6, 'non_veg'),
  ('Eggs, meat & fish', 'White fish (cod), cooked', '100 g', 105, 22.8, 0.0, 0.9, 'non_veg'),
  ('Eggs, meat & fish', 'Salmon, cooked', '100 g', 206, 22.1, 0.0, 12.4, 'non_veg'),
  ('Eggs, meat & fish', 'Mutton (goat), cooked', '100 g', 143, 27.1, 0.0, 3.0, 'non_veg'),
  ('Eggs, meat & fish', 'Prawns, cooked', '100 g', 99, 24.0, 0.2, 0.3, 'non_veg'),
  ('Eggs, meat & fish', 'Tuna, canned in water', '100 g', 116, 25.5, 0.0, 0.8, 'non_veg'),
  ('Nuts & seeds', 'Almonds', '10 pieces (12 g)', 69, 2.5, 2.6, 6.0, 'vegan'),
  ('Nuts & seeds', 'Peanuts, roasted', '30 g', 176, 7.3, 6.4, 14.9, 'vegan'),
  ('Nuts & seeds', 'Peanut butter', '1 tbsp (16 g)', 94, 4.0, 3.2, 8.1, 'vegan'),
  ('Nuts & seeds', 'Walnuts', '7 halves (14 g)', 92, 2.1, 1.9, 9.2, 'vegan'),
  ('Nuts & seeds', 'Chia seeds', '1 tbsp (12 g)', 58, 2.0, 5.1, 3.7, 'vegan'),
  ('Nuts & seeds', 'Flax seeds', '1 tbsp (10 g)', 53, 1.8, 2.9, 4.2, 'vegan'),
  ('Snacks', 'Roasted chana (Bengal gram)', '30 g', 111, 6.8, 17.4, 1.6, 'vegan'),
  ('Snacks', 'Makhana (fox nuts), roasted', '1 cup (30 g)', 104, 2.9, 23.1, 0.1, 'vegan'),
  ('Snacks', 'Dark chocolate (70–85%)', '20 g', 120, 1.6, 9.2, 8.5, 'veg'),
  ('Snacks', 'Popcorn, air-popped', '1 cup (8 g)', 31, 1.0, 6.2, 0.4, 'vegan'),
  ('Drinks', 'Black coffee', '1 cup (240 ml)', 2, 0.3, 0.0, 0.0, 'vegan'),
  ('Drinks', 'Green tea', '1 cup (240 ml)', 2, 0.0, 0.0, 0.0, 'vegan'),
  ('Drinks', 'Coconut water', '1 cup (240 ml)', 46, 1.7, 8.9, 0.5, 'vegan'),
  ('Drinks', 'Orange juice, fresh', '1 glass (248 ml)', 112, 1.7, 25.8, 0.5, 'vegan'),
  ('Supplements', 'Whey protein (check your brand''s label)', '1 scoop (30 g)', 120, 24.0, 3.0, 1.5, 'veg'),
  ('Fats & oils', 'Ghee', '1 tsp (5 g)', 45, 0.0, 0.0, 5.0, 'veg'),
  ('Fats & oils', 'Butter', '1 tsp (5 g)', 36, 0.0, 0.0, 4.1, 'veg'),
  ('Fats & oils', 'Olive oil', '1 tbsp (13.5 g)', 119, 0.0, 0.0, 13.5, 'vegan'),
  ('Fats & oils', 'Cooking oil (vegetable)', '1 tsp (4.5 g)', 40, 0.0, 0.0, 4.5, 'vegan')
) AS f(category, name, serving, kcal, prot, carb, fat, diet)
JOIN food_categories fc ON fc.name = f.category;
