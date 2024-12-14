// js/auth/login.js
export async function handleLogin(email, password) {
    try {
        // First check venues table
        const { data: venueData } = await supabase
            .from('venues')
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('password', password)
            .single();

        if (venueData) {
            return { user: { ...venueData, type: 'venue' }, redirect: 'dashboard' };
        }

        // Check performers table
        const { data: performerData } = await supabase
            .from('performers')
            .select('*')
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