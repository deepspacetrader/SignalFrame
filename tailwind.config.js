/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'bg-darker': '#05070a',
                'bg-main': '#0a0c10',
                'bg-card': 'rgba(17, 20, 24, 0.8)',
                'accent-primary': '#3b82f6',
                'accent-secondary': '#10b981',
                'accent-alert': '#ef4444',
                'accent-warning': '#f59e0b',
                'text-primary': '#f8fafc',
                'text-secondary': '#94a3b8',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Outfit', 'sans-serif'],
            },
            backgroundImage: {
                'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
            },
        },
    },
    plugins: [],
}
