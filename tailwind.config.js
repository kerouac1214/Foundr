/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./App.tsx",
        "./index.tsx",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                director: {
                    dark: '#0f1115',
                    panel: '#1a1d23',
                    accent: '#3b82f6',
                    text: '#e2e8f0',
                }
            }
        },
    },
    plugins: [],
}
