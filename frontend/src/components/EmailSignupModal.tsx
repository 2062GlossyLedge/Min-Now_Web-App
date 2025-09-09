'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { CheckCircle2, Mail, Calendar } from 'lucide-react'

interface EmailSignupModalProps {
    onComplete: () => void
    onSkip: () => void
}

export default function EmailSignupModal({ onComplete, onSkip }: EmailSignupModalProps) {
    const { user } = useUser()
    const [interval, setInterval] = useState(1) // Default to 1 month
    const [emailNotifications, setEmailNotifications] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!user) return

        setIsSubmitting(true)

        try {
            // Save preferences to Clerk unsafe metadata (client-side writable)
            await user.update({
                unsafeMetadata: {
                    ...user.unsafeMetadata,
                    emailNotifications,
                    checkupInterval: interval
                }
            })

            // Complete the onboarding process
            onComplete()
        } catch (error) {
            console.error('Error saving email preferences:', error)
            // Still complete onboarding even if there's an error
            onComplete()
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <div className="flex justify-center mb-4">
                    <div className="bg-teal-100 dark:bg-teal-900 rounded-full p-3">
                        <Mail className="w-8 h-8 text-teal-600 dark:text-teal-400" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-2">
                    Stay on Track!
                </h2>

                <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                    Get reminded when it's time for your next checkup so you can understand what items you use and don't use.
                </p>

                <div className="space-y-6">
                    {/* Checkup Interval Setting */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Default Checkup Interval
                        </label>
                        <div className="flex items-center justify-center space-x-4">
                            <button
                                type="button"
                                onClick={() => setInterval(Math.max(1, interval - 1))}
                                disabled={isSubmitting}
                                className={`px-3 py-2 border border-teal-300 dark:border-teal-600 rounded-md ${isSubmitting
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                    : 'hover:bg-teal-50 dark:hover:bg-teal-900 text-teal-700 dark:text-teal-300'
                                    }`}
                            >
                                -
                            </button>
                            <span className="text-lg font-medium text-gray-900 dark:text-gray-100 min-w-[80px] text-center">
                                {interval} month{interval !== 1 ? 's' : ''}
                            </span>
                            <button
                                type="button"
                                onClick={() => setInterval(Math.min(12, interval + 1))}
                                disabled={isSubmitting}
                                className={`px-3 py-2 border border-teal-300 dark:border-teal-600 rounded-md ${isSubmitting
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                    : 'hover:bg-teal-50 dark:hover:bg-teal-900 text-teal-700 dark:text-teal-300'
                                    }`}
                            >
                                +
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                            This will be your default interval for future checkups
                        </p>
                    </div>

                    {/* Email Notifications Checkbox */}
                    <div>
                        <div className="flex items-center cursor-pointer" onClick={() => setEmailNotifications(!emailNotifications)}>
                            <input
                                type="checkbox"
                                checked={emailNotifications}
                                onChange={(e) => setEmailNotifications(e.target.checked)}
                                disabled={isSubmitting}
                                className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 dark:border-gray-600 rounded transition-colors duration-200"
                            />
                            <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                Email me when checkups are due
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-7">
                            We'll send you a friendly reminder when it's time to review your items
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between space-x-3 pt-6">
                    <button
                        type="button"
                        onClick={onSkip}
                        disabled={isSubmitting}
                        className={`px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md ${isSubmitting
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                    >
                        Skip for now
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md hover:bg-teal-700 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Save Preferences
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
