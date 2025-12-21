/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'premium-dark': {
                    900: '#0f172a', // Main background (Slate 900)
                    800: '#1e293b', // Panel background (Slate 800)
                    700: '#334155', // Border/Hover (Slate 700)
                    600: '#475569', // Muted text
                },
                'neon-blue': {
                    DEFAULT: '#3b82f6', // Blue 500
                    glow: '#60a5fa',    // Blue 400
                },
                'neon-purple': {
                    DEFAULT: '#a855f7', // Purple 500
                    glow: '#c084fc',    // Purple 400
                },
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'pulse-slow': 'pulse 3s infinite',
                'sweep': 'sweep 2.5s infinite ease-in-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                sweep: {
                    '0%': { transform: 'translateX(-100%)' },
                    '40%': { transform: 'translateX(100%)' },
                    '100%': { transform: 'translateX(100%)' },
                },
            },
        },
    },
    plugins: [],
}
