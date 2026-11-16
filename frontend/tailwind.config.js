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
        lime: "var(--mp-lime)",
      },
      fontFamily: {
        serif: ["Manrope", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        sans: ["Manrope", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["Manrope", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        display: ["clamp(2.6rem, 5.4vw, 4.4rem)", { lineHeight: "1.02", letterSpacing: "-0.04em" }],
        headline: ["clamp(1.9rem, 3.1vw, 2.8rem)", { lineHeight: "1.08", letterSpacing: "-0.032em" }],
        title: ["clamp(1.35rem, 1.9vw, 1.75rem)", { lineHeight: "1.15", letterSpacing: "-0.028em" }],
        micro: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.14em" }],
      },
      boxShadow: {
        lift: "0 1px 2px rgba(11, 31, 24, 0.05), 0 22px 46px -30px rgba(11, 31, 24, 0.5)",
        quiet: "0 1px 2px rgba(11, 31, 24, 0.04)",
      },
      borderRadius: {
        xs: "6px",
        sm: "12px",
        md: "16px",
        lg: "20px",
        xl: "26px",
        "2xl": "32px",
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
