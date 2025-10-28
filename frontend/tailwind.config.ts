// tailwind.config.ts
import type { Config } from 'tailwindcss'

/**
 * Tailwind v4+ config (with Vite plugin).
 * - No "content" array needed when using @tailwindcss/vite — the plugin handles scanning.
 * - We will extend as our design system grows.
 */
export default {
  // Use 'class' so dark mode is opt-in via a .dark class on <html> or <body>
  darkMode: 'class',

  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '900px',    // lg breakpoint at 900px
      xl: '1024px',   // xl breakpoint at 1024px  
      '2xl': '1200px', // 2xl breakpoint at 1200px
    },
    extend: {
      // Example placeholders you can fill in later:
      // spacing: {},
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      // fontSize: {},
      // borderRadius: {},
      // boxShadow: {},
      // keyframes: {},
      // animation: {},
    },
  },

  // Register Tailwind plugins here when/if you add them
  plugins: [
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/typography'),
    // require('@tailwindcss/aspect-ratio'),
    // require('@tailwindcss/container-queries'),
  ],

  // If you ever need to guarantee certain classes are always included
  // (e.g., generated at runtime), add them to safelist:
  safelist: [
    // 'bg-red-500',
    // 'md:grid-cols-3',
  ],
} satisfies Config
