// js/auth/login.js
export async function handleLogin(email, password) {
    try {
        // First check venues table
        const { data: venueData } = await supabase
            .from('venues')
            .select(`
                id,
                email,
                venue_name,
                first_name,
                address,
                phone,
                password,
                created_at,
                updated_at
            `)  // Explicitly select the fields we need, including first_name
            .eq('email', email.toLowerCase())
            .eq('password', password)
            .single();
        
        if (venueData) {
            return { user: { ...venueData, type: 'venue' }, redirect: 'dashboard' };
        }

        // Check performers table
        const { data: performerData } = await supabase
            .from('performers')
            .select(`
                id,
                email,
                stage_name,
                first_name,
                phone,
                password,
                created_at,
                updated_at
            `)
            .eq('email', email.toLowerCase())
            .eq('password', password)
            .single();
            
        if (performerData) {
            return { user: { ...performerData, type: 'performer' }, redirect: 'performer-dashboard' };
        }

        throw new Error('Invalid credentials');
    } catch (error) {
        throw error;
    }
}
