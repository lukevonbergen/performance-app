import { supabase } from '../utils/supabase.js';

// Make supabase and user globally available
window.supabase = supabase;
window.user = JSON.parse(sessionStorage.getItem('user'));

if (!window.user || window.user.type !== 'performer') {
    window.location.href = 'login';
}

// Display user info
document.getElementById('performerName').textContent = window.user.stage_name || 'Performer Dashboard';

function formatTime(timeString) {
    if (!timeString) return 'Invalid Time';
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = String(minutes).padStart(2, '0');
    return `${formattedHours}:${formattedMinutes} ${period}`;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg z-50 ${
        type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease-in-out';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

async function loadAvailability() {
    try {
        const { data: availability, error } = await supabase
            .from('performer_availability')
            .select('*')
            .eq('performer_id', window.user.id)
            .gte('date', new Date().toISOString().split('T')[0])
            .order('date');

        if (error) throw error;

        const availabilityList = document.getElementById('availabilityList');
        
        if (availability && availability.length > 0) {
            availabilityList.innerHTML = availability.map(slot => `
                <div class="border-l-4 border-blue-500 pl-4 flex justify-between items-center">
                    <div>
                        <p class="font-semibold text-white">${new Date(slot.date).toLocaleDateString()}</p>
                        <p class="text-gray-300">${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}</p>
                        <p class="text-sm text-gray-400">£${slot.rate_per_hour} per hour</p>
                    </div>
                    <button onclick="deleteAvailability('${slot.id}')"
                        class="text-red-400 hover:text-red-300 transition-colors duration-200">
                        Delete
                    </button>
                </div>
            `).join('');
        } else {
            availabilityList.innerHTML = '<p class="text-center text-gray-400">No availability set</p>';
        }
    } catch (error) {
        console.error('Error loading availability:', error);
        showToast('Error loading availability', 'error');
    }
}

async function loadPendingBookings() {
    try {
        const { data: pendingBookings, error } = await supabase
            .from('performances')
            .select(`
                *,
                venues (
                    venue_name,
                    id
                )
            `)
            .eq('performer_id', window.user.id)
            .eq('status', 'pending')
            .gte('date', new Date().toISOString().split('T')[0])
            .order('date');

        if (error) throw error;

        const pendingList = document.getElementById('pendingBookingsList');
        
        if (pendingBookings && pendingBookings.length > 0) {
            pendingList.innerHTML = pendingBookings.map(booking => `
                <div class="border-l-4 border-yellow-500 pl-4 py-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-medium text-white">${booking.venues.venue_name}</h3>
                            <p class="text-gray-300">Date: ${new Date(booking.date).toLocaleDateString()}</p>
                            <p class="text-gray-300">Time: ${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</p>
                            <p class="text-gray-300">Rate: £${booking.booking_rate}/hr</p>
                        </div>
                        <div class="flex space-x-2">
                            <button 
                                onclick="handleBookingResponse('${booking.id}', 'confirmed')"
                                class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm transition-colors duration-200">
                                Accept
                            </button>
                            <button 
                                onclick="handleBookingResponse('${booking.id}', 'rejected')"
                                class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm transition-colors duration-200">
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            pendingList.innerHTML = `
                <div class="text-center text-gray-400">
                    No pending booking requests
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading pending bookings:', error);
        showToast('Error loading pending bookings', 'error');
    }
}

window.handleBookingResponse = async function(bookingId, status) {
    try {
        const { data: booking, error: fetchError } = await supabase
            .from('performances')
            .select('*')
            .eq('id', bookingId)
            .single();

        if (fetchError) throw fetchError;

        if (status === 'confirmed') {
            // Remove availability for this time slot
            const { error: availError } = await supabase
                .from('performer_availability')
                .delete()
                .eq('performer_id', window.user.id)
                .eq('date', booking.date)
                .eq('start_time', booking.start_time);

            if (availError) throw availError;
        }

        const { error: updateError } = await supabase
            .from('performances')
            .update({ status: status })
            .eq('id', bookingId);

        if (updateError) throw updateError;

        await Promise.all([
            loadPendingBookings(),
            loadDashboardData(),
            loadAvailability()
        ]);

        showToast(`Booking ${status === 'confirmed' ? 'accepted' : 'declined'} successfully`);
    } catch (error) {
        console.error('Error handling booking response:', error);
        showToast('Error updating booking status', 'error');
    }
};

async function loadDashboardData() {
    try {
        const { data: performances, error } = await supabase
            .from('performances')
            .select(`
                *,
                venues (
                    venue_name,
                    id
                )
            `)
            .eq('performer_id', window.user.id)
            .gte('date', new Date().toISOString().split('T')[0])
            .order('date');

        if (error) throw error;

        document.getElementById('upcomingGigs').textContent = performances?.length || 0;

        const performancesList = document.getElementById('performancesList');
        
        if (performances && performances.length > 0) {
            performancesList.innerHTML = performances.map(perf => `
                <div class="border-l-4 ${
                    perf.status === 'confirmed' ? 'border-green-500' : 'border-blue-500'
                } pl-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-medium text-white">${perf.venues?.venue_name || 'Unknown Venue'}</h3>
                            <p class="text-gray-300">Date: ${new Date(perf.date).toLocaleDateString()}</p>
                            <p class="text-gray-300">Time: ${formatTime(perf.start_time)} - ${formatTime(perf.end_time)}</p>
                            <p class="text-sm text-gray-400">Status: ${perf.status}</p>
                        </div>
                        ${perf.status === 'confirmed' ? `
                            <button 
                                onclick="cancelPerformance('${perf.id}')"
                                class="text-red-400 hover:text-red-300 transition-colors duration-200"
                            >
                                Cancel Performance
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        } else {
            performancesList.innerHTML = '<p class="text-center text-gray-400">No upcoming performances</p>';
        }

        // Load past performances and calculate stats
        const { data: pastPerfs, error: pastError } = await supabase
            .from('performances')
            .select(`
                *,
                ratings (
                    rating_value,
                    comment
                ),
                tips (
                    amount
                )
            `)
            .eq('performer_id', window.user.id)
            .lt('date', new Date().toISOString().split('T')[0])
            .order('date', { ascending: false });

        if (pastError) throw pastError;

        let totalRating = 0;
        let ratingCount = 0;
        let totalTips = 0;

        pastPerfs?.forEach(perf => {
            perf.ratings?.forEach(rating => {
                totalRating += rating.rating_value;
                ratingCount++;
            });
            perf.tips?.forEach(tip => {
                totalTips += tip.amount;
            });
        });

        document.getElementById('averageRating').textContent = 
            ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : '--';
        document.getElementById('totalTips').textContent = `£${totalTips.toFixed(2)}`;

        const pastPerfList = document.getElementById('pastPerformancesList');
        if (pastPerfs && pastPerfs.length > 0) {
            pastPerfList.innerHTML = pastPerfs.map(perf => `
                <div class="border-l-4 border-gray-500 pl-4">
                    <h3 class="font-medium text-white">${new Date(perf.date).toLocaleDateString()} - ${perf.venue_name}</h3>
                    ${perf.ratings && perf.ratings.length > 0 ? `
                        <div class="mt-2">
                            <p class="text-sm font-medium text-gray-300">Reviews:</p>
                            ${perf.ratings.map(rating => `
                                <div class="mt-1">
                                    <p class="text-sm text-gray-300">Rating: ${rating.rating_value}/5</p>
                                    ${rating.comment ? `<p class="text-sm text-gray-400">"${rating.comment}"</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    ${perf.tips && perf.tips.length > 0 ? `
                        <p class="text-sm text-green-400 mt-2">
                            Tips received: £${perf.tips.reduce((sum, tip) => sum + tip.amount, 0).toFixed(2)}
                        </p>
                    ` : ''}
                </div>
            `).join('');
        } else {
            pastPerfList.innerHTML = '<p class="text-center text-gray-400">No past performances</p>';
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

window.cancelPerformance = async function(performanceId) {
    try {
        const { data: performance, error: fetchError } = await supabase
            .from('performances')
            .select('*')
            .eq('id', performanceId)
            .single();

        if (fetchError) throw fetchError;

        const { error: deleteError } = await supabase
            .from('performances')
            .delete()
            .eq('id', performanceId)
            .eq('performer_id', window.user.id);

        if (deleteError) throw deleteError;

        // Restore availability
        const availabilityData = {
            performer_id: window.user.id,
            date: performance.date,
            start_time: performance.start_time,
            end_time: performance.end_time,
            rate_per_hour: performance.booking_rate
        };

        const { error: availError } = await supabase
            .from('performer_availability')
            .insert([availabilityData]);

        if (availError) throw availError;

        await Promise.all([
            loadDashboardData(),
            loadAvailability()
        ]);

        showToast('Performance cancelled successfully');
    } catch (error) {
        console.error('Error cancelling performance:', error);
        showToast('Error cancelling performance', 'error');
    }
};

// Modal functions
window.openAvailabilityModal = function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('availabilityDate').min = today;
    document.getElementById('availabilityModal').classList.remove('hidden');
};

window.closeAvailabilityModal = function() {
    document.getElementById('availabilityModal').classList.add('hidden');
    document.getElementById('availabilityForm').reset();
};

window.deleteAvailability = async function(id) {
    try {
        const { error } = await supabase
            .from('performer_availability')
            .delete()
            .eq('id', id);

        if (error) throw error;
        
        await loadAvailability();
        showToast('Availability deleted successfully');
    } catch (error) {
        console.error('Error deleting availability:', error);
        showToast('Error deleting availability', 'error');
    }
};

// Logout function
window.logout = function() {
    sessionStorage.removeItem('user');
    window.location.href = 'login';
};

// Form submission handler
document.getElementById('availabilityForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        const formData = {
            performer_id: window.user.id,
            date: document.getElementById('availabilityDate').value,
            start_time: document.getElementById('startTime').value + ':00',
            end_time: document.getElementById('endTime').value + ':00',
            rate_per_hour: parseFloat(document.getElementById('ratePerHour').value)
        };

        const { error } = await supabase
            .from('performer_availability')
            .insert([formData]);

        if (error) throw error;

        closeAvailabilityModal();
        await loadAvailability();
        showToast('Availability added successfully');
    } catch (error) {
        console.error('Error adding availability:', error);
        showToast('Error adding availability', 'error');
    }
});

// Load initial data
initializeDashboard();

// Refresh data every minute
setInterval(initializeDashboard, 60000);