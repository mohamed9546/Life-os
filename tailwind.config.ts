import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
          4: "var(--surface-4)",
        },
        accent: {
          DEFAULT: "#5d88ad",
          hover: "#76a5cd",
          muted: "#456b8d",
          subtle: "rgba(93, 136, 173, 0.14)",
        },
        success: { DEFAULT: "#5ea878", muted: "rgba(94, 168, 120, 0.16)" },
        warning: { DEFAULT: "#d5a062", muted: "rgba(213, 160, 98, 0.16)" },
        danger: { DEFAULT: "#d07373", muted: "rgba(208, 115, 115, 0.16)" },
        info: { DEFAULT: "#77a8c8", muted: "rgba(119, 168, 200, 0.16)" },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
      },
      fontFamily: {
        sans: ["Manrope", "Aptos", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "JetBrains Mono", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        glow: "0 0 20px rgba(93, 136, 173, 0.14)",
        "glow-accent": "0 0 26px rgba(93, 136, 173, 0.22)",
        "glow-success": "0 0 20px rgba(94, 168, 120, 0.14)",
        "glow-danger": "0 0 20px rgba(208, 115, 115, 0.14)",
        glass: "0 14px 40px rgba(3, 8, 14, 0.34), inset 0 1px 0 rgba(255,255,255,0.05)",
        "card-hover": "0 18px 48px rgba(3, 8, 14, 0.38), 0 0 0 1px rgba(93,136,173,0.14)",
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #36556f 0%, #5f8f96 100%)",
        "card-gradient": "linear-gradient(135deg, rgba(71, 104, 133, 0.14) 0%, rgba(95, 143, 150, 0.06) 100%)",
        "surface-gradient": "linear-gradient(180deg, var(--surface-1) 0%, var(--surface-0) 100%)",
        "shimmer": "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
        "slide-down": "slideDown 0.25s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        "shimmer": "shimmer 1.8s infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(93,136,173,0.18)" },
          "50%": { boxShadow: "0 0 25px rgba(93,136,173,0.3)" },
        },
      },
      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
      },
    },
  },
  plugins: [],
};
export default config;
