import lumenPreset from "./tailwind.preset.js";

/** @type {import("tailwindcss").Config} */
export default {
  presets: [lumenPreset],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F6F1E8",
        // Numbered stone stays for leftover classes; DEFAULT/deep come from the Lumen preset.
        stone: {
          DEFAULT: "#E8E0D2",
          deep: "#D4CBBA",
          50: "#F8F4EC",
          100: "#EFE8DC",
          200: "#E4DCCE",
          300: "#D4CBBA",
          400: "#B8AD9A",
          500: "#8C8272",
          600: "#6F675A",
          700: "#4A453C",
          800: "#3A3630",
          900: "#2B2823",
        },
        sage: {
          DEFAULT: "#3F6F5B",
          soft: "#5A8A74",
          mist: "#E4EDE8",
          deep: "#2F5545",
          50: "#EAF1ED",
          100: "#D5E3DA",
          400: "#7A9B88",
          500: "#5C7B6A",
          600: "#4A6556",
          700: "#3A5044",
        },
        sand: { 400: "#C4A574", 500: "#B3915C" },
        mauve: { 400: "#9A8B9A", 500: "#7E7080" },
      },
      fontFamily: {
        sans: ["PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", "system-ui", "sans-serif"],
      },
      boxShadow: { soft: "0 10px 30px -18px rgba(58, 54, 48, 0.28)" },
    },
  },
  plugins: [],
};
