---
name: Tadbirkor ERP
colors:
  surface: '#0e1511'
  surface-dim: '#0e1511'
  surface-bright: '#343b36'
  surface-container-lowest: '#09100c'
  surface-container-low: '#161d19'
  surface-container: '#1a211d'
  surface-container-high: '#242c27'
  surface-container-highest: '#2f3632'
  on-surface: '#dde4dd'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dde4dd'
  inverse-on-surface: '#2b322d'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#e29100'
  on-tertiary-container: '#523200'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0e1511'
  on-background: '#dde4dd'
  surface-variant: '#2f3632'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '900'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  label-status:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 24px
  stack-gap: 16px
  element-padding: 12px
  touch-target-min: 48px
  button-height: 56px
---

## Brand & Style
The design system for this B2B warehouse platform is built on a foundation of **Deep Dark Glassmorphism**. It is designed to perform in high-intensity industrial environments where legibility, high contrast, and ergonomic speed are critical. 

The aesthetic is technical and futuristic, moving away from typical sterile enterprise software toward a high-performance "command center" feel. It prioritizes dark-adapted vision for warehouse workers while using vibrant emerald accents to signify movement and successful operations. Surfaces utilize depth through backdrop blurs and subtle translucency to maintain a sense of hierarchy in data-dense views.

## Colors
The palette is optimized for an OLED-first mobile experience. 
- **Core Backgrounds:** Pure black (#0a0a0a) reduces eye strain in low-light environments.
- **Emerald Primary:** Used exclusively for "Intake" and "Success" actions, guiding the user toward the completion of tasks.
- **System States:** Blue handles information and scanning logic, Amber denotes "Draft" or "Pending" inventory, and Red is reserved for destructive stock removals.
- **Glass Accents:** Surfaces use a 10% white border to define edges against the deep black background without adding visual bulk.

## Typography
Typography is split between the high-impact **Hanken Grotesk** for structural headings and the utilitarian **Inter** for data. 
- **Headings:** Use `font-black` (900) for primary titles to ensure they are readable even at a glance or under harsh warehouse lighting.
- **Metadata:** Metadata and secondary categories use `label-caps` (Space Grotesk), providing a technical, monospaced feel that differentiates descriptors from actual data values.
- **Status:** Status text uses semi-bold Inter to ensure maximum clarity on colored badges.

## Layout & Spacing
This system uses a strict 8px base grid with a focus on 16px and 24px increments.
- **Ergonomics:** All primary interactive elements (buttons, inputs, steppers) must adhere to a 48px minimum height to accommodate warehouse gloves and one-handed thumb reach.
- **Safe Zones:** Content is inset by 24px from the screen edge to prevent accidental triggers during rugged handling.
- **Density:** While mobile-first, vertical padding is generous (16px+) to ensure that row items in a long inventory list are easily distinguishable.

## Elevation & Depth
Depth is created through **Glassmorphism** rather than traditional drop shadows.
- **Surface Layering:** Cards utilize a `backdrop-filter: blur(12px)` with a semi-transparent background (`rgba(10, 10, 12, 0.8)`).
- **Borders:** Instead of heavy shadows, elevation is defined by a 1px solid top-border at 15% white and side/bottom borders at 10% white, simulating a top-down light source.
- **Overlay Shadows:** Only high-level modals or floating action buttons receive a 24px blur, 15% opacity black shadow to lift them above the glass stack.

## Shapes
The design system uses an exaggerated roundedness to soften the technical nature of the ERP.
- **Cards:** Use a 20px radius (`rounded-xl` equivalent) to create a friendly, modern container for complex data.
- **Buttons:** 16px radius ensures a "pill-like" comfort for high-frequency tapping.
- **Badges:** Use a fully circular (999px) radius to distinguish status indicators from clickable card elements.

## Components

### IntakeCard
The primary list element. Features a glass background, 20px corner radius, and a 1px subtle border. Title in `headline-sm`, metadata (e.g., SKU or Time) in `label-caps`, and the StatusBadge positioned top-right.

### LineItemRow
A streamlined row for scanning sessions. Includes a 48x48px product thumbnail (rounded 8px), `body-lg` product name, and a high-contrast quantity stepper on the right with a 48px tap target for +/- buttons.

### PrimaryButton
Full-width (container-24px margins), 56px height. Emerald Green (#10b981) background with white `headline-sm` text. Use a slight inner-glow (white 10%) on the top edge to enhance the tactile feel.

### StatusBadge
Small pill-shaped containers. 
- **DRAFT:** Amber background (20% opacity) with solid Amber text.
- **TUGALLANGAN (Finished):** Emerald background (20% opacity) with solid Emerald text.

### SegmentControl
A "Skaner vs Qo‘lda" toggle. Uses the `background_alt` as the track and a glass-morphic card with a 1px border as the active indicator. Transitions should be fluid (200ms ease-out).

### InputField
56px height. `surface_card` background with 10% white border. Placeholder text in mid-gray, active text in white. On focus, the border transitions to Primary Emerald. Icons should be Lucide-style, 20px size, stroke-width 2.