// js/dashboard/performer.js
export async function loadPerformerDashboard(performerId) {
    const today = new Date().toISOString().split('T')[0];
    
    const promises = [
        // Get upcoming performances
        supabase
            .from('performances')
            .select(`
                *,
                venues (venue_name, id)
            `)
            .eq('performer_id', performerId)
            .gte('date', today)
            .order('date'),

        // Get pending bookings
        supabase
            .from('performances')
            .select(`
                *,
                venues (venue_name, id)
            `)
            .eq('performer_id', performerId)
            .eq('status', 'pending')
            .gte('date', today)
            .order('date'),

        // Get availability
        supabase
            .from('performer_availability')
            .select('*')
            .eq('performer_id', performerId)
            .gte('date', today)
            .order('date')
    ];

    return await Promise.all(promises);
}