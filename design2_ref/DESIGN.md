# Design System: The Breathing Image

## 1. Overview & Creative North Star

### Creative North Star: "The Ethereal Curator"
This design system rejects the industrial rigidity of the modern web in favor of an archival, gallery-like experience. Our goal is to move away from "contained" UI and toward "spatial" UI. We do not box content; we hold it.

The system is built on the concept of **The Breathing Image**. In traditional digital design, images are often trapped in cards with hard borders. Here, images are allowed to bleed into their surroundings, separated only by light, air, and tonal shifts. By utilizing expansive negative space and a light-weight typographic scale, we create a sense of "Quiet Luxury"—where the interface recedes to let the art speak.

**Key Deviations from Standard UI:**
*   **Intentional Asymmetry:** Avoid perfectly centered, rigid grids. Offset images and text to create a sense of movement and "breath."
*   **The Weightless Anchor:** Elements should feel like they are floating in a curated void rather than being pinned to a coordinate.
*   **Soft Boundaries:** We use the physics of light (tonal layering) instead of the physics of print (lines).

---

## 2. Colors

Our palette is a collection of sophisticated neutrals designed to eliminate high-contrast jarring. We avoid pure #000000 and pure #FFFFFF in favor of "living" off-whites and charcoal grays.

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are strictly prohibited for sectioning or containment. 
Boundaries must be defined through:
1.  **Background Shifts:** Transitioning from `surface` (#f9f9f7) to `surface_container_low` (#f2f4f2).
2.  **Tonal Transitions:** Using soft gradients of `surface_variant` to define edges.

### Surface Hierarchy & Nesting
Instead of a flat grid, treat the UI as stacked sheets of fine archival paper. Use the following tiers to create depth:
*   **Base Layer:** `surface` (#f9f9f7) for the primary canvas.
*   **De-emphasized Content:** `surface_container_low` (#f2f4f2) for background sections.
*   **Interactive/Elevated Elements:** `surface_container_lowest` (#ffffff) to make cards "pop" through lightness rather than shadows.

### The "Glass & Gradient" Rule
To achieve the "Ethereal" keyword, use Glassmorphism for floating navigation or overlays. Use `surface` at 70% opacity with a `24px` backdrop-blur. For main CTAs, apply a subtle linear gradient from `primary` (#5f5e5e) to `primary_dim` (#535252) to provide a tactile, silk-like finish.

---

## 3. Typography

**Primary Typeface:** Manrope
The typography must feel "airy." Manrope’s geometric yet warm structure is our anchor.

*   **Display & Headline:** Use `light` (300) or `extra-light` (200) weights. Increase tracking (letter-spacing) by `0.05em` for `display-lg` and `headline-lg` to allow the words to "breathe."
*   **Body:** Use `body-md` (0.875rem) for primary reading. Ensure a generous line-height (1.6 - 1.8) to maintain the spatial theme.
*   **Labels:** `label-sm` should always be in uppercase with `0.1em` tracking to act as a sophisticated "meta" layer, reminiscent of gallery wall-tags.

| Role | Size | Weight | Tracking |
| :--- | :--- | :--- | :--- |
| **Display-LG** | 3.5rem | 200 | 0.05em |
| **Headline-SM** | 1.5rem | 300 | 0.02em |
| **Title-MD** | 1.125rem | 500 | Normal |
| **Label-MD** | 0.75rem | 600 | 0.1em (Caps) |

---

## 4. Elevation & Depth

We convey hierarchy through **Tonal Layering** rather than structural lines.

### The Layering Principle
Depth is achieved by "stacking" surface tiers. To highlight an image description, place a `surface_container_highest` (#dee4e0) container behind the text, nestled within a `surface` page. The difference is felt, not seen.

### Ambient Shadows
Shadows are rarely used. When necessary (e.g., a floating modal), they must be "Ambient":
*   **Blur:** 40px - 60px
*   **Opacity:** 4% - 6%
*   **Color:** Derived from `on_surface` (#2d3432), never pure black.

### The "Ghost Border" Fallback
If a boundary is required for accessibility, use the "Ghost Border": `outline_variant` (#adb3b0) at **15% opacity**. It should be a suggestion of an edge, not a cage.

---

## 5. Components

### Cards & Image Containers
*   **Rule:** Forbid divider lines and hard containers. 
*   **Styling:** Use `surface_container_low` for the image background. Apply a `DEFAULT` (0.25rem) or `md` (0.375rem) corner radius. The image should appear to be "resting" on the paper. 
*   **Spacing:** Use extreme padding (minimum 48px) between the image and the edge of its container to create the "Breathing" effect.

### Buttons
*   **Primary:** `primary` (#5f5e5e) background with `on_primary` text. Use `full` (pill) rounding for a soft, organic feel.
*   **Secondary:** `surface_container_high` background. No border.
*   **Tertiary:** Text only, using `primary` color with an underline that appears only on hover—the underline should be a `2px` stroke of `primary_fixed_dim`.

### Input Fields
*   **Style:** Minimalist. Only a bottom stroke using `outline_variant` at 30% opacity. 
*   **Focus State:** The stroke transitions to `primary` (#5f5e5e) and the label (using `label-md`) shifts upward with a 200ms ease-in-out transition.

### Signature Component: The "Spatial Lightbox"
When an image is selected, it should occupy the center of the screen with a `surface` (#f9f9f7) backdrop at 98% opacity. This mimics a physical gallery space. Metadata should be tucked into the bottom-right using `label-sm` in `on_surface_variant`.

---

## 6. Do’s and Don’ts

### Do:
*   **DO** use whitespace as a functional element. If in doubt, add more padding.
*   **DO** use `surface_container` tokens to differentiate content blocks.
*   **DO** use Manrope in its lighter weights to maintain a "whisper" in the UI.
*   **DO** ensure all images have a subtle `2px` inner glow or "soft edge" to blend into the background.

### Don’t:
*   **DON'T** use 100% opaque black (#000000) for text; use `on_surface` (#2d3432) to keep the contrast "quiet."
*   **DON'T** use traditional 1px borders or "cards" with heavy shadows.
*   **DON'T** cram elements. Every image should feel like the only item in the room.
*   **DON'T** use "High-Contrast" mode as the default aesthetic. Transitions should be buttery and low-impact.