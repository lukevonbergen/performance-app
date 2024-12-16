import { supabase } from '../utils/supabase.js';
// Rest of your JavaScript code
    
// Make supabase globally available
window.supabase = supabase;

// Get user data
window.user = JSON.parse(sessionStorage.getItem('user'));
if (!window.user || window.user.type !== 'venue') {
    window.location.href = 'login';
}

// Display user info
document.getElementById('venueName').textContent = window.user.venue_name;

// Set minimum date to today
document.getElementById('searchDate').min = new Date().toISOString().split('T')[0];

// Global variable to store selected performer for booking
window.selectedPerformer = null;
window.selectedTime = null;

function formatTime(timeString) {
    if (!timeString) return 'Invalid Time';

    // Split hours and minutes from the input time string
    const [hours, minutes] = timeString.split(':').map(Number);

    // Format to 12-hour time without time zone influence
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12; // Handle 0 and 12 edge cases
    const formattedMinutes = String(minutes).padStart(2, '0');

    return `${formattedHours}:${formattedMinutes} ${period}`;
}

function calculateTotalCost(startTime, endTime, hourlyRate) {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startTotalMinutes = (startHours * 60) + startMinutes;
    const endTotalMinutes = (endHours * 60) + endMinutes;
    
    const durationHours = (endTotalMinutes - startTotalMinutes) / 60;
    const totalCost = durationHours * hourlyRate;
    return totalCost.toFixed(2);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    
    // Add ordinal suffix to day
    const day = date.getDate();
    const suffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
        }
    };

    return `${date.toLocaleDateString('en-GB', { weekday: 'long' })} ${day}${suffix(day)} ${date.toLocaleDateString('en-GB', { month: 'long' })}`;
}


