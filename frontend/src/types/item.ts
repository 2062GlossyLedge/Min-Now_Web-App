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
    currentLocationId?: string | null
    locationPath?: string | null
    locationUpdatedAt?: string | null
}

export interface ItemSearchResult {
    id: string
    name: string
    pictureUrl: string
    itemType: string
    status: string
    currentLocationId?: string | null
    locationPath?: string | null
}

// Elasticsearch Agent Types
export interface ESAgentQueryRequest {
    query: string
}

export interface ESAgentQueryResponse {
    success: boolean
    response: {
        message: string
    }
    conversation_id?: string
    elapsed_time_ms: number
    error?: string
} 