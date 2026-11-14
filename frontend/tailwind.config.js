/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--mp-bg)",
        paper: "var(--mp-surface)",
        subtle: "var(--mp-subtle)",
        ink: "var(--mp-text)",
        muted: "var(--mp-muted)",
        navy: "var(--mp-navy)",
        accent: "var(--mp-accent)",
        positive: "var(--mp-positive)",
        warning: "var(--mp-warning)",
        negative: "var(--mp-negative)",
        line: "var(--mp-border)",
      },
      fontFamily: {
        serif: ["'DM Serif Display'", "Georgia", "'Times New Roman'", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        display: ["clamp(2.9rem, 6.2vw, 5.6rem)", { lineHeight: "0.98", letterSpacing: "-0.025em" }],
        headline: ["clamp(2.1rem, 3.6vw, 3.4rem)", { lineHeight: "1.04", letterSpacing: "-0.02em" }],
        title: ["clamp(1.5rem, 2.2vw, 2.1rem)", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        micro: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.14em" }],
      },
      boxShadow: {
        lift: "0 18px 46px -28px rgba(24, 42, 58, 0.35)",
        quiet: "0 1px 0 rgba(24, 42, 58, 0.04)",
      },
      borderRadius: {
        xs: "2px",
        sm: "3px",
      },
      maxWidth: {
        page: "1240px",
        prose: "68ch",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
