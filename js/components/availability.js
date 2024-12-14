// js/components/availability.js
export async function addAvailability(performerId, availabilityData) {
    return await supabase
        .from('performer_availability')
        .insert([{
            performer_id: performerId,
            ...availabilityData
        }]);
}

export async function deleteAvailability(id) {
    return await supabase
        .from('performer_availability')
        .delete()
        .eq('id', id);
}