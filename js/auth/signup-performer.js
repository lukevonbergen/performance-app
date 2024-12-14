// js/auth/signup-performer.js
export async function signupPerformer(userData) {
    const { email } = userData;
    
    // Check for existing user
    const { data: existingPerformer } = await supabase
        .from('performers')
        .select('email')
        .eq('email', email);
        
    if (existingPerformer?.length) {
        throw new Error('Email already registered');
    }

    return await supabase
        .from('performers')
        .insert([{
            ...userData,
            created_at: new Date().toISOString()
        }]);
}