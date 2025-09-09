'use client'

import { useTheme } from '../../components/ThemeProvider'
import { useOnboarding } from '@/contexts/OnboardingContext'

export default function SettingsPage() {
    const { theme, toggleTheme } = useTheme()
    const { startOnboarding, tutorialCompletionCount } = useOnboarding()

    const handleStartTutorial = () => {
        startOnboarding()
        // Don't auto-navigate, let the navigation-overview step handle it
    }

    return (
        <div className="min-h-screen p-6 bg-white dark:bg-black">
            <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Settings</h1>

            <div className="space-y-6">
                {/* Dark Mode Setting */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Dark Mode</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Toggle between light and dark theme</p>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${theme === 'dark' ? 'bg-teal-400' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 rounded-full bg-white transition-all duration-200 ease-in-out transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Tutorial Setting */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Tutorial</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Restart the onboarding tutorial {tutorialCompletionCount > 0 && `(completed ${tutorialCompletionCount} time${tutorialCompletionCount > 1 ? 's' : ''})`}
                            </p>
                        </div>
                        <button
                            onClick={handleStartTutorial}
                            className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
                        >
                            Start Tutorial
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
} 