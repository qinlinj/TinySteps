/** @type {import("tailwindcss").Config} */
const preset = {
  theme: {
    extend: {
      colors: {
        paper: "#F7F3EC",
        ink: "#1C1917",
        stone: { DEFAULT: "#E8E0D2", deep: "#D4CBBA" },
        sage: { DEFAULT: "#3F6F5B", soft: "#5A8A74", mist: "#E4EDE8", deep: "#2F5545" },
        moss: { DEFAULT: "#5B7F62", mist: "#E6EFE8" },
        clay: { DEFAULT: "#A67C6D", mist: "#F0E6E0" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", "sans-serif"],
      },
      fontSize: { lg: ["1.125rem", { lineHeight: "1.6" }] },
      minHeight: { hit: "48px" },
      minWidth: { hit: "48px" },
      borderRadius: { "3xl": "1.5rem" },
      boxShadow: {
        card: "0 1px 2px rgba(28, 25, 23, 0.04), 0 8px 24px rgba(28, 25, 23, 0.04)",
      },
      transitionDuration: { 500: "500ms" },
      transitionTimingFunction: { out: "cubic-bezier(0, 0, 0.2, 1)" },
    },
  },
};

export default preset;
