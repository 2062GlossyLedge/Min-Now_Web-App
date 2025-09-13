'use client'

import { useState, useEffect } from 'react'
import { useUser, useAuth } from '@clerk/nextjs'
import { CheckCircle2, Mail, Calendar } from 'lucide-react'
import { syncUserPreferences } from '@/utils/api'
import { usePostHog } from 'posthog-js/react'

interface EmailSignupModalProps {
    onComplete: () => void
    onSkip: () => void
}

export default function EmailSignupModal({ onComplete, onSkip }: EmailSignupModalProps) {
    const { user } = useUser()
    const { getToken } = useAuth()
    const [interval, setInterval] = useState(1) // Default to 1 month
    const [emailNotifications, setEmailNotifications] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const posthog = usePostHog()

    // Load existing preferences from Clerk metadata when component mounts
    useEffect(() => {
        if (user?.unsafeMetadata) {
            const existingEmailNotifications = user.unsafeMetadata.emailNotifications
            const existingInterval = user.unsafeMetadata.checkupInterval

            if (typeof existingEmailNotifications === 'boolean') {
                setEmailNotifications(existingEmailNotifications)
            }

            if (typeof existingInterval === 'number' && existingInterval >= 1 && existingInterval <= 12) {
                setInterval(existingInterval)
            }
        }
    }, [user?.unsafeMetadata])

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

            if (emailNotifications && posthog) {
                posthog.capture('enabled_email_notifications', { checkupInterval: interval })
            }

            // Sync preferences with Django backend to update checkup intervals
            const syncResult = await syncUserPreferences(
                {
                    checkupInterval: interval,
                    emailNotifications
                },
                getToken
            )

            if (syncResult.error) {
                console.error('Failed to sync preferences with backend:', syncResult.error)
                // Still complete onboarding even if backend sync fails
            } else {
                console.log('Preferences synced successfully:', syncResult.data)
            }

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
                    Get reminded on the 1st of each month when it's time for your checkup so you can understand what items you use and don't use.
                </p>

                <div className="space-y-6">
                    {/* Checkup Interval Setting */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Checkup Interval (Months)
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
                            Checkups happen on the 1st of each month. This sets how often you'll be reminded.
                        </p>
                        {/* Show next checkup date */}
                        <div className="text-center mt-3 p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
                            <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
                                Next checkup: {(() => {
                                    const today = new Date()
                                    // Calculate the next 1st day of the month based on interval
                                    const currentMonth = today.getMonth()
                                    const currentYear = today.getFullYear()

                                    // If today is before or on the 1st, next checkup is this month's 1st + interval
                                    // If today is after the 1st, next checkup is next month's 1st + interval
                                    let nextCheckupMonth = currentMonth + interval
                                    let nextCheckupYear = currentYear

                                    // Handle year overflow
                                    while (nextCheckupMonth > 11) {
                                        nextCheckupMonth -= 12
                                        nextCheckupYear += 1
                                    }

                                    const nextCheckup = new Date(nextCheckupYear, nextCheckupMonth, 1)
                                    return nextCheckup.toLocaleDateString('en-US', {
                                        month: 'long',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })
                                })()}
                            </p>
                        </div>
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
                            We'll send you a reminder on the 1st of the month when your checkup is due
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
