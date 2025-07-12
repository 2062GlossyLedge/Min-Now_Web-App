import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'

//update item

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params
        const body = await request.json()

        const response = await fetch(`${API_BASE_URL}/api/items/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error updating item:', error)
        return NextResponse.json(
            { error: 'Failed to update item' },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Forward the request to your Django backend
        const response = await fetch('http://localhost:8000/api/items/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to create item' },
            { status: 500 }
        )
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')

        const response = await fetch(`http://localhost:8000/api/items/?status=${status}`)
        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch items' },
            { status: 500 }
        )
    }
} 