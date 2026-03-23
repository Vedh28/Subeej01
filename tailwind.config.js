const frontendConfig = require("./frontend/tailwind.config.js");

module.exports = {
  ...frontendConfig,
  content: ["./frontend/pages/**/*.{ts,tsx}", "./frontend/components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"]
};
