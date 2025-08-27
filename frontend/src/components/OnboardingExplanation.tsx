'use client'

interface OnboardingExplanationProps {
    title: string
    description: string
    onContinue: () => void
}

export default function OnboardingExplanation({ 
    title, 
    description, 
    onContinue 
}: OnboardingExplanationProps) {
    return (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md text-center mx-4 shadow-xl border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    {title}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6 text-left">
                    {description}
                </p>
                <button
                    onClick={onContinue}
                    className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                >
                    Continue
                </button>
            </div>
        </div>
    )
}
