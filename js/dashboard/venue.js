// js/dashboard/venue.js
export async function loadVenueDashboard(venueId) {
    const today = new Date().toISOString().split('T')[0];
    
    return await supabase
        .from('performances')
        .select(`
            *,
            performers (
                stage_name,
                id
            )
        `)
        .eq('venue_id', venueId)
        .gte('date', today)
        .order('date', { ascending: true });
}

export async function searchPerformers(date, startTime) {
    // Your existing search logic
}