'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDownIcon } from 'lucide-react'
import { DateSelectionMode, DatePickerState, months, years } from '@/utils/datePickerHelpers'

interface DatePickerComponentProps {
    state: DatePickerState
    onStateChange: (updates: Partial<DatePickerState>) => void
    onDateChange?: (date: Date | undefined) => void
    isPopoverOpen?: boolean
    onPopoverOpenChange?: (open: boolean) => void
    className?: string
    buttonClassName?: string
    required?: boolean
}

export default function DatePickerComponent({
    state,
    onStateChange,
    onDateChange,
    isPopoverOpen = false,
    onPopoverOpenChange,
    className = '',
    buttonClassName = '',
    required = false
}: DatePickerComponentProps) {
    const {
        dateSelectionMode,
        receivedDate,
        selectedMonth,
        selectedYear,
        startYear,
        endYear
    } = state

    // Handle mode selection
    const handleModeChange = (mode: DateSelectionMode) => {
        onStateChange({ dateSelectionMode: mode })
    }

    // Handle full date selection
    const handleFullDateSelect = (date: Date | undefined) => {
        onStateChange({ receivedDate: date })
        if (onDateChange) {
            onDateChange(date)
        }
        if (onPopoverOpenChange) {
            onPopoverOpenChange(false)
        }
    }

    // Handle month/year/range changes
    const handleFieldChange = (field: keyof DatePickerState, value: string) => {
        onStateChange({ [field]: value })
    }

    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            {/* Date Selection Mode Options */}
            <div className="flex flex-wrap gap-2 mb-3">
                <button
                    type="button"
                    onClick={() => handleModeChange('full')}
                    className={`px-3 py-1 text-sm rounded-md ${dateSelectionMode === 'full'
                            ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                >
                    Full Date
                </button>
                <button
                    type="button"
                    onClick={() => handleModeChange('monthYear')}
                    className={`px-3 py-1 text-sm rounded-md ${dateSelectionMode === 'monthYear'
                            ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                >
                    Month & Year
                </button>
                <button
                    type="button"
                    onClick={() => handleModeChange('year')}
                    className={`px-3 py-1 text-sm rounded-md ${dateSelectionMode === 'year'
                            ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                >
                    Year Only
                </button>
                <button
                    type="button"
                    onClick={() => handleModeChange('yearRange')}
                    className={`px-3 py-1 text-sm rounded-md ${dateSelectionMode === 'yearRange'
                            ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                >
                    Year Range
                </button>
            </div>

            {/* Full Date Picker */}
            {dateSelectionMode === 'full' && (
                <Popover open={isPopoverOpen} onOpenChange={onPopoverOpenChange}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className={`w-48 justify-between font-normal ${buttonClassName}`}
                        >
                            {receivedDate ? receivedDate.toLocaleDateString() : "Select date"}
                            <ChevronDownIcon className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={receivedDate}
                            captionLayout="dropdown"
                            onSelect={handleFullDateSelect}
                            showOutsideDays={true}
                            className="rounded-md border"
                        />
                    </PopoverContent>
                </Popover>
            )}

            {/* Month & Year Selection */}
            {dateSelectionMode === 'monthYear' && (
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Month</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => handleFieldChange('selectedMonth', e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                            required={required}
                        >
                            <option value="">Select month</option>
                            {months.map(month => (
                                <option key={month} value={month}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => handleFieldChange('selectedYear', e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                            required={required}
                        >
                            <option value="">Select year</option>
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Year Only Selection */}
            {dateSelectionMode === 'year' && (
                <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Year (defaults to January 1st)</label>
                    <select
                        value={selectedYear}
                        onChange={(e) => handleFieldChange('selectedYear', e.target.value)}
                        className="w-48 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                        required={required}
                    >
                        <option value="">Select year</option>
                        {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Year Range Selection */}
            {dateSelectionMode === 'yearRange' && (
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Year</label>
                        <select
                            value={startYear}
                            onChange={(e) => handleFieldChange('startYear', e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                            required={required}
                        >
                            <option value="">Start year</option>
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Year</label>
                        <select
                            value={endYear}
                            onChange={(e) => handleFieldChange('endYear', e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                            required={required}
                        >
                            <option value="">End year</option>
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
        </div>
    )
}
