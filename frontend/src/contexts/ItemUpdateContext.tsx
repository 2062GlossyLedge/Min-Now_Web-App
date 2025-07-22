'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ItemUpdateContextType {
    refreshTrigger: number
    triggerRefresh: () => void
    lastUpdatedItems: Set<string>
    addUpdatedItem: (itemId: string) => void
    clearUpdatedItems: () => void
}

const ItemUpdateContext = createContext<ItemUpdateContextType | undefined>(undefined)

export const ItemUpdateProvider = ({ children }: { children: ReactNode }) => {
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [lastUpdatedItems, setLastUpdatedItems] = useState<Set<string>>(new Set())

    const triggerRefresh = () => {
        setRefreshTrigger(prev => prev + 1)
    }

    const addUpdatedItem = (itemId: string) => {
        setLastUpdatedItems(prev => new Set([...prev, itemId]))
    }

    const clearUpdatedItems = () => {
        setLastUpdatedItems(new Set())
    }

    return (
        <ItemUpdateContext.Provider value={{
            refreshTrigger,
            triggerRefresh,
            lastUpdatedItems,
            addUpdatedItem,
            clearUpdatedItems
        }}>
            {children}
        </ItemUpdateContext.Provider>
    )
}

export const useItemUpdate = () => {
    const context = useContext(ItemUpdateContext)
    if (!context) {
        throw new Error('useItemUpdate must be used within ItemUpdateProvider')
    }
    return context
} 