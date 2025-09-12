'use client'

interface OwnershipDurationGoalSectionProps {
    // Ownership goal value and unit
    ownershipGoalValue: number
    onOwnershipGoalValueChange: (value: number) => void
    ownershipGoalUnit: 'months' | 'years'
    onOwnershipGoalUnitChange: (unit: 'months' | 'years') => void

    // For display in time range
    trackingMode?: 'today' | 'received'
    receivedDate?: Date | undefined
    dateString?: string // For quick add calculated date string

    // Styling variant
    variant?: 'manual' | 'quick' | 'edit'

    // Calculation helpers
    calculateOwnershipDurationMonths: () => number
}

export default function OwnershipDurationGoalSection({
    ownershipGoalValue,
    onOwnershipGoalValueChange,
    ownershipGoalUnit,
    onOwnershipGoalUnitChange,
    trackingMode = 'today',
    receivedDate,
    dateString,
    variant = 'manual',
    calculateOwnershipDurationMonths
}: OwnershipDurationGoalSectionProps) {

    const handleOwnershipGoalValueChange = (valueString: string) => {
        // Remove non-numeric characters and limit to 3 digits
        const numericValue = valueString.replace(/\D/g, '').slice(0, 3)
        // Allow empty input temporarily, but convert to number for parent component
        if (numericValue === '') {
            onOwnershipGoalValueChange(0) // Temporary empty state
        } else {
            const parsedValue = Math.max(1, parseInt(numericValue, 10))
            onOwnershipGoalValueChange(parsedValue)
        }
    }

    const handleOwnershipGoalValueBlur = () => {
        // Ensure minimum value of 1 when user finishes editing
        if (ownershipGoalValue === 0) {
            onOwnershipGoalValueChange(1)
        }
    }

    const handleUnitChange = (newUnit: 'months' | 'years') => {
        const oldUnit = ownershipGoalUnit
        onOwnershipGoalUnitChange(newUnit)

        // Convert current value to new unit with 3-digit limit
        const currentNumericValue = ownershipGoalValue
        if (newUnit === 'years' && oldUnit === 'months') {
            const convertedValue = Math.max(1, Math.round(currentNumericValue / 12))
            onOwnershipGoalValueChange(Math.min(999, convertedValue))
        } else if (newUnit === 'months' && oldUnit === 'years') {
            const convertedValue = currentNumericValue * 12
            onOwnershipGoalValueChange(Math.min(999, convertedValue))
        }
    }

    const inputStyles = {
        manual: 'focus:border-teal-500 focus:ring-teal-500',
        quick: 'focus:border-purple-500 focus:ring-purple-500',
        edit: 'focus:border-teal-500 focus:ring-teal-500'
    }

    return (
        <div className="space-y-3">
            {/* Time Range Display */}
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    {(() => {
                        let startDate: Date

                        if (variant === 'quick') {
                            // For quick add, always use today for now (could be enhanced to use calculated date)
                            startDate = new Date()
                        } else {
                            // For manual/edit, use received date or today based on tracking mode
                            startDate = (trackingMode === 'today') ? new Date() : (receivedDate || new Date())
                        }

                        const endDate = new Date(startDate)
                        endDate.setMonth(endDate.getMonth() + calculateOwnershipDurationMonths())

                        return (
                            <div className="space-y-1">
                                <div>
                                    <span className="font-medium">Start:</span> {startDate.toLocaleDateString()}
                                    <span className="text-xs ml-1">
                                        ({(trackingMode === 'today') ? 'tracking starts today' : 'item received date'})
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium">Goal End:</span> {endDate.toLocaleDateString()}
                                    <span className="text-xs ml-1">
                                        ({calculateOwnershipDurationMonths()} months from start)
                                    </span>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            </div>

            {/* Input Controls */}
            <div className="flex items-center space-x-3">
                <input
                    type="text"
                    value={ownershipGoalValue === 0 ? '' : ownershipGoalValue.toString()}
                    onChange={(e) => handleOwnershipGoalValueChange(e.target.value)}
                    onBlur={handleOwnershipGoalValueBlur}
                    placeholder="1"
                    maxLength={3}
                    className={`block w-24 rounded-md border-gray-300 dark:border-gray-600 shadow-sm ${inputStyles[variant]} bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3`}
                    {...(variant === 'edit' ? { onClick: (e: React.MouseEvent) => e.stopPropagation() } : {})}
                />
                <select
                    value={ownershipGoalUnit}
                    onChange={(e) => handleUnitChange(e.target.value as 'months' | 'years')}
                    className={`rounded-md border-gray-300 dark:border-gray-600 shadow-sm ${inputStyles[variant]} bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3`}
                    {...(variant === 'edit' ? { onClick: (e: React.MouseEvent) => e.stopPropagation() } : {})}
                >
                    <option value="months">{ownershipGoalValue === 1 ? 'month' : 'months'}</option>
                    <option value="years">{ownershipGoalValue === 1 ? 'year' : 'years'}</option>
                </select>
            </div>
        </div>
    )
}
