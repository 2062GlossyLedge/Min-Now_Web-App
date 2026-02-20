export interface Item {
    id: string
    name: string
    pictureUrl: string
    picture_url?: string
    itemType: string
    item_type?: string
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
    ownership_duration_goal_months?: number
    ownershipDurationGoalMonths?: number
    ownership_duration_goal_progress?: number
    ownershipDurationGoalProgress?: number
    location_path?: string | null
    location_updated_at?: string | null
} 