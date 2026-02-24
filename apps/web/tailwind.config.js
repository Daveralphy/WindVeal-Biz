/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // VealBiz Dark Theme
        vb: {
          bg: '#0F0F0F',
          surface: '#161616',
          card: '#1A1A1A',
          border: '#2A2A2A',
          muted: '#3A3A3A',
          sidebar: '#111111',
          header: '#111111',
        },
        // Brand
        brand: {
          DEFAULT: '#10B981',
          light: '#34D399',
          dark: '#059669',
        },
        // Status colors  
        status: {
          active: '#22C55E',
          paused: '#F59E0B',
          closed: '#EF4444',
          draft: '#6B7280',
        },
        // Stage colors
        stage: {
          applied: '#6B7280',
          screening: '#3B82F6',
          phone: '#8B5CF6',
          interview: '#F59E0B',
          technical: '#EC4899',
          final: '#F97316',
          offer: '#10B981',
          hired: '#22C55E',
          rejected: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
