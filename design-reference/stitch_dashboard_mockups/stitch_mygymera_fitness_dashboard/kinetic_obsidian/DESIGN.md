# Design System Specification: High-End Editorial Dark Mode

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Kinetic Gallery."** 

Fitness apps are often cluttered and chaotic; this system rejects that noise in favor of a sophisticated, high-end editorial experience. We treat workout data as art and progress as a curated exhibition. By leveraging intentional asymmetry, high-contrast typography scales, and overlapping surface layers, we move beyond the "standard app" look into a digital environment that feels premium, authoritative, and profoundly focused.

The system breaks the rigid "box-on-box" template by using breathing room as a functional element. We prioritize depth through tonal shifts rather than structural lines, ensuring the user's focus remains on their physical transformation, not the interface.

---

## 2. Colors & Surface Philosophy
The palette is rooted in deep, slate-toned foundations, accented by a high-energy "Hyper-Green" and a prestigious "Victors Gold."

### Primary Palette
- **Surface (Background):** `#070e1d` (The deepest slate base)
- **Primary:** `#6ffb85` (Vibrant Green for action and momentum)
- **Tertiary:** `#ffd709` (Gold for streaks, badges, and elite status)
- **Surface Containers:** 
    - Lowest: `#0b1323`
    - Low: `#11192b`
    - High: `#161f33`
    - Highest: `#1b263b`

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts. A `surface-container-low` card sitting on a `surface` background provides all the definition required. If the layout feels "lost," increase the tonal contrast between layers rather than adding a stroke.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of tinted glass. 
- Use `surface-container-lowest` for background utility areas.
- Use `surface-container-high` for interactive cards.
- Nesting: When a small component (like a stat chip) sits inside a card, the chip should use a container tier one step higher or lower than its parent card to create a natural, "milled" look.

### The "Glass & Gradient" Rule
To elevate the system above generic fitness trackers, floating elements (Modals, Bottom Nav) must use Glassmorphism. Apply `surface-variant` at 60% opacity with a `20px` backdrop-blur. 
Main CTAs should utilize a subtle linear gradient: `primary` (#6ffb85) to `primary-container` (#1db94d) at a 135-degree angle. This adds "soul" and dimension that flat hex codes lack.

---

## 3. Typography
We utilize a dual-font strategy to balance athletic performance with editorial elegance.

*   **Display & Headline (Manrope):** Bold, wide, and authoritative. Manrope provides a modern, geometric look that feels "engineered." Use large scales (`display-lg` at 3.5rem) with tighter letter-spacing (-2%) for a high-end magazine feel.
*   **Body & Labels (Inter):** Highly legible and neutral. Inter handles the heavy lifting of data, workout instructions, and secondary metadata.

**Hierarchy as Identity:** 
- **Headlines** define the brand's voice—aggressive, clear, and motivating.
- **Body** text remains "invisible," ensuring distraction-free reading during high-intensity training.

---

## 4. Elevation & Depth
In this design system, elevation is a product of light and tone, not shadows.

*   **The Layering Principle:** Depth is achieved by stacking `surface-container` tiers. A `surface-container-lowest` card on a `surface-container-low` section creates a soft, natural "recessed" effect.
*   **Ambient Shadows:** For high-priority floating elements (e.g., a "Start Workout" FAB), use an extra-diffused shadow: `offset-y: 24px`, `blur: 48px`, `color: rgba(0, 0, 0, 0.4)`. The shadow must never be harsh; it should feel like an ambient glow.
*   **The "Ghost Border" Fallback:** If a border is required for extreme accessibility cases, use the `outline-variant` token at **15% opacity**. 100% opaque borders are strictly forbidden.
*   **Tactile Feedback:** When a user interacts with a card, instead of a traditional "shadow lift," use a subtle scale-down (98%) and a slight increase in the `surface-bright` brightness to simulate physical pressure.

---

## 5. Components

### Buttons
- **Primary:** Rounded `full` (pill-shaped), using the primary-to-container gradient. Text is `on-primary-container` (Dark Green) for maximum contrast.
- **Secondary:** Transparent background with a "Ghost Border" (15% opacity `outline-variant`).
- **Tertiary:** Text-only, using the `primary` color for the label, intended for low-emphasis actions like "Cancel" or "View All."

### Cards & Progress Strips
- **Rounding:** Strictly `1.25rem` (20px) for parent cards and `1rem` (16px) for nested elements.
- **Separation:** Forbid the use of divider lines. Use `1.5rem` (24px) of vertical white space or a shift from `surface-container-low` to `surface-container-high` to distinguish workout blocks.

### The "Victory" Chip
Specific to the fitness context, any streak or badge element uses the `tertiary` (Gold) color. These should have a subtle outer glow (4px blur) of the same color to make achievements feel "radiant."

### Input Fields
Dark backgrounds (`surface-container-highest`) with no borders. Focus state is indicated by a 2px vertical "accent bar" of `primary` green on the left edge of the input, rather than a full-box highlight.

---

## 6. Do's and Don'ts

### Do:
*   **DO** use asymmetric layouts. For example, a large display-stat on the left with smaller metadata stacked vertically on the right.
*   **DO** use "Primary Green" sparingly. It is a laser, not a paint bucket. Use it only for the most critical actions.
*   **DO** leave more whitespace than you think is necessary. Space is a luxury indicator.

### Don't:
*   **DON'T** use 1px dividers between list items. Use tonal shifts or whitespace.
*   **DON'T** use pure white (#FFFFFF) for body text. Use `on-surface-variant` (#a4abbf) to reduce eye strain in dark mode.
*   **DON'T** use standard "drop shadows" with zero blur. If a shadow doesn't look like natural light, don't use it.
*   **DON'T** use square corners. This system is fluid and organic; everything must have a radius.

---

## 7. Design Tokens (Quick Ref)

| Token | Value | Application |
| :--- | :--- | :--- |
| `surface` | #070e1d | Main app background |
| `primary` | #6ffb85 | Main action buttons / Progress bars |
| `tertiary` | #ffd709 | Streaks, Badges, Gold Status |
| `radius-lg` | 2rem | Hero Cards / Major Sections |
| `radius-md` | 1.5rem | Standard UI Cards |
| `radius-sm` | 0.5rem | Small chips / Tags |
| `glass-blur` | 20px | Navigation bars / Floating Overlays |