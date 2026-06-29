/** @type {import('tailwindcss').Config} */

/** @param {string} name CSS 变量名，含 `--` 前缀 */
const c = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        page: c("--color-page"),
        surface: {
          DEFAULT: c("--color-surface"),
          light: c("--color-surface-raised"),
          raised: c("--color-surface-raised"),
          sunken: c("--color-surface-sunken"),
          muted: c("--color-surface-muted"),
        },
        fg: {
          DEFAULT: c("--color-fg"),
          secondary: c("--color-fg-secondary"),
          muted: c("--color-fg-muted"),
          subtle: c("--color-fg-subtle"),
        },
        border: {
          DEFAULT: c("--color-border"),
          strong: c("--color-border-strong"),
          input: c("--color-border-input"),
        },
        hover: {
          DEFAULT: c("--color-hover"),
          strong: c("--color-hover-strong"),
        },
        input: c("--color-input"),
        elevated: c("--color-elevated"),
        overlay: c("--color-overlay"),
        accent: {
          DEFAULT: c("--color-accent"),
          hover: c("--color-accent-hover"),
        },
        warning: c("--color-warning"),
        danger: c("--color-danger"),
        info: c("--color-info"),
        "file-image": c("--color-file-image"),
        "file-audio": c("--color-file-audio"),
        preview: c("--color-preview-bg"),
        video: c("--color-video-bg"),
      },
    },
  },
  plugins: [],
};
