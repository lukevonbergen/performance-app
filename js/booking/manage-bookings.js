// js/booking/manage-bookings.js
export async function handleBookingResponse(bookingId, status, performerId) {
    // Verify booking exists and belongs to performer
    const { data: booking } = await supabase
        .from('performances')
        .select('*')
        .eq('id', bookingId)
        .eq('performer_id', performerId)
        .single();

    if (!booking) {
        throw new Error('Booking not found');
    }

    // Check for conflicts if accepting
    if (status === 'confirmed') {
        const { data: existingBookings } = await supabase
            .from('performances')
            .select('*')
            .eq('performer_id', performerId)
            .eq('date', booking.date)
            .eq('status', 'confirmed');

        const hasConflict = existingBookings?.some(existing => {
            return (
                (booking.start_time >= existing.start_time && booking.start_time < existing.end_time) ||
                (booking.end_time > existing.start_time && booking.end_time <= existing.end_time)
            );
        });

        if (hasConflict) {
            throw new Error('Time slot conflict with existing booking');
        }
    }

    // Update booking status
    return await supabase
        .from('performances')
        .update({ status })
        .eq('id', bookingId)
        .select();
}