import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// export async function POST(request: Request) {
//     try {
//         const csrfToken = request.headers.get('X-CSRFToken') || ''
//         console.log('CSRF Token from request header:', csrfToken)

//         const body = await request.json()
//         console.log('Request body:', body)

//         const response = await fetch(`${API_BASE_URL}/api/items`, {
//             method: 'POST',
//             headers: {
//                 'accept': 'application/json',
//                 'Content-Type': 'application/json',
//                 'X-CSRFToken': csrfToken,
//             },
//             mode: 'cors',
//             body: JSON.stringify(body),
//         })

//         console.log('Backend response status:', response.status)
//         const responseText = await response.text()
//         console.log('Backend response:', responseText)

//         if (!response.ok) {
//             throw new Error(`Backend error: ${response.status} - ${responseText}`)
//         }

//         const data = JSON.parse(responseText)
//         return NextResponse.json(data)
//     } catch (error: any) {
//         console.error('Detailed error:', {
//             message: error.message,
//             stack: error.stack,
//         })
//         return NextResponse.json(
//             { error: error.message || 'Failed to create item' },
//             { status: 500 }
//         )
//     }
// }

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')

        const response = await fetch(`${API_BASE_URL}/api/items?status=${status}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('Error fetching items:', error)
        return NextResponse.json(
            { error: 'Failed to fetch items' },
            { status: 500 }
        )
    }
} 