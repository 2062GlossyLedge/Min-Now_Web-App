import { SignedOut, SignUpButton } from '@clerk/nextjs'

export default function AuthMessage() {
    return (
        <SignedOut>
            <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                    Sign up to access all features
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Create an account to start your journey to live minimally
                </p>
                <SignUpButton mode="modal">
                    <button className="px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors">
                        Sign Up Now
                    </button>
                </SignUpButton>
            </div>
        </SignedOut>
    )
} 