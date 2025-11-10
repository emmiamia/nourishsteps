export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        calmgreen: {
          "primary": "#4a7c59",
          "primary-focus": "#3d6650",
          "primary-content": "#ffffff",
          "secondary": "#6b8e7a",
          "secondary-focus": "#5a7a67",
          "secondary-content": "#ffffff",
          "accent": "#81a88f",
          "accent-focus": "#6b9580",
          "accent-content": "#ffffff",
          "neutral": "#3d4a41",
          "neutral-focus": "#2e3932",
          "neutral-content": "#ffffff",
          "base-100": "#f0f7f3",
          "base-200": "#e1efe7",
          "base-300": "#c8ddd4",
          "base-content": "#1a2e22",
          "info": "#5b9aa8",
          "success": "#4a7c59",
          "warning": "#d4a574",
          "error": "#d8746b",
        },
      },
    ],
  },
}
