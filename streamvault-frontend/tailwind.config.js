/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { 
    extend: {
      fontFamily: {
        'primary': ['Inter', 'system-ui', 'sans-serif'],
        'display': ['Poppins', 'system-ui', 'sans-serif'],
        'accent': ['Space Grotesk', 'monospace'],
      },
      colors: {
        'sv': {
          'black': '#000000',
          'dark': '#0a0a0a',
          'gray': {
            950: '#0f0f0f',
            900: '#1a1a1a',
            800: '#2a2a2a',
            700: '#3a3a3a',
            600: '#4a4a4a',
            400: '#737373',
            300: '#b3b3b3',
          },
          'red': {
            'primary': '#e50914',
            'hover': '#f40612',
          },
          'white': '#ffffff',
        }
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      backdropBlur: {
        'xs': '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'neon': '0 0 20px rgba(229, 9, 20, 0.5)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(15,15,15,0.6) 50%, rgba(0,0,0,0.9) 100%)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      }
    } 
  },
  plugins: [],
}