# Design System: The Silent Curator

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Exhibition of Space."** 

We are moving away from the cluttered "dashboard" aesthetic of modern SaaS. This system views the screen as a museum gallery where the interface is the matting and the content is the art. It embodies the persona of **The Silent Curator**: an entity that provides structure and context without ever shouting for attention. 

To achieve a "high-end editorial" feel, we reject the standard 8px-grid-filling-everything approach. Instead, we use intentional asymmetry, overlapping elements that mimic physical paper layers, and a typography scale that favors dramatic contrasts between massive headlines and microscopic, precise labels.

---

## 2. Colors & Materiality
This system is built on a foundation of deep, ink-like blacks and warm, aged whites, creating a "museum-grade" atmosphere.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders to section off content. In this system, boundaries are defined by light and shadow, not lines. 
- Use background color shifts (e.g., a `surface-container-low` section sitting on a `surface` background) to create zones.
- Use generous white space (Exhibition Spacing) to imply separation.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—stacked sheets of heavy-weight paper.
- **Surface (`#131313`):** The gallery wall.
- **Surface-Container-Lowest (`#0E0E0E`):** Recessed areas, used for secondary navigation or inactive zones.
- **Surface-Container-Highest (`#353534`):** The "Active Layer." Use this for cards or modals that need to feel physically closer to the user.

### Signature Textures
To move beyond a flat digital feel, apply a subtle **Grain Overlay** (2-4% opacity) across the entire background. This mimics the texture of premium paper stock. Main CTAs should utilize a subtle gradient from `primary` (#FFFFFF) to `primary-container` (#D7D4CD) to provide a "metallic" or "satin" sheen that flat color cannot replicate.

---

## 3. Typography
We utilize **Manrope** exclusively. Its geometric yet approachable nature allows it to function as both a structural element and a readable body face.

- **Display (Large):** Use `display-lg` (3.5rem) with tight letter-spacing (-0.02em) for hero moments. It should feel architectural.
- **Body:** Use `body-md` (0.875rem) for long-form text. Ensure line-height is generous (1.6) to maintain the editorial "breathe."
- **Labels:** Use `label-sm` (0.6875rem) in All-Caps with wide tracking (+0.1em). These are your "exhibit labels"—tiny, precise, and authoritative.

---

## 4. Elevation & Depth
In this system, depth is achieved through **Tonal Layering** rather than traditional structural lines.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. The subtle shift in hex code creates a soft, natural lift.
- **Ambient Shadows:** Shadows are rarely used. When required for "floating" elements, use a "Shadow as Atmosphere" approach: 
    - **Blur:** 40px–60px.
    - **Opacity:** 4%–8% of the `on-surface` color.
- **Glassmorphism:** For overlays or navigation bars, use `surface` with a 70% opacity and a `backdrop-filter: blur(20px)`. This creates a "frosted matting" effect that allows background content to bleed through softly.

---

## 5. Components

### Roundedness Scale
**Value: 0px.**
There are no rounded corners in this system. Every element—buttons, cards, inputs—must have sharp, 90-degree corners to reflect a brutalist, architectural precision.

### Buttons
- **Primary:** High-contrast. Background: `primary` (#FFFFFF), Text: `on-primary` (#1C1C18). No border.
- **Secondary:** Background: `transparent`, Text: `primary` (#FFFFFF). Use a "Ghost Border" fallback (outline-variant at 20% opacity) if necessary for visibility on complex backgrounds.
- **Tertiary:** Underlined text only, 12px padding, no container.

### Segmented Controls
Sharp-edged boxes with no gaps between segments. The active state is indicated by a full inversion (White background with Black text) or a shift to `surface-bright`.

### Minimalist Sliders
A single 1px line (`outline-variant`). The handle (thumb) is a sharp-edged square (8px x 8px) in `primary` white. No shadows.

### Cards & Lists
**Prohibited:** Divider lines. 
**Required:** Separate list items using a 16px or 24px vertical gap. For cards, use `surface-container-low` with no border. Content should be "matted" with large internal padding (minimum 40px).

### Input Fields
Avoid the "box" look. Use a `surface-container-highest` background with a bottom-only border of 1px using the `outline` token. Label text should always be in the `label-sm` (All-Caps) style, positioned 8px above the input.

---

## 6. Do's and Don'ts

### Do:
- **Embrace Asymmetry:** Align a headline to the far left and the body text to the center-right to create visual tension.
- **Use "Exhibition Spacing":** If you think there is enough space between sections, double it.
- **Focus on Typography Scale:** Let the size of the text define the importance, not a bright color.

### Don't:
- **Don't use Rounded Corners:** Even a 2px radius breaks the "Silent Curator" persona.
- **Don't use Divider Lines:** Use tonal shifts in the background or empty space.
- **Don't use Pure Grey Shadows:** Always tint shadows with a hint of the background color to maintain the "Dark Editorial" warmth.
- **Don't Crowded the Frame:** If a screen feels "busy," remove an element rather than resizing it.