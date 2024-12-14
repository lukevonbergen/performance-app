// js/auth/signup-venue.js
export async function signupVenue(userData) {
    const { email } = userData;
    
    // Check for existing user
    const { data: existingVenue } = await supabase
        .from('venues')
        .select('email')
        .eq('email', email);
        
    if (existingVenue?.length) {
        throw new Error('Email already registered');
    }

    return await supabase
        .from('venues')
        .insert([{
            ...userData,
            created_at: new Date().toISOString()
        }]);
}