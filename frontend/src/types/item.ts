export interface Item {
    id: string
    name: string
    pictureUrl: string
    itemType: string
    status: string
    ownershipDuration: string
    lastUsedDuration: string
    item_received_date?: string
    last_used?: string
    ownership_duration?: {
        years: number
        months: number
        days: number
        description: string
    }
} 