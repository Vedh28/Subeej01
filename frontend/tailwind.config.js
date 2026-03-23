/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        seed: {
          green: "#2f7d4c",
          brown: "#7a5c3e",
          beige: "#f3efe6",
          dark: "#0f1a14",
          light: "#f8fbf6"
        }
      },
      boxShadow: {
        card: "0 20px 45px -30px rgba(15, 26, 20, 0.6)",
        glow: "0 0 40px rgba(47, 125, 76, 0.25)"
      },
      backgroundImage: {
        "grid": "linear-gradient(rgba(47,125,76,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(47,125,76,0.12) 1px, transparent 1px)",
        "radial": "radial-gradient(circle at top left, rgba(122, 92, 62, 0.35), transparent 55%)"
      },
      animation: {
        "float": "float 10s ease-in-out infinite",
        "fadeUp": "fadeUp 0.8s ease-out both"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" }
        },
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(16px)" },
          "100%": { opacity: 1, transform: "translateY(0px)" }
        }
      }
    }
  },
  plugins: []
};
