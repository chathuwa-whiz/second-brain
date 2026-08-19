import type { Config } from "tailwindcss";

/*
  Colors resolve to the CSS custom properties defined in app/globals.css via
  Tailwind's <alpha-value> placeholder, so a class like `bg-surface` or
  `text-secondary/60` renders correctly in both themes with no `dark:` variants
  anywhere in the markup. Switching themes is a single data-theme attribute
  swap on <html>.
*/
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    screens: {
      xs: "420px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        /*
          NOT named `base`. Tailwind derives `text-<key>` from BOTH `fontSize`
          and `colors`, and `fontSize.base` already exists - so a color named
          `base` emits a second `.text-base { color: ... }` rule. Unprefixed,
          `.text-primary` is emitted later and wins; but `sm:text-base` lands
          in a media block that comes after every unprefixed utility, so it
          beat `.text-primary` and painted headings in the page background
          colour. Any key colliding with a fontSize key (xs, sm, base, lg,
          xl, 2xl...) will do this - keep colour names clear of them.
        */
        canvas: v("--bg-base"),
        chrome: v("--bg-chrome"),
        // Solid surface that sits *above* glass - segmented-control thumbs,
        // active tabs, popover menus. Glass-on-glass has no depth cue.
        raised: v("--surface-raised"),
        primary: v("--text-primary"),
        secondary: v("--text-secondary"),
        muted: v("--text-muted"),
        hairline: v("--hairline"),

        // Fixed accents - identical in both themes so status colors stay
        // learnable. Only their surrounding surfaces change.
        accent: {
          /*
            The new theme's brand color is #72E3AD, a light mint that's only
            ~1.5:1 against white as text and unreadable under the "text-white"
            this app hardcodes on solid accent buttons/nav pills. DEFAULT is
            darkened to emerald-700, which still reads as "the new green
            brand" while clearing 4.5:1 under white text everywhere it's used
            at full opacity (nav active states, admin buttons).
          */
          DEFAULT: "#047857",
          soft: "#34D399",
          deep: "#065F46",
          // Theme-aware; use for accent-coloured TEXT, not fills.
          ink: v("--accent-ink"),
          /*
            `solid` = the fill under WHITE label text, e.g. a primary button.
            One step darker than DEFAULT for CTA hierarchy (measures 7.7:1
            against white).
          */
          solid: "#065F46",
        },
        violet: {
          DEFAULT: "#7C6BF5",
          soft: "#A296F8",
          ink: v("--violet-ink"),
        },
        // Fills. Identical in both themes so the colour coding stays learnable.
        // `solid` is the darker variant used under white button text (see accent).
        ok: { DEFAULT: "#30C88F", ink: v("--ok-ink"), solid: "#12855E" },
        warn: { DEFAULT: "#F5A524", ink: v("--warn-ink"), solid: "#8C5400" },
        // The new theme's --destructive; measures 5.3:1 against white, so
        // DEFAULT and solid can share one value instead of needing two shades.
        danger: { DEFAULT: "#CA3214", ink: v("--danger-ink"), solid: "#CA3214" },
      },
      /*
        Deliberately tighter than Tailwind's defaults. The interface nests
        panels three deep in places (card > group > pill), and at 20px+ each
        nested corner reads as a separate blob - the "everything is a lozenge"
        look. This ladder keeps the outer card soft and the inner elements
        near-square, so nesting still reads as one object.
      */
      borderRadius: {
        lg: "8px",
        xl: "10px",
        "2xl": "14px",
        "3xl": "18px",
      },
      fontSize: {
        "3xs": ["0.625rem", { lineHeight: "0.875rem", letterSpacing: "0.03em" }],
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
    },
  },
  plugins: [],
};

export default config;
