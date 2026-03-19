import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        neon: "#00ff87",
        electric: "#4d8cff",
        surface: "#111118",
        dim: "#2a2a35",
      },
      fontFamily: {
        display: ["Clash Display", "sans-serif"],
        sans: ["Satoshi", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      keyframes: {
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        "fade-up": { "0%": { opacity: "0", transform: "translateY(40px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "line-expand": { "0%": { transform: "scaleX(0)" }, "100%": { transform: "scaleX(1)" } },
        "neon-pulse": {
          "0%,100%": { boxShadow: "0 0 20px rgba(0,255,135,0.15)" },
          "50%": { boxShadow: "0 0 30px rgba(0,255,135,0.3)" },
        },
        "letter-reveal": {
          "0%": { opacity: "0", transform: "translateY(60px) rotateX(-40deg)" },
          "100%": { opacity: "1", transform: "translateY(0) rotateX(0)" },
        },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        "marquee-fast": "marquee 25s linear infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) forwards",
        "line-expand": "line-expand 1.2s cubic-bezier(0.16,1,0.3,1) forwards",
        "neon-pulse": "neon-pulse 3s ease-in-out infinite",
        "letter-reveal": "letter-reveal 0.7s cubic-bezier(0.16,1,0.3,1) forwards",
      },
      boxShadow: {
        neon: "0 0 20px rgba(0,255,135,0.15), 0 0 60px rgba(0,255,135,0.05)",
        "neon-strong": "0 0 30px rgba(0,255,135,0.3), 0 0 80px rgba(0,255,135,0.1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