async function loadDashboardData() {
    try {
        const today = new Date().toISOString().split('T')[0];
        console.log('Fetching fresh data for date:', today);

        // Clear cache and get fresh data
        const { data: upcomingEvents, error } = await supabase
            .from('performances')
            .select(`
                *,
                performers (
                    stage_name
                )
            `)
            .eq('venue_id', window.user.id)
            .gte('date', today)
            .order('date', { ascending: true });

        if (error) {
            console.error('Fetch error:', error);
            throw error;
        }

        console.log('Fresh events data:', upcomingEvents);
        const confirmedEvents = upcomingEvents?.filter(event => event.status === 'confirmed') || [];
        const totalCost = confirmedEvents.reduce((sum, event) => {
            return sum + parseFloat(calculateTotalCost(event.start_time, event.end_time, event.booking_rate));
        }, 0);

        document.getElementById('totalCost').textContent = `£${totalCost.toFixed(2)}`;

        const upcomingEventsList = document.getElementById('upcomingEventsList');
        
        if (upcomingEvents && upcomingEvents.length > 0) {
            upcomingEventsList.innerHTML = upcomingEvents.map(event => `
                <div class="border-l-4 ${
                    event.status === 'confirmed' ? 'border-green-500' :
                    event.status === 'pending' ? 'border-yellow-500' :
                    'border-gray-500'
                } pl-4 py-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-medium text-white">${event.performers.stage_name}</h3>
                            <p class="text-sm text-gray-300">${formatDate(event.date)}</p>
                            <p class="text-sm text-gray-300">${formatTime(event.start_time)} - ${formatTime(event.end_time)}</p>
                            <div class="flex space-x-2 text-sm text-gray-300">
                                <p>Rate: £${event.booking_rate}/hr</p>
                                <span>•</span>
                                <p>Total: £${calculateTotalCost(event.start_time, event.end_time, event.booking_rate)}</p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                event.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                                event.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-gray-500/20 text-gray-400'
                            }">
                                ${event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                            </span>
                            <button 
                                onclick="cancelBooking('${event.id}')"
                                class="mt-2 text-sm text-red-400 hover:text-red-300"
                            >
                                Cancel Booking
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            upcomingEventsList.innerHTML = `
                <div class="text-center text-gray-500">
                    No upcoming events scheduled
                </div>
            `;
        }

        // Update today's schedule
        const todayEvents = upcomingEvents?.filter(event => event.date === today) || [];
        const scheduleList = document.getElementById('scheduleList');
        
        if (todayEvents.length > 0) {
            scheduleList.innerHTML = todayEvents.map(event => `
                <div class="border-l-4 border-blue-500 pl-4">
                    <h3 class="font-medium text-white">${event.performers.stage_name}</h3>
                    <p class="text-gray-300">${formatTime(event.start_time)} - ${formatTime(event.end_time)}</p>
                    <p class="text-sm text-gray-400">Status: ${event.status}</p>
                </div>
            `).join('');
        } else {
            scheduleList.innerHTML = `
                <div class="text-center text-gray-500">
                    No performances scheduled for today
                </div>
            `;
        }

        // Update stats
        document.getElementById('actsCount').textContent = todayEvents.length;

    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function searchPerformers(date, startTime) {
    try {
        // Convert date and time to timestamp
        const searchDateTime = new Date(`${date}T${startTime}`);
        
        // First, get existing bookings for this date and time
        const { data: existingBookings, error: bookingsError } = await supabase
            .from('performances')
            .select('performer_id')
            .eq('date', date)
            .eq('start_time', startTime + ':00');

        if (bookingsError) throw bookingsError;

        // Get array of already booked performer IDs
        const bookedPerformerIds = existingBookings?.map(booking => booking.performer_id) || [];
        
        // Get all performers with availability on this date
        const { data: availability, error } = await supabase
            .from('performer_availability')
            .select(`
                *,
                performers (
                    id,
                    stage_name
                )
            `)
            .eq('date', date);

        if (error) throw error;

        // Filter available performers
        const availablePerformers = (availability || []).filter(slot => {
            // Exclude if performer is already booked
            if (bookedPerformerIds.includes(slot.performer_id)) return false;
            
            // Check if requested time falls within availability slot
            const requestedTime = parseInt(startTime.split(':')[0]);
            const slotStart = parseInt(slot.start_time.split(':')[0]);
            const slotEnd = parseInt(slot.end_time.split(':')[0]);
            
            return requestedTime >= slotStart && requestedTime < slotEnd;
        });

        const resultsDiv = document.getElementById('searchResults');
        
        if (availablePerformers.length > 0) {
            resultsDiv.innerHTML = availablePerformers.map(slot => `
                <div class="border rounded-lg p-4 flex justify-between items-center bg-black/20 backdrop-blur-lg">
                    <div>
                        <h3 class="font-medium text-white">${slot.performers.stage_name}</h3>
                        <p class="text-sm text-gray-300">Available ${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}</p>
                        <div class="flex space-x-2 text-sm text-gray-300">
                            <p>Rate: £${slot.rate_per_hour}/hr</p>
                            <span>•</span>
                            <p>Total: £${calculateTotalCost(slot.start_time, slot.end_time, slot.rate_per_hour)}</p>
                        </div>
                    </div>
                    <button 
                        id="book-${slot.performer_id}"
                        onclick="openBookingModal(\`${slot.performer_id}\`, \`${slot.performers.stage_name}\`, ${slot.rate_per_hour}, \`${searchDateTime.toISOString()}\`)"
                        class="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all duration-200"
                    >
                        Book Now
                    </button>
                </div>
            `).join('');
        } else {
            resultsDiv.innerHTML = `
                <div class="text-center text-gray-500">
                    No performers available at this time
                </div>
            `;
        }
    } catch (error) {
        console.error('Error searching performers:', error);
        document.getElementById('searchResults').innerHTML = `
            <div class="text-center text-red-500">
                Error searching for performers. Please try again.
            </div>
        `;
    }
}


window.cancelBooking = async function(bookingId) {
    try {
        // First get the booking details
        const { data: booking, error: fetchError } = await supabase
            .from('performances')
            .select('*')
            .eq('id', bookingId)
            .single();

        if (fetchError) throw fetchError;

        // Delete the booking
        const { error: deleteError } = await supabase
            .from('performances')
            .delete()
            .eq('id', bookingId)
            .eq('venue_id', window.user.id);

        if (deleteError) throw deleteError;

        // Refresh the dashboard
        loadDashboardData();

        // Show success message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'fixed bottom-4 right-4 bg-green-500/20 text-green-400 px-6 py-3 rounded-lg';
        messageDiv.textContent = 'Booking cancelled successfully';
        document.body.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), 3000);

    } catch (error) {
        console.error('Error cancelling booking:', error);
        
        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed bottom-4 right-4 bg-red-500/20 text-red-400 px-6 py-3 rounded-lg';
        errorDiv.textContent = 'Error cancelling booking';
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }
};

// Modal functions
window.openBookingModal = async function(performerId, performerName, rate, startTime) {
    window.selectedPerformer = {
        id: performerId,
        name: performerName,
        rate: rate
    };
    window.selectedTime = startTime;

    // Get the availability slot times
    const date = new Date(startTime).toISOString().split('T')[0];
    const { data: slot, error } = await supabase
        .from('performer_availability')
        .select('start_time, end_time, rate_per_hour')
        .eq('performer_id', performerId)
        .eq('date', date)
        .single();

    if (error) {
        console.error('Error fetching availability:', error);
        return;
    }

    document.getElementById('bookingDetails').innerHTML = `
        <div class="space-y-2">
            <p><span class="font-medium">Performer:</span> ${performerName}</p>
            <p><span class="font-medium">Date:</span> ${new Date(startTime).toLocaleDateString()}</p>
            <p><span class="font-medium">Time:</span> ${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}</p>
            <p><span class="font-medium">Rate:</span> £${rate}/hr</p>
            <p><span class="font-medium">Total Cost:</span> £${calculateTotalCost(slot.start_time, slot.end_time, slot.rate_per_hour)}</p>
        </div>
    `;

    document.getElementById('bookingModal').classList.remove('hidden');
};

window.closeBookingModal = function() {
    document.getElementById('bookingModal').classList.add('hidden');
    window.selectedPerformer = null;
    window.selectedTime = null;
};

window.confirmBooking = async function() {
    try {
        const date = new Date(window.selectedTime).toISOString().split('T')[0];
        const startTime = document.getElementById('searchStartTime').value;
        
        // Get the availability slot end time instead of calculating it
        const { data: availabilitySlot, error: slotError } = await supabase
            .from('performer_availability')
            .select('end_time')
            .eq('performer_id', window.selectedPerformer.id)
            .eq('date', date)
            .single();

        if (slotError) throw slotError;

        const bookingData = {
            venue_id: window.user.id,
            performer_id: window.selectedPerformer.id,
            date: date,
            start_time: startTime + ':00',
            end_time: availabilitySlot.end_time,
            booking_rate: window.selectedPerformer.rate,
            status: 'pending'
        };

        const { error } = await supabase
            .from('performances')
            .insert([bookingData]);

        if (error) throw error;

        closeBookingModal();
        
        // Show success message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'fixed bottom-4 right-4 bg-green-500/20 text-green-400 px-6 py-3 rounded-lg z-50 flex items-center';
        messageDiv.innerHTML = `
            <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Booking submitted successfully! Awaiting performer confirmation.
        `;
        document.body.appendChild(messageDiv);
        
        // Add fade-out animation
        setTimeout(() => {
            messageDiv.style.transition = 'opacity 0.5s ease-in-out';
            messageDiv.style.opacity = '0';
            setTimeout(() => messageDiv.remove(), 500);
        }, 3000);

        loadDashboardData();
        document.getElementById('searchForm').dispatchEvent(new Event('submit'));
    } catch (error) {
        console.error('Error creating booking:', error);
        
        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed bottom-4 right-4 bg-red-500/20 text-red-400 px-6 py-3 rounded-lg z-50 flex items-center';
        errorDiv.innerHTML = `
            <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Error creating booking. Please try again.
        `;
        document.body.appendChild(errorDiv);
        setTimeout(() => {
            errorDiv.style.transition = 'opacity 0.5s ease-in-out';
            errorDiv.style.opacity = '0';
            setTimeout(() => errorDiv.remove(), 500);
        }, 3000);
    }
};

// Add these to your existing venue.js file

// Navigation handling
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        // Update active states
        document.querySelectorAll('.nav-link').forEach(el => {
            el.classList.remove('bg-white/10');
        });
        link.classList.add('bg-white/10');

        // Show correct content
        const tabId = link.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById(`${tabId}-tab`).classList.remove('hidden');

        // Close mobile menu if open
        if (window.innerWidth < 1024) {
            document.getElementById('sidebar').classList.add('-translate-x-full');
        }
    });
});

// Mobile menu toggle
document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('-translate-x-full');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    if (window.innerWidth < 1024 && 
        !sidebar.contains(e.target) && 
        !mobileMenuBtn.contains(e.target) && 
        !sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
    }
});

// Set initial active tab
document.querySelector('[data-tab="dashboard"]').classList.add('bg-white/10');

// Logout function
window.logout = function() {
    sessionStorage.removeItem('user');
    window.location.href = 'login';
};

// Set up form submission handler
document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('searchDate').value;
    const startTime = document.getElementById('searchStartTime').value;
    await searchPerformers(date, startTime);
});

// Load initial data
loadDashboardData();

// Refresh data every minute
setInterval(loadDashboardData, 60000);