import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#f4f1ea",
        ink: "#171717",
        wash: "#ece8de",
        accent: "#c86c3a",
        accentSoft: "#f2d8c7",
        signal: "#b8d6ca",
      },
      fontFamily: {
        display: ["Georgia", "Times New Roman", "serif"],
        body: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 18px 40px rgba(23, 23, 23, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
