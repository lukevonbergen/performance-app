// js/utils/error-handler.js
export function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    if (error.message.includes('duplicate key')) {
        return 'This email is already registered.';
    }
    
    if (error.message.includes('not found')) {
        return 'Invalid credentials.';
    }
    
    return 'An unexpected error occurred. Please try again.';
}