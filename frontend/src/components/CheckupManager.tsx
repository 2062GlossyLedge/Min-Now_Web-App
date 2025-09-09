'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Item } from '@/types/item'
import { toast } from 'sonner'
// CSRF-based API imports (commented out - using JWT approach)
// import { updateItem, fetchCheckup, createCheckup, completeCheckup } from '@/utils/api'
// import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'

// JWT-based API imports (new approach)
import { updateItemJWT, fetchCheckupJWT, completeCheckupJWT, testClerkJWT, fetchItemsByStatusJWT } from '@/utils/api'
import { useItemUpdate } from '@/contexts/ItemUpdateContext'
import { useOnboarding } from '@/contexts/OnboardingContext'
import { useUser, useAuth } from '@clerk/nextjs'
import OnboardingExplanation from './OnboardingExplanation'
import EmailSignupModal from './EmailSignupModal'
import { HelpCircle, Settings } from 'lucide-react'

// Map database values to display names
const itemTypeDisplayNames: Record<string, string> = {
    'Clothing_Accessories': 'Clothing & Accessories',
    'Technology': 'Technology',
    'Furniture_Appliances': 'Furniture & Appliances',
    'Kitchenware': 'Kitchenware',
    'Books_Media': 'Books & Media',
    'Vehicles': 'Vehicles',
    'Personal_Care_Items': 'Personal Care Items',
    'Decor_Art': 'Decor & Art',
    'Tools_Equipment': 'Tools & Equipment',
    'Toys_Games': 'Toys & Games',
    'Outdoor_Gear': 'Outdoor Gear',
    'Fitness_Equipment': 'Fitness Equipment',
    'Pet_Supplies': 'Pet Supplies',
    'Subscriptions_Licenses': 'Subscriptions & Licenses',
    'Miscellaneous': 'Miscellaneous',
    'Other': 'Other'
}

interface CheckupManagerProps {
    checkupType: 'Keep' | 'Give'
    onClose: () => void
}

