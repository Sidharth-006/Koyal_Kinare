import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#F7F5F0',
        surface: '#FFFFFF',
        'surface-hover': '#FAF8F4',
        border: '#E5E0D8',
        'border-subtle': '#EFECE6',
        primary: {
          DEFAULT: '#163327',
          hover: '#0E241B',
          light: '#EAF1ED',
          border: '#C5D8CC',
        },
        forest: {
          900: '#0D1F17',
          800: '#163327',
          700: '#1E4032',
          600: '#2A5241',
          100: '#EAF1ED',
        },
        cream: {
          50: '#FAF8F5',
          100: '#F7F5F0',
          200: '#EFECE5',
          300: '#E3DFD5',
        },
        gold: {
          500: '#D97706',
          400: '#F59E0B',
          100: '#FEF3C7',
        },
        accent: '#059669',
        danger: '#DC2626',
        warning: '#D97706',
        muted: '#6B7280',
        card: '#FFFFFF',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        'card': '0 2px 8px -2px rgba(22, 51, 39, 0.05), 0 1px 4px -1px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 12px 24px -6px rgba(22, 51, 39, 0.08), 0 4px 8px -2px rgba(0, 0, 0, 0.04)',
        'elevated': '0 20px 40px -15px rgba(22, 51, 39, 0.12)',
        'soft-glow': '0 0 20px rgba(22, 51, 39, 0.15)',
      },
      minHeight: {
        touch: '44px'
      },
      minWidth: {
        touch: '44px'
      }
    },
  },
  plugins: [],
};

export default config;
