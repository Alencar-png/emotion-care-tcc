import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ─── Paleta Emotion Care Design System ─────────────────────
      // Primary  : Verde-esmeralda (#10b981)  — vitalidade, saúde
      // Secondary: Azul-marinho   (#1e3a8a)  — confiança, instituição
      // Bg       : #f0fdf4 (light) / Texto: #064e3b (dark forest)
      colors: {
        // Primary (esmeralda)
        primary: {
          DEFAULT: "#10b981",
          hover:   "#059669",
          active:  "#047857",
          light:   "#d1fae5",
          lighter: "#ecfdf5",
          border:  "#6ee7b7",
          dark:    "#064e3b",
        },
        // Secondary (azul-marinho)
        secondary: {
          DEFAULT: "#1e3a8a",
          hover:   "#1e40af",
          active:  "#1e3a8a",
          light:   "#dbeafe",
          lighter: "#eff6ff",
          border:  "#93c5fd",
          dark:    "#172554",
        },
        // Accent (esmeralda mais clara, para realces)
        accent: {
          DEFAULT: "#34d399",
          hover:   "#10b981",
          active:  "#059669",
        },
        // Brand — neutros do design system
        brand: {
          text:        "#064e3b",
          "text-2":    "#134e4a",
          muted:       "#6b7280",
          disabled:    "#d1d5db",
          border:      "#e5e7eb",
          "bg-muted":  "#f0fdf4",
          "bg-subtle": "#ecfdf5",
        },
        // Semânticas
        success: {
          DEFAULT: "#16a34a",
          bg:      "#f0fdf4",
          border:  "rgba(22, 163, 74, 0.3)",
        },
        warning: {
          DEFAULT: "#d97706",
          bg:      "#fffbeb",
          border:  "rgba(217, 119, 6, 0.3)",
        },
        error: {
          DEFAULT: "#dc2626",
          bg:      "#fef2f2",
          border:  "rgba(220, 38, 38, 0.3)",
        },
        info: {
          DEFAULT: "#1e3a8a",
          bg:      "#eff6ff",
          border:  "rgba(30, 58, 138, 0.3)",
        },
      },
      // ─── Tipografia ───────────────────────────────────────
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        inter:   ["Inter",   "sans-serif"],
      },
      fontSize: {
        "heading-1":   ["32px", { lineHeight: "1.2", fontWeight: "700" }],
        "heading-2":   ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "heading-3":   ["17px", { lineHeight: "1.4", fontWeight: "500" }],
        "heading-4":   ["14px", { lineHeight: "1.4", fontWeight: "500" }],
        body:          ["15px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm":     ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        caption:       ["12px", { lineHeight: "1.4", fontWeight: "400" }],
        "label-upper": ["11px", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "0.06em" }],
      },
      // ─── Espaçamento ─────────────────────────────────────
      spacing: {
        "space-1":  "4px",
        "space-2":  "8px",
        "space-3":  "12px",
        "space-4":  "16px",
        "space-5":  "20px",
        "space-6":  "24px",
        "space-8":  "32px",
        "space-10": "40px",
        "space-12": "48px",
        "space-16": "64px",
      },
      // ─── Border Radius (Design System) ────────────────────
      borderRadius: {
        sm:   "6px",
        md:   "8px",
        lg:   "12px",
        xl:   "16px",
        full: "9999px",
      },
      // ─── Sombras (tom esmeralda) ─────────────────────────
      boxShadow: {
        xs:            "0 1px 2px rgba(16, 185, 129, 0.06)",
        sm:            "0 2px 4px rgba(16, 185, 129, 0.06)",
        md:            "0 4px 12px rgba(16, 185, 129, 0.08)",
        lg:            "0 8px 32px rgba(16, 185, 129, 0.12)",
        xl:            "0 12px 48px rgba(16, 185, 129, 0.16)",
        "input-focus": "0 0 0 3px rgba(16, 185, 129, 0.18)",
        "input-error": "0 0 0 3px rgba(220, 38, 38, 0.12)",
      },
      // ─── Transições ───────────────────────────────────────
      transitionDuration: {
        "280": "280ms",
      },
      transitionTimingFunction: {
        sidebar: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      // ─── Sidebar widths ───────────────────────────────────
      width: {
        "sidebar-expanded":  "260px",
        "sidebar-collapsed": "76px",
        "sidebar-mobile":    "300px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
