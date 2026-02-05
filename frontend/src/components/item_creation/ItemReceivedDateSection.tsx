'use client'

import DatePickerComponent from '@/components/item_creation/DatePickerComponent'
import { DatePickerState } from '@/utils/datePickerHelpers'

interface ItemReceivedDateSectionProps {
    // Tracking mode state
    trackingMode: 'today' | 'received'
    onTrackingModeChange: (mode: 'today' | 'received') => void

    // Date selection mode state (for received mode)
    dateSelectionMode: 'monthYear' | 'year' | 'yearRange'
    onDateSelectionModeChange: (mode: 'monthYear' | 'year' | 'yearRange') => void

    // Date picker state
    datePickerState?: DatePickerState
    onDatePickerStateChange?: (updates: Partial<DatePickerState>) => void
    isDatePickerOpen?: boolean
    onDatePickerOpenChange?: (open: boolean) => void

    // For quick add date selection states
    itemMonth?: string
    onItemMonthChange?: (month: string) => void
    itemYear?: string
    onItemYearChange?: (year: string) => void
    startYear?: string
    onStartYearChange?: (year: string) => void
    endYear?: string
    onEndYearChange?: (year: string) => void

    // Validation and display
    isDateValid?: () => boolean
    getDateString?: () => string

    // Received date for setting/getting
    receivedDate?: Date | undefined
    onReceivedDateChange?: (date: Date | undefined) => void

    // Styling variant
    variant?: 'manual' | 'quick' | 'edit'

    // Options for date selection
    months?: string[]
    years?: string[]
}

export default function ItemReceivedDateSection({
    trackingMode,
    onTrackingModeChange,
    dateSelectionMode,
    onDateSelectionModeChange,
    datePickerState,
    onDatePickerStateChange,
    isDatePickerOpen,
    onDatePickerOpenChange,
    itemMonth,
    onItemMonthChange,
    itemYear,
    onItemYearChange,
    startYear,
    onStartYearChange,
    endYear,
    onEndYearChange,
    isDateValid,
    getDateString,
    onReceivedDateChange,
    variant = 'manual',
    months = [],
    years = []
}: ItemReceivedDateSectionProps) {

    const buttonStyles = {
        manual: {
            active: 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300',
            inactive: 'bg-gray-100 dark:bg-gray-700'
        },
        quick: {
            active: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
            inactive: 'bg-gray-100 dark:bg-gray-700'
        },
        edit: {
            active: 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300',
            inactive: 'bg-gray-100 dark:bg-gray-700'
        }
    }

    const currentStyles = buttonStyles[variant]

    return (
        <div className="space-y-3 mb-4">
            {/* Date Selection Content */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Item Received Date
                    </span>
                </div>

                {/* Manual/Edit variant uses DatePickerComponent */}
                {(variant === 'manual' || variant === 'edit') && datePickerState && onDatePickerStateChange && onReceivedDateChange ? (
                    <>
                        <div className="flex flex-wrap gap-2 mb-3">
                            <button
                                type="button"
                                onClick={() => {
                                    // Set to today's date
                                    const today = new Date()
                                    onReceivedDateChange(today)
                                    onTrackingModeChange('today')
                                }}
                                className={`px-3 py-1 text-sm rounded-md ${trackingMode === 'today' ? currentStyles.active : currentStyles.inactive
                                    }`}
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => onTrackingModeChange('received')}
                                className={`px-3 py-1 text-sm rounded-md ${trackingMode === 'received' ? currentStyles.active : currentStyles.inactive
                                    }`}
                            >
                                Past Date
                            </button>
                        </div>
                        {trackingMode === 'received' && (
                            <DatePickerComponent
                                state={datePickerState}
                                onStateChange={onDatePickerStateChange}
                                onDateChange={onReceivedDateChange}
                                isPopoverOpen={isDatePickerOpen || false}
                                onPopoverOpenChange={onDatePickerOpenChange || (() => { })}
                                required={true}
                                buttonClassName={variant === 'edit' ? "w-[240px] justify-start text-left font-normal" : undefined}
                            />
                        )}
                    </>
                ) : null}

                {/* Quick variant uses Today/Past Date toggle */}
                {variant === 'quick' && (
                    <>
                        <div className="flex flex-wrap gap-2 mb-3">
                            <button
                                type="button"
                                onClick={() => {
                                    // Set to today's date
                                    const today = new Date()
                                    onReceivedDateChange?.(today)
                                    onTrackingModeChange('today')
                                }}
                                className={`px-3 py-1 text-sm rounded-md ${trackingMode === 'today' ? currentStyles.active : currentStyles.inactive
                                    }`}
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onTrackingModeChange('received')
                                    onDateSelectionModeChange('monthYear')
                                }}
                                className={`px-3 py-1 text-sm rounded-md ${trackingMode === 'received' ? currentStyles.active : currentStyles.inactive
                                    }`}
                            >
                                Past Date
                            </button>
                        </div>

                        {/* Quick add date selection - show month and year when Past Date is selected */}
                        {trackingMode === 'received' && (
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <select
                                        value={itemMonth || ''}
                                        onChange={e => onItemMonthChange?.(e.target.value)}
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        required
                                    >
                                        <option value="">Select month</option>
                                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <select
                                        value={itemYear || ''}
                                        onChange={e => onItemYearChange?.(e.target.value)}
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        required
                                    >
                                        <option value="">Select year</option>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
