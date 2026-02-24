/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // VealBiz Theme — powered by CSS variables (set in index.css)
        vb: {
          bg: 'var(--vb-bg)',
          surface: 'var(--vb-surface)',
          card: 'var(--vb-card)',
          border: 'var(--vb-border)',
          muted: 'var(--vb-muted)',
          sidebar: 'var(--vb-sidebar)',
          header: 'var(--vb-header)',
          // Semantic text colors
          text: 'var(--vb-text)',
          'text-secondary': 'var(--vb-text-secondary)',
          'text-muted': 'var(--vb-text-muted)',
          'text-faint': 'var(--vb-text-faint)',
          'icon': 'var(--vb-icon)',
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
