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
    extend: {
      colors: {
        base: v("--bg-base"),
        chrome: v("--bg-chrome"),
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
        },
        violet: {
          DEFAULT: "#7C6BF5",
          soft: "#A296F8",
        },
        ok: "#30C88F",
        warn: "#F5A524",
        danger: "#F2545B",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
        "3xl": "28px",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
      },
      animation: {
        "mesh-drift": "mesh-drift 26s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
