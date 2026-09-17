import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0e0d0b",
        clay: "#171511",
        paper: "#f4efe6",
        mist: "#b9b0a3",
        moss: "#d6f25a",
        ember: "#ff5c39",
        sand: "#2a261f",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(214,242,90,0.22), 0 24px 70px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
