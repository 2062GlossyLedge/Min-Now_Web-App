'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Item } from '@/types/item'
import { CheckCircle2 } from 'lucide-react'
import { updateItem, fetchCheckup, createCheckup, completeCheckup } from '@/utils/api'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'

interface CheckupManagerProps {
    checkupType: 'Keep' | 'Give'
    onClose: () => void
}

export default function CheckupManager({ checkupType, onClose }: CheckupManagerProps) {
    const router = useRouter()
    const [interval, setInterval] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [showConfirmation, setShowConfirmation] = useState(false)
    const [changedItems, setChangedItems] = useState<Set<string>>(new Set())
    const [lastCheckupDate, setLastCheckupDate] = useState<Date | null>(null)
    const { authenticatedFetch } = useAuthenticatedFetch()

    useEffect(() => {
        const fetchCheckupInfo = async () => {
            try {
                const { data, error } = await fetchCheckup(checkupType.toLowerCase(), authenticatedFetch)
                if (data) {
                    setLastCheckupDate(new Date(data.last_checkup_date))
                }
            } catch (error) {
                console.error('Error fetching checkup info:', error)
            }
        }
        fetchCheckupInfo()
    }, [checkupType, authenticatedFetch])

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const response = await authenticatedFetch(`/api/items?status=${checkupType}`)
                const data = await response.json()
                setItems(data)
            } catch (error) {
                console.error('Error fetching items:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchItems()
    }, [checkupType, authenticatedFetch])

    const handleStatusChange = async (itemId: string, newStatus: 'used' | 'not_used' | 'donate') => {
        try {
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

            if (checkupType === 'Keep' && newStatus === 'donate') {
                return;
            }

            const targetStatus = (statusMap[checkupType] as Record<typeof newStatus, string>)[newStatus]
            const { data: updatedItem, error } = await updateItem(itemId, { status: targetStatus }, authenticatedFetch)

            if (error) {
                console.error('Error updating item status:', error)
                return
            }

            if (updatedItem) {
                setItems(items.filter(item => item.id !== itemId))
                setChangedItems(prev => new Set([...prev, itemId]))
            }
        } catch (error) {
            console.error('Error updating item status:', error)
        }
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            // First, try to get existing checkup
            const { data: existingCheckup } = await fetchCheckup(checkupType.toLowerCase(), authenticatedFetch)

            if (existingCheckup && Array.isArray(existingCheckup) && existingCheckup.length > 0) {
                // If checkup exists, complete it
                await completeCheckup(existingCheckup[0].id, authenticatedFetch)
            } else {
                // If no checkup exists, create and complete a new one
                const { data: newCheckup, error } = await createCheckup({
                    checkup_type: checkupType.toLowerCase(),
                    interval_months: interval
                }, authenticatedFetch)

                if (error) {
                    throw new Error(error)
                }

                if (newCheckup) {
                    await completeCheckup(newCheckup.id, authenticatedFetch)
                }
            }

            setLastCheckupDate(new Date())
            setShowConfirmation(true)
            setTimeout(() => {
                router.refresh()
                onClose()
            }, 1500)
        } catch (error) {
            console.error('Error setting checkup:', error)
            setIsSubmitting(false)
        }
    }

    if (showConfirmation) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md text-center">
                    <div className="flex justify-center mb-4">
                        <CheckCircle2 className="w-16 h-16 text-teal-500 animate-bounce" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        Checkup Complete!
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        Your {checkupType.toLowerCase()} items have been reviewed.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {checkupType} Items Checkup
                    </h2>
                    <div className="relative">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 text-gray-600 dark:text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                    </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Mark items as used or not used since the last checkup. Items marked as not used will be moved to the Give section. In the Give section, you can also mark items for donation.
                </p>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Checkup Interval (months)
                        </label>
                        <div className="flex items-center space-x-4">
                            <button
                                type="button"
                                onClick={() => setInterval(Math.max(1, interval - 1))}
                                className="px-3 py-1 border border-teal-300 dark:border-teal-600 rounded-md hover:bg-teal-50 dark:hover:bg-teal-900 text-teal-700 dark:text-teal-300"
                            >
                                -
                            </button>
                            <span className="text-lg font-medium text-gray-900 dark:text-gray-100">{interval}</span>
                            <button
                                type="button"
                                onClick={() => setInterval(Math.min(12, interval + 1))}
                                className="px-3 py-1 border border-teal-300 dark:border-teal-600 rounded-md hover:bg-teal-50 dark:hover:bg-teal-900 text-teal-700 dark:text-teal-300"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    <div>
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
                                {items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                            {item.pictureUrl && (
                                                <img
                                                    src={item.pictureUrl}
                                                    alt={item.name}
                                                    className="w-12 h-12 object-cover rounded"
                                                />
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{item.itemType}</p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            {checkupType === 'Keep' ? (
                                                <>
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'used')}
                                                        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${changedItems.has(item.id)
                                                            ? 'bg-teal-50 dark:bg-teal-800 text-teal-600 dark:text-teal-300'
                                                            : 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800'
                                                            }`}
                                                    >
                                                        Used
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'not_used')}
                                                        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${changedItems.has(item.id)
                                                            ? 'bg-teal-50 dark:bg-teal-800 text-teal-600 dark:text-teal-300'
                                                            : 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800'
                                                            }`}
                                                    >
                                                        Not Used
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'used')}
                                                        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${changedItems.has(item.id)
                                                            ? 'bg-teal-50 dark:bg-teal-800 text-teal-600 dark:text-teal-300'
                                                            : 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800'
                                                            }`}
                                                    >
                                                        Used
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'not_used')}
                                                        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${changedItems.has(item.id)
                                                            ? 'bg-teal-50 dark:bg-teal-800 text-teal-600 dark:text-teal-300'
                                                            : 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800'
                                                            }`}
                                                    >
                                                        Not Used
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'donate')}
                                                        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${changedItems.has(item.id)
                                                            ? 'bg-teal-50 dark:bg-teal-800 text-teal-600 dark:text-teal-300'
                                                            : 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800'
                                                            }`}
                                                    >
                                                        Donate
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
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md hover:bg-teal-700 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : 'Complete Checkup'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
} 