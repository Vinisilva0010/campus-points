/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        campusBase: "#f9f1f5",
        campusPrimary: "#381af8",
        campusHighlight: "#fc67f4",
      },
    },
  },
  plugins: [],
};
