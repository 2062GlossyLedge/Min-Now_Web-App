import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './global.css'
import { ThemeProvider } from '../components/ThemeProvider'
import Navigation from '../components/Navigation'
import { ClerkProvider } from '@clerk/nextjs'
import { ItemUpdateProvider } from '../contexts/ItemUpdateContext'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Min-Now',
    description: 'A minimalist approach to managing your belongings',
    icons: {
        icon: '/Min-NowDarkLogoCropped.ico',
    },
}

// Inline script to set the correct theme class on <html> before hydration
const setInitialTheme = `
(function() {
  try {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ClerkProvider>
            <html lang="en" suppressHydrationWarning>
                <head>
                    {/* Inline script to set theme before hydration using Tailwind darkmode clas */}
                    <script dangerouslySetInnerHTML={{ __html: setInitialTheme }} />
                </head>
                <body className={inter.className}>
                    <ItemUpdateProvider>
                        <ThemeProvider>
                            <Navigation />
                            <main className="min-h-screen">
                                {children}
                            </main>
                            {/* Sonner Toaster for notifications */}
                            <Toaster />
                        </ThemeProvider>
                    </ItemUpdateProvider>
                </body>
            </html>
        </ClerkProvider>
    )
}