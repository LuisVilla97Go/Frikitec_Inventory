/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#F27145",
          primaryDark: "#C2410C",
          secondary: "#5B5B5B",
          dark: "#282828",
          success: "#2E9E7B",
          error: "#DE2A2A",
          bg: "#FFFFFF",
          bgSecondary: "#F5F5F5",
          border: "#DFDFDF",
        },
      },
      fontFamily: {
        heading: ["Tomorrow", "sans-serif"],
        body: ["Rubik", "sans-serif"],
      },
    },
  },
  plugins: [],
};
