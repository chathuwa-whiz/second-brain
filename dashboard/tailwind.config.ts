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
          DEFAULT: "#5B8DEF",
          soft: "#8AB0F5",
          deep: "#3D6FD1",
          // Theme-aware; use for accent-coloured TEXT, not fills.
          ink: v("--accent-ink"),
          /*
            `solid` = the fill under WHITE label text, e.g. a primary button.
            The DEFAULT hue is only 3.23:1 against white, so it's fine as a
            tint, a bar or a dot, but not as a button someone has to read.
          */
          solid: "#3565CB",
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
        danger: { DEFAULT: "#F2545B", ink: v("--danger-ink"), solid: "#CE2F37" },
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
      animation: {
        "mesh-drift": "mesh-drift 26s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
