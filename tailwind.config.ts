import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          950: 'rgb(var(--color-gray-950) / <alpha-value>)',
          900: 'rgb(var(--color-gray-900) / <alpha-value>)',
          800: 'rgb(var(--color-gray-800) / <alpha-value>)',
          700: 'rgb(var(--color-gray-700) / <alpha-value>)',
          600: 'rgb(var(--color-gray-600) / <alpha-value>)',
          500: 'rgb(var(--color-gray-500) / <alpha-value>)',
          400: 'rgb(var(--color-gray-400) / <alpha-value>)',
          300: 'rgb(var(--color-gray-300) / <alpha-value>)',
          200: 'rgb(var(--color-gray-200) / <alpha-value>)',
          100: 'rgb(var(--color-gray-100) / <alpha-value>)',
        },
        slate: {
          950: 'rgb(var(--color-slate-950) / <alpha-value>)',
          900: 'rgb(var(--color-slate-900) / <alpha-value>)',
          800: 'rgb(var(--color-slate-800) / <alpha-value>)',
          700: 'rgb(var(--color-slate-700) / <alpha-value>)',
          600: 'rgb(var(--color-slate-600) / <alpha-value>)',
          500: 'rgb(var(--color-slate-500) / <alpha-value>)',
          400: 'rgb(var(--color-slate-400) / <alpha-value>)',
          300: 'rgb(var(--color-slate-300) / <alpha-value>)',
          200: 'rgb(var(--color-slate-200) / <alpha-value>)',
          100: 'rgb(var(--color-slate-100) / <alpha-value>)',
        },
        zinc: {
          950: 'rgb(var(--color-zinc-950) / <alpha-value>)',
        }
      }
    },
  },
  plugins: [],
}

export default config
