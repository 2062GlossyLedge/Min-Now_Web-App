// Shared date picker utilities following DRY principle

export type DateSelectionMode = 'full' | 'monthYear' | 'year' | 'yearRange'

export interface DatePickerState {
    dateSelectionMode: DateSelectionMode
    receivedDate?: Date
    selectedMonth: string
    selectedYear: string
    startYear: string
    endYear: string
}

// Month and year options
export const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

export const years = Array.from({ length: 21 }, (_, i) => `${2024 - i}`)

// Helper function to calculate received date based on selection mode
export const calculateReceivedDate = (state: DatePickerState): Date | undefined => {
    const { dateSelectionMode, receivedDate, selectedMonth, selectedYear, startYear, endYear } = state

    switch (dateSelectionMode) {
        case 'full':
            return receivedDate
        case 'monthYear':
            if (selectedMonth && selectedYear) {
                const monthIndex = months.indexOf(selectedMonth)
                return new Date(parseInt(selectedYear), monthIndex, 1)
            }
            return undefined
        case 'year':
            if (selectedYear) {
                return new Date(parseInt(selectedYear), 0, 1) // January 1st of the selected year
            }
            return undefined
        case 'yearRange':
            if (startYear && endYear) {
                const start = parseInt(startYear)
                const end = parseInt(endYear)
                const middleYear = Math.floor((start + end) / 2)
                return new Date(middleYear, 5, 15) // June 15th of the middle year
            }
            return undefined
        default:
            return receivedDate
    }
}

// Helper function to check if date is valid based on selection mode
export const isDateValid = (state: DatePickerState): boolean => {
    const { dateSelectionMode, receivedDate, selectedMonth, selectedYear, startYear, endYear } = state

    switch (dateSelectionMode) {
        case 'full':
            return !!receivedDate
        case 'monthYear':
            return !!(selectedMonth && selectedYear)
        case 'year':
            return !!selectedYear
        case 'yearRange':
            return !!(startYear && endYear)
        default:
            return false
    }
}

// Helper function to initialize date picker state from existing date
export const initializeDatePickerState = (existingDate?: Date): Partial<DatePickerState> => {
    if (!existingDate) {
        return {
            dateSelectionMode: 'full',
            selectedMonth: '',
            selectedYear: '',
            startYear: '',
            endYear: ''
        }
    }

    const year = existingDate.getFullYear().toString()
    const month = months[existingDate.getMonth()]

    return {
        dateSelectionMode: 'full',
        receivedDate: existingDate,
        selectedMonth: month,
        selectedYear: year,
        startYear: year,
        endYear: year
    }
}
