'use client'

interface OnboardingExplanationProps {
    title: string
    description: string
    onContinue?: () => void // Make onContinue optional
    inline?: boolean // New prop to control whether it's inline or modal
}

export default function OnboardingExplanation({
    title,
    description,
    onContinue,
    inline = false
}: OnboardingExplanationProps) {
    if (inline) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-xl border border-gray-200 dark:border-gray-600">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {title}
                </h2>
                <p className="text-gray-700 dark:text-gray-200 mb-6 text-left">
                    {description}
                </p>
                {onContinue && (
                    <button
                        onClick={onContinue}
                        className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                    >
                        Continue
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md text-center mx-4 shadow-xl border border-gray-200 dark:border-gray-600">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {title}
                </h2>
                <p className="text-gray-700 dark:text-gray-200 mb-6 text-left">
                    {description}
                </p>
                {onContinue && (
                    <button
                        onClick={onContinue}
                        className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                    >
                        Continue
                    </button>
                )}
            </div>
        </div>
    )
}
