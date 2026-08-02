---
name: Lumina Monoscale
colors:
  surface: '#fdf8f8'
  surface-dim: '#ddd9d9'
  surface-bright: '#fdf8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f2f2'
  surface-container: '#f1eded'
  surface-container-high: '#ece7e7'
  surface-container-highest: '#e6e1e1'
  on-surface: '#1c1b1c'
  on-surface-variant: '#444748'
  inverse-surface: '#313030'
  inverse-on-surface: '#f4f0f0'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c9c6c5'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e1dfdf'
  on-secondary-container: '#626262'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c1b1b'
  on-tertiary-container: '#858383'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c9c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#484646'
  secondary-fixed: '#e4e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c9c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#484646'
  background: '#fdf8f8'
  on-background: '#1c1b1c'
  surface-variant: '#e6e1e1'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
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
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system is rooted in a philosophy of "Essentialism." It draws heavily from the lineage of modern corporate and computing design, emphasizing clarity, precision, and an uncompromising focus on content. The target audience includes professionals in high-fidelity environments where cognitive load must be minimized to facilitate deep work.

The aesthetic blends **Modern Corporate** efficiency with **Minimalist** restraint. It utilizes a vast amount of whitespace to create a sense of calm and luxury. By removing the distraction of vibrant color, the user's attention is funneled toward typography and information hierarchy. The emotional response is one of trust, stability, and high-quality craftsmanship.

## Colors

The palette is strictly monochrome, relying on a sophisticated spectrum of grays to communicate depth and hierarchy. 

- **Primary Background**: A warm, ultra-light off-white (#FDF8F8) provides a softer canvas than pure white, reducing eye strain.
- **Accents**: Stark black (#010101) is reserved for primary actions, headings, and critical iconography to ensure maximum contrast.
- **Hierarchy**: Grays are used systematically. Mid-grays signify secondary information, while hair-line borders and soft surface fills distinguish nested containers.
- **Interactive States**: Use subtle shifts in grayscale (e.g., #010101 at 90% opacity for hover) rather than color shifts.

## Typography

This design system uses **Inter** exclusively to achieve a systematic, utilitarian appearance reminiscent of San Francisco. 

Hierarchy is established through extreme weight contrast. Headings should be bold or semi-bold and slightly tracked in (negative letter spacing) to appear tighter and more "designed." Body text is kept at a comfortable 16px to ensure legibility. Labels and metadata should use medium or semi-bold weights at smaller sizes to remain prominent without requiring large font sizes.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model with generous safe areas. 

- **Desktop**: A 12-column grid with 24px gutters. Content should be centered with a max-width of 1280px to prevent excessive line lengths.
- **Mobile**: A 4-column grid with 16px margins.
- **Rhythm**: All spacing is derived from an 8px base unit. Vertical rhythm is critical; use `lg` (48px) spacing between major sections and `md` (24px) between grouped elements to maintain a breathable, premium feel.

## Elevation & Depth

Elevation in this design system is understated. It moves away from physical depth and toward **Tonal Layering** supplemented by **Ambient Shadows**.

- **Level 0 (Background)**: #FDF8F8.
- **Level 1 (Cards/Surfaces)**: White (#FFFFFF) with a 1px hairline border (#E5E1E1).
- **Shadows**: Use a single, highly diffused shadow for elevated elements: `0px 4px 20px rgba(0, 0, 0, 0.04)`. This creates a sense of "lift" without creating visual "mud."
- **Active State**: Elements being pressed or active should remove their shadow and slightly darken their border to simulate physical contact with the surface.

## Shapes

The shape language is "Hyper-Rounded," creating an approachable and modern feel that contrasts with the stark monochrome colors. 

Standard components (buttons, inputs) utilize a **0.5rem (8px)** base radius. Larger containers, such as modal sheets and feature cards, should use **1.5rem (24px)** to emphasize their role as distinct sections of the interface. This high roundness mimics the hardware aesthetics of modern premium devices.

## Components

- **Buttons**:
  - *Primary*: Solid #010101 background with White text. No border.
  - *Secondary*: White background with 1px #E5E1E1 border and #010101 text.
- **Inputs**:
  - Background: #FFFFFF. Border: 1px #E5E1E1. Use `label-md` for floating or top-aligned labels.
  - Focus state: Border color shifts to #010101; no "glow" effects.
- **Cards**: 
  - Pure white background, 24px padding, 1px hairline border, and subtle ambient shadow.
- **Chips**:
  - Small, pill-shaped elements with a light gray fill (#F5F2F2) and `label-sm` text.
- **Icons**: 
  - Use 24px Lucide-style line icons. Maintain a consistent 1.5px or 2px stroke weight. Icons must be the same color as the adjacent text for visual unity.
- **Lists**: 
  - Clean, borderless rows separated by 1px horizontal rules (#E5E1E1). Use generous vertical padding (16px) per item.