export default function CheckupManager({ checkupType, onClose }: CheckupManagerProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [changedItems, setChangedItems] = useState<Set<string>>(new Set())
    const [itemStatusChanges, setItemStatusChanges] = useState<Map<string, 'used' | 'not_used' | 'donate'>>(new Map()) // Track pending status changes
    const [showTooltip, setShowTooltip] = useState(false)
    const [showEmailSignupModal, setShowEmailSignupModal] = useState(false)
    // const { authenticatedFetch } = useAuthenticatedFetch() // CSRF approach - commented out
    const { getToken } = useAuth() // JWT approach - get token from Clerk
    const { addUpdatedItem, triggerRefresh } = useItemUpdate()
    const { isSignedIn, isLoaded } = useUser() // Get user authentication status
    const { onboardingStep, nextStep } = useOnboarding()

    // Disable body scroll when modal is open
    useEffect(() => {
        // Add overflow hidden to body when component mounts
        document.body.style.overflow = 'hidden'

        // Trigger onboarding for checkup review if in checkup step
        if (onboardingStep === 'checkup') {
            setTimeout(() => {
                nextStep() // Move to checkup-review step
            }, 1000) // Small delay to let the checkup modal open
        }

        // Cleanup function to restore scroll when component unmounts
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [onboardingStep, nextStep])

    // Separate effect to handle authentication state changes
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            setLoading(false)
            setItems([])
        }
    }, [isLoaded, isSignedIn])



    useEffect(() => {
        const fetchCheckupInfo = async () => {
            // Only fetch checkup info if user is signed in and Clerk has loaded
            if (!isLoaded || !isSignedIn) {
                return
            }

            try {
                // Test JWT authentication first
                const jwtTest = await testClerkJWT(getToken)
                console.log('CheckupManager JWT Test Result:', jwtTest)

                // JWT approach - using fetchCheckupJWT
                const { error } = await fetchCheckupJWT(checkupType.toLowerCase(), getToken)

                // CSRF approach (commented out)
                // const { error } = await fetchCheckup(checkupType.toLowerCase(), authenticatedFetch)

                if (error) {
                    console.error('Error fetching checkup info:', error)
                    return
                }
                // Checkup info fetched successfully
            } catch (error) {
                console.error('Error fetching checkup info:', error)
            }
        }
        fetchCheckupInfo()
    }, [checkupType, getToken, isLoaded, isSignedIn]) // Updated dependencies for JWT approach

    useEffect(() => {
        const fetchItems = async () => {
            // Only fetch items if user is signed in and Clerk has loaded
            if (!isLoaded || !isSignedIn) {
                setLoading(false)
                return
            }

            try {
                // JWT approach - using fetchItemsByStatusJWT
                const { data, error } = await fetchItemsByStatusJWT(checkupType, getToken)

                // CSRF approach (commented out)
                // const response = await authenticatedFetch(`/api/items?status=${checkupType}`)
                // const data = await response.json()

                if (error) {
                    console.error('Error fetching items:', error)
                    setItems([])
                } else {
                    setItems(data || [])
                }
            } catch (error) {
                console.error('Error fetching items:', error)
                setItems([])
            } finally {
                setLoading(false)
            }
        }
        fetchItems()
    }, [checkupType, getToken, isLoaded, isSignedIn]) // Updated dependencies for JWT approach

    const handleStatusChange = async (itemId: string, newStatus: 'used' | 'not_used' | 'donate') => {
        // Only update local UI state, don't make backend calls yet
        if (checkupType === 'Keep' && newStatus === 'donate') {
            return; // Keep items can't be marked as gave/donate
        }

        // Store the status change for later processing
        setItemStatusChanges(prev => {
            const newMap = new Map(prev)
            newMap.set(itemId, newStatus)
            return newMap
        })

        // Add to changed items set for UI feedback
        setChangedItems(prev => new Set([...prev, itemId]))
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            // Process all pending item status changes first
            const statusMap = {
                'Keep': {
                    'used': 'Keep',
                    'not_used': 'Give'
                } as const,
                'Give': {
                    'used': 'Keep',
                    'not_used': 'Give',
                    'donate': 'Donate'
                } as const
            } as const

            // Update all items with changed status
            for (const [itemId, newStatus] of itemStatusChanges.entries()) {
                try {
                    const targetStatus = (statusMap[checkupType] as Record<typeof newStatus, string>)[newStatus]

                    // If marking as used, set last_used to now
                    const updatePayload: { status: string; lastUsedDate?: Date } = { status: targetStatus };
                    if (newStatus === 'used') {
                        updatePayload.lastUsedDate = new Date();
                    }

                    // JWT approach - using updateItemJWT
                    const { data: updatedItem, error } = await updateItemJWT(itemId, updatePayload, getToken)

                    // CSRF approach (commented out)
                    // const { data: updatedItem, error } = await updateItem(itemId, updatePayload, authenticatedFetch)

                    if (error) {
                        console.error(`Error updating item ${itemId}:`, error)
                        continue // Continue with other items even if one fails
                    }

                    if (updatedItem) {
                        // Remove the item from the local list since it's been processed
                        setItems(prevItems => prevItems.filter(item => item.id !== itemId))

                        // Notify parent components about the update
                        addUpdatedItem(itemId)
                    }
                } catch (error) {
                    console.error(`Error updating item ${itemId}:`, error)
                }
            }

            // First, try to get existing checkup
            // JWT approach - using fetchCheckupJWT
            const { data: existingCheckup } = await fetchCheckupJWT(checkupType.toLowerCase(), getToken)

            // CSRF approach (commented out)
            // const { data: existingCheckup } = await fetchCheckup(checkupType.toLowerCase(), authenticatedFetch)

            if (existingCheckup && Array.isArray(existingCheckup) && existingCheckup.length > 0) {
                // If checkup exists, complete it
                // JWT approach - using completeCheckupJWT
                await completeCheckupJWT(existingCheckup[0].id, getToken)

                // CSRF approach (commented out)
                // await completeCheckup(existingCheckup[0].id, authenticatedFetch)
                // A user will always have a checkup, so we don't need to create a new one
                // } else {
                //     // If no checkup exists, create and complete a new one
                //     // JWT approach - using createCheckupJWT
                //     const { data: newCheckup, error } = await createCheckupJWT({
                //         checkup_type: checkupType.toLowerCase(),
                //         interval_months: interval
                //     }, getToken)

                // CSRF approach (commented out)
                // const { data: newCheckup, error } = await createCheckup({
                //     checkup_type: checkupType.toLowerCase(),
                //     interval_months: interval
                // }, authenticatedFetch)

                // if (error) {
                //     throw new Error(error)
                // }

                // if (newCheckup) {
                //     // JWT approach - using completeCheckupJWT
                //     await completeCheckupJWT(newCheckup.id, getToken)

                //     // CSRF approach (commented out)
                //     // await completeCheckup(newCheckup.id, authenticatedFetch)
                // }
            }

            // Show success toast
            toast.success('Checkup Complete!', {
                description: `Your ${checkupType.toLowerCase()} items have been reviewed.`,
                duration: 3000,
            })

            // Move to email signup step if this is the checkup-submit step
            if (onboardingStep === 'checkup-submit') {
                // Don't complete onboarding yet, move to email signup
                nextStep()
            }

            // Trigger refresh immediately since no animation
            triggerRefresh()
            router.refresh()
            onClose()
        } catch (error) {
            console.error('Error setting checkup:', error)
            setIsSubmitting(false)
        }
    }

    // Helper to format last used date
    // Helper to format last used date as MM YY
    // Helper to show how long since last used, e.g. '4y 2m'
    const formatLastUsedDuration = (dateString: string) => {
        if (!dateString) return '';
        const lastUsed = new Date(dateString);
        const now = new Date();
        let years = now.getFullYear() - lastUsed.getFullYear();
        let months = now.getMonth() - lastUsed.getMonth();
        if (months < 0) {
            years--;
            months += 12;
        }
        // Only show if at least 0 months
        const yearText = years > 0 ? `${years}y` : '';
        const monthText = months > 0 ? `${months}m` : (years === 0 ? `${months}m` : '');
        return `${yearText}${yearText && monthText ? ' ' : ''}${monthText}`.trim();
    };

    // Helper to get the pending status change text for display
    const getPendingStatusText = (itemId: string) => {
        const pendingStatus = itemStatusChanges.get(itemId);
        if (!pendingStatus) return '';

        const statusMap = {
            'Keep': {
                'used': 'Will stay in Keep',
                'not_used': 'Will move to Give'
            },
            'Give': {
                'used': 'Will move to Keep',
                'not_used': 'Will stay in Give',
                'donate': 'Will move to Gave'
            }
        } as const;

        const typeMap = statusMap[checkupType] as Record<string, string>;
        return typeMap[pendingStatus] || '';
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {checkupType} Items Checkup
                    </h2>
                    <div className="flex items-center space-x-3">
                        {/* Tooltip Icon */}
                        <div className="relative">
                            <button
                                onClick={() => setShowTooltip(!showTooltip)}
                                onMouseEnter={() => setShowTooltip(true)}
                                onMouseLeave={() => setShowTooltip(false)}
                                className="p-2 bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-400 text-white rounded-full transition-colors shadow-sm"
                            >
                                <HelpCircle className="h-4 w-4" />
                            </button>

                            {/* Tooltip Content */}
                            {showTooltip && (
                                <div className="absolute top-full right-0 mt-1 w-48 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg z-50">
                                    <div className="space-y-1">
                                        <p className="font-semibold text-xs">Button Guide:</p>
                                        {checkupType === 'Keep' ? (
                                            <>
                                                <p><span className="font-medium text-teal-300">Used:</span> Stay in Keep Section</p>
                                                <p><span className="font-medium text-teal-300">Not Used:</span> Move to Give Section</p>
                                            </>
                                        ) : (
                                            <>
                                                <p><span className="font-medium text-teal-300">Used:</span> Move to Keep Section</p>
                                                <p><span className="font-medium text-teal-300">Not Used:</span> Stay in Give Section</p>
                                                <p><span className="font-medium text-teal-300">Gave:</span> Move to Gave Section</p>
                                            </>
                                        )}
                                    </div>
                                    {/* Tooltip Arrow */}
                                    <div className="absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900 dark:border-b-gray-700"></div>
                                </div>
                            )}
                        </div>

                        {/* Options Icon */}
                        <button
                            onClick={() => setShowEmailSignupModal(true)}
                            className="p-2 bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-400 text-white rounded-full transition-colors shadow-sm"
                        >
                            <Settings className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Mark items based on their usage since the last checkup. Items marked as <b>Used</b> will be moved to the Keep section. Items marked as <b>Not Used</b> will be stay in the Give section. Items marked as <b>Gave</b> will be moved to the Gave section.
                </p> */}

                <div className="space-y-6">
                    <div>
                        {/* Onboarding Explanation for Checkup - positioned before review items */}
                        {onboardingStep === 'checkup-review' && (
                            <div className="mb-4">
                                <OnboardingExplanation
                                    title="Review Your Item"
                                    description="This is your item to review. Choose 'Used' if you've used it in the past month or 'Not Used' if you haven't. "
                                    inline={true}
                                />
                            </div>
                        )}

                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
                            Review Items
                        </h3>

                        {loading ? (
                            <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                            </div>
                        ) : items.length === 0 ? (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                                No items to review
                            </p>
                        ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                {items.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                                        {...(index === 0 && onboardingStep === 'checkup-review' ? { 'data-onboarding': 'first-checkup-item' } : {})}
                                    >
                                        <div className="flex items-center space-x-3">

                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{itemTypeDisplayNames[item.itemType] || item.itemType}</p>
                                                {/* Show how long since last used for each item */}
                                                <p
                                                    className="text-xs text-gray-400 dark:text-gray-500 mt-1"
                                                    {...(index === 0 && onboardingStep === 'checkup-review' ? { 'data-onboarding': 'last-used-info' } : {})}
                                                >
                                                    Last used: {formatLastUsedDuration(item.last_used ?? '')}
                                                </p>
                                                {/* Show pending status change if any */}
                                                {getPendingStatusText(item.id) && (
                                                    <p className="text-xs text-teal-600 dark:text-teal-400 mt-1 font-medium">
                                                        {getPendingStatusText(item.id)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            {checkupType === 'Keep' ? (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            handleStatusChange(item.id, 'used')
                                                            // Handle onboarding progression
                                                            if (index === 0 && onboardingStep === 'checkup-review') {
                                                                setTimeout(() => {
                                                                    nextStep() // Move to checkup-submit step
                                                                }, 500)
                                                            }
                                                        }}
                                                        disabled={isSubmitting}
                                                        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${isSubmitting
                                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                            : changedItems.has(item.id)
                                                                ? 'bg-teal-50 dark:bg-teal-800 text-teal-600 dark:text-teal-300'
                                                                : 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800'
                                                            }`}
                                                        title={isSubmitting ? 'Please wait...' : 'Mark as used'}
                                                        {...(index === 0 && onboardingStep === 'checkup-review' ? { 'data-onboarding': 'used-button' } : {})}
                                                    >
                                                        Used
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleStatusChange(item.id, 'not_used')
                                                            // Handle onboarding progression
                                                            if (index === 0 && onboardingStep === 'checkup-review') {
                                                                setTimeout(() => {
                                                                    nextStep() // Move to checkup-submit step
                                                                }, 500)
                                                            }
                                                        }}
                                                        disabled={isSubmitting}
                                                        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${isSubmitting
                                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                            : changedItems.has(item.id)
                                                                ? 'bg-teal-50 dark:bg-teal-800 text-teal-600 dark:text-teal-300'
                                                                : 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800'
                                                            }`}
                                                        title={isSubmitting ? 'Please wait...' : 'Mark as not used'}
                                                        {...(index === 0 && onboardingStep === 'checkup-review' ? { 'data-onboarding': 'not-used-button' } : {})}
                                                    >
                                                        Not Used
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'used')}
                                                        disabled={isSubmitting}
                                                        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${isSubmitting
                                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                            : changedItems.has(item.id)
                                                                ? 'bg-teal-50 dark:bg-teal-800 text-teal-600 dark:text-teal-300'
                                                                : 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800'
                                                            }`}
                                                        title={isSubmitting ? 'Please wait...' : 'Mark as used'}
                                                    >
                                                        Used
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'not_used')}
                                                        disabled={isSubmitting}
                                                        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${isSubmitting
                                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                            : changedItems.has(item.id)
                                                                ? 'bg-teal-50 dark:bg-teal-800 text-teal-600 dark:text-teal-300'
                                                                : 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800'
                                                            }`}
                                                        title={isSubmitting ? 'Please wait...' : 'Mark as not used'}
                                                    >
                                                        Not Used
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'donate')}
                                                        disabled={isSubmitting}
                                                        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${isSubmitting
                                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                            : changedItems.has(item.id)
                                                                ? 'bg-teal-50 dark:bg-teal-800 text-teal-600 dark:text-teal-300'
                                                                : 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800'
                                                            }`}
                                                        title={isSubmitting ? 'Please wait...' : 'Mark as gave'}
                                                    >
                                                        Gave
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className={`px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md ${isSubmitting
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                                }`}
                            title={isSubmitting ? 'Please wait for checkup to complete...' : ''}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md hover:bg-teal-700 disabled:opacity-50"
                            {...(onboardingStep === 'checkup-submit' ? { 'data-onboarding': 'submit-checkup-button' } : {})}
                        >
                            {isSubmitting ? 'Processing Changes...' : `Complete Checkup${itemStatusChanges.size > 0 ? ` (${itemStatusChanges.size} changes)` : ''}`}
                        </button>
                    </div>
                </div>
            </div>

            {/* Email Signup Modal */}
            {showEmailSignupModal && (
                <EmailSignupModal
                    onComplete={() => setShowEmailSignupModal(false)}
                    onSkip={() => setShowEmailSignupModal(false)}
                />
            )}
        </div>
    )
} 