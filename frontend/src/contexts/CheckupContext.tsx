'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface CheckupContextType {
    refreshTrigger: number
    triggerCheckupRefresh: () => void
}

const CheckupContext = createContext<CheckupContextType | undefined>(undefined)

export const CheckupProvider = ({ children }: { children: ReactNode }) => {
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    const triggerCheckupRefresh = () => {
        setRefreshTrigger(prev => prev + 1)
    }

    return (
        <CheckupContext.Provider value={{ refreshTrigger, triggerCheckupRefresh }}>
            {children}
        </CheckupContext.Provider>
    )
}

export const useCheckupContext = () => {
    const context = useContext(CheckupContext)
    if (!context) {
        throw new Error('useCheckupContext must be used within a CheckupProvider')
    }
    return context
}
