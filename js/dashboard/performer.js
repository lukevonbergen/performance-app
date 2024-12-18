// Import and Global Setup
import { supabase } from '../utils/supabase.js';

// Make supabase and user globally available
window.supabase = supabase;
window.user = JSON.parse(sessionStorage.getItem('user'));

// Authentication Check
if (!window.user || window.user.type !== 'performer') {
    window.location.href = 'login';
}

// Initialize UI
document.getElementById('performerName').textContent = window.user.stage_name || 'Performer Dashboard';

// Utility Functions
function formatTime(timeString) {
    if (!timeString) return 'Invalid Time';
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = String(minutes).padStart(2, '0');
    return `${formattedHours}:${formattedMinutes} ${period}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
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

function createMapsUrl(venue) {
    if (!venue) return '#';
    
    const address = [
        venue.address_line1,
        venue.address_line2,
        venue.city,
        venue.county,
        venue.postcode
    ].filter(Boolean).join(', ');

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function calculateDuration(startTime, endTime) {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const startTotalMinutes = (startHours * 60) + startMinutes;
    const endTotalMinutes = (endHours * 60) + endMinutes;
    return (endTotalMinutes - startTotalMinutes) / 60;
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
            .eq('performer_id', window.user.id);

        if (error) throw error;

        updateDashboardStats(performances);
        updateRecentActivity(performances);

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

function updateDashboardStats(performances) {
    const today = new Date().toISOString().split('T')[0];
    const upcomingPerformances = performances.filter(perf => perf.date >= today && perf.status === 'confirmed');
    
    // Update UI elements
    document.getElementById('upcomingGigs').textContent = upcomingPerformances.length;
    document.getElementById('averageRating').textContent = '--'; // We can keep this for future use
}

function updateRecentActivity(performances) {
    const recentActivityList = document.getElementById('recentActivityList');
    const today = new Date().toISOString().split('T')[0];
    const recentPerformances = performances
        .filter(perf => perf.date >= today)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);

    if (recentPerformances.length > 0) {
        recentActivityList.innerHTML = recentPerformances.map(perf => `
            <div class="border-l-4 ${
                perf.status === 'confirmed' ? 'border-green-500' :
                perf.status === 'pending' ? 'border-yellow-500' :
                'border-red-500'
            } pl-4">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-medium text-black">${perf.venues.venue_name}</h3>
                        <p class="text-black">${formatDate(perf.date)}</p>
                        <p class="text-black">${formatTime(perf.start_time)} - ${formatTime(perf.end_time)}</p>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            perf.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                            perf.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                        }">
                            ${perf.status.charAt(0).toUpperCase() + perf.status.slice(1)}
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    } else {
        recentActivityList.innerHTML = '<p class="text-center text-gray-400">No recent activity</p>';
    }
}

// Navigation Functions
function setActiveTab(tabId) {
    // Remove active class from all tabs
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('bg-black/5');
    });
    
    // Add active class to current tab
    const activeTab = document.querySelector(`[data-tab="${tabId}"]`);
    if (activeTab) {
        activeTab.classList.add('bg-black/5');
    }

    // Show/hide content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tabId}-tab`).classList.remove('hidden');
}

// Authentication Functions
window.logout = function() {
    sessionStorage.removeItem('user');
    window.location.href = 'login';
};

// Performance Management Functions
async function loadPerformances() {
    try {
        const { data: performances, error } = await supabase
            .from('performances')
            .select(`
                *,
                venues (
                    venue_name,
                    id,
                    address_line1,
                    address_line2,
                    city,
                    county,
                    postcode
                )
            `)
            .eq('performer_id', window.user.id)
            .gte('date', new Date().toISOString().split('T')[0])
            .order('date');

        if (error) throw error;

        // Filter performances by status
        const upcoming = performances?.filter(p => p.status === 'confirmed') || [];
        const pending = performances?.filter(p => p.status === 'pending') || [];
        const rejected = performances?.filter(p => p.status === 'rejected') || [];

        updatePerformancesUI(upcoming, pending, rejected);

    } catch (error) {
        console.error('Error loading performances:', error);
        showToast('Error loading performances', 'error');
    }
}

function updatePerformancesUI(upcoming, pending, rejected) {
    // Update Upcoming Performances
    const upcomingList = document.getElementById('upcomingPerformancesList');
    if (upcoming.length > 0) {
        upcomingList.innerHTML = upcoming.map(perf => `
            <div class="border-l-4 border-green-500 pl-4">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-medium text-black">${perf.venues?.venue_name || 'Unknown Venue'}</h3>
                        <p class="text-black">${formatDate(perf.date)}</p>
                        <p class="text-black">${formatTime(perf.start_time)} - ${formatTime(perf.end_time)}</p>
                        <div class="flex space-x-2 text-sm text-gray-400">
                            <p>Rate: £${perf.booking_rate}/hr</p>
                            <span>•</span>
                            <p>Total: £${calculatePerformanceTotal(perf)}</p>
                        </div>
                        <a href="${createMapsUrl(perf.venues)}" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="inline-flex items-center mt-2 text-indigo-500 hover:text-indigo-400 text-sm">
                            Get directions
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </a>
                    </div>
                    <button 
                        onclick="cancelPerformance('${perf.id}')"
                        class="text-red-400 hover:text-red-300 transition-colors duration-200"
                    >
                        Cancel Performance
                    </button>
                </div>
            </div>
        `).join('');
    } else {
        upcomingList.innerHTML = '<p class="text-center text-gray-400">No upcoming performances</p>';
    }

    // Update Pending Performances
    const pendingList = document.getElementById('pendingPerformancesList');
    if (pending.length > 0) {
        pendingList.innerHTML = pending.map(perf => `
            <div class="border-l-4 border-yellow-500 pl-4">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-medium text-black">${perf.venues?.venue_name || 'Unknown Venue'}</h3>
                        <p class="text-black">${formatDate(perf.date)}</p>
                        <p class="text-black">${formatTime(perf.start_time)} - ${formatTime(perf.end_time)}</p>
                        <div class="flex space-x-2 text-sm text-gray-400">
                            <p>Rate: £${perf.booking_rate}/hr</p>
                            <span>•</span>
                            <p>Total: £${calculatePerformanceTotal(perf)}</p>
                        </div>
                        <a href="${createMapsUrl(perf.venues)}" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="inline-flex items-center mt-2 text-indigo-500 hover:text-indigo-400 text-sm">
                            Get directions
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </a>
                    </div>
                    <div class="flex space-x-2">
                        <button 
                            onclick="handleBookingResponse('${perf.id}', 'confirmed')"
                            class="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 text-sm transition-colors duration-200">
                            Accept
                        </button>
                        <button 
                            onclick="handleBookingResponse('${perf.id}', 'rejected')"
                            class="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm transition-colors duration-200">
                            Decline
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } else {
        pendingList.innerHTML = '<p class="text-center text-gray-400">No pending requests</p>';
    }

    // Update Rejected Performances
    const rejectedList = document.getElementById('rejectedPerformancesList');
    if (rejected.length > 0) {
        rejectedList.innerHTML = rejected.map(perf => `
            <div class="border-l-4 border-red-500 pl-4">
                <div>
                    <h3 class="font-medium text-black">${perf.venues?.venue_name || 'Unknown Venue'}</h3>
                    <p class="text-black">${formatDate(perf.date)}</p>
                    <p class="text-black">${formatTime(perf.start_time)} - ${formatTime(perf.end_time)}</p>
                    <div class="flex space-x-2 text-sm text-gray-400">
                        <p>Rate: £${perf.booking_rate}/hr</p>
                        <span>•</span>
                        <p>Total: £${calculatePerformanceTotal(perf)}</p>
                    </div>
                    <a href="${createMapsUrl(perf.venues)}" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       class="inline-flex items-center mt-2 text-indigo-500 hover:text-indigo-400 text-sm">
                        Get directions
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </a>
                </div>
            </div>
        `).join('');
    } else {
        rejectedList.innerHTML = '<p class="text-center text-gray-400">No rejected performances</p>';
    }
}

function calculatePerformanceTotal(performance) {
    const duration = calculateDuration(performance.start_time, performance.end_time);
    return (duration * performance.booking_rate).toFixed(2);
}

// Reports Functions
async function loadReportsData() {
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
            .eq('performer_id', window.user.id);

        if (error) throw error;

        const stats = processReportsData(performances);
        updateReportsSummary(stats);
        createEarningsChart(stats.monthlyEarnings);
        createTimesChart(stats.timeStats);
        updatePerformanceHistoryTable(performances);

    } catch (error) {
        console.error('Error loading reports data:', error);
        showToast('Error loading reports data', 'error');
    }
}

function processReportsData(performances) {
    let totalEarnings = 0;
    let confirmedCount = 0;
    const monthlyEarnings = {};
    const venueStats = {};
    const timeStats = {};

    performances.forEach(perf => {
        if (perf.status === 'confirmed') {
            // Calculate earnings
            const duration = calculateDuration(perf.start_time, perf.end_time);
            const earnings = duration * perf.booking_rate;
            totalEarnings += earnings;
            confirmedCount++;

            // Monthly earnings
            const month = new Date(perf.date).toLocaleString('default', { month: 'short' });
            monthlyEarnings[month] = (monthlyEarnings[month] || 0) + earnings;

            // Venue stats
            const venueName = perf.venues?.venue_name || 'Unknown Venue';
            if (!venueStats[venueName]) {
                venueStats[venueName] = { 
                    performances: 0, 
                    earnings: 0, 
                    totalRate: 0 
                };
            }
            venueStats[venueName].performances++;
            venueStats[venueName].earnings += earnings;
            venueStats[venueName].totalRate += perf.booking_rate;

            // Time stats
            const hour = perf.start_time.split(':')[0];
            timeStats[hour] = (timeStats[hour] || 0) + 1;
        }
    });

    return {
        totalEarnings,
        totalPerformances: performances.length,
        confirmedPerformances: confirmedCount,
        confirmationRate: ((confirmedCount / performances.length) * 100) || 0,
        monthlyEarnings,
        venueStats,
        timeStats,
        topVenue: Object.entries(venueStats)
            .sort((a, b) => b[1].performances - a[1].performances)[0]?.[0] || '--'
    };
}

function updateReportsSummary(stats) {
    document.getElementById('totalEarnings').textContent = `£${stats.totalEarnings.toFixed(2)}`;
    document.getElementById('totalPerformances').textContent = stats.totalPerformances;
    document.getElementById('topVenue').textContent = stats.topVenue;
    document.getElementById('confirmationRate').textContent = `${stats.confirmationRate.toFixed(1)}%`;
}

let earningsChartInstance = null; // Declare a global variable to track the chart instance

function createEarningsChart(monthlyEarnings) {
    const ctx = document.getElementById('earningsChart');

    // Check if an existing chart instance exists and destroy it
    if (earningsChartInstance) {
        earningsChartInstance.destroy();
    }

    const months = Object.keys(monthlyEarnings);
    const earnings = Object.values(monthlyEarnings);

    // Create a new chart instance and assign it to the global variable
    earningsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Earnings',
                data: earnings,
                borderColor: '#8B5CF6',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: value => `£${value}`
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
}


let timesChartInstance = null; // Global variable to track the chart instance

function createTimesChart(timeStats) {
    const ctx = document.getElementById('timesChart');

    // Destroy existing chart instance, if it exists
    if (timesChartInstance) {
        timesChartInstance.destroy();
    }

    const hours = Object.keys(timeStats).sort();
    const counts = hours.map(hour => timeStats[hour]);

    // Create new chart and save the instance
    timesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hours.map(hour => `${hour}:00`),
            datasets: [{
                label: 'Performances',
                data: counts,
                backgroundColor: '#10B981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
}


function updateVenuePerformanceTable(venueStats) {
    const tableBody = document.getElementById('venuePerformanceTable');
    const venues = Object.entries(venueStats)
        .sort((a, b) => b[1].performances - a[1].performances);

    tableBody.innerHTML = venues.map(([name, stats]) => `
        <tr class="border-t border-black/10">
            <td class="py-4">${name}</td>
            <td class="py-4">${stats.performances}</td>
            <td class="py-4">£${stats.earnings.toFixed(2)}</td>
            <td class="py-4">£${(stats.totalRate / stats.performances).toFixed(2)}/hr</td>
        </tr>
    `).join('');
}

// Booking Response Functions
window.handleBookingResponse = async function(bookingId, status) {
    try {
        const { data: booking, error: fetchError } = await supabase
            .from('performances')
            .select('*')
            .eq('id', bookingId)
            .single();

        if (fetchError) throw fetchError;

        // If confirming booking, remove the availability
        if (status === 'confirmed') {
            const { error: availError } = await supabase
                .from('performer_availability')
                .delete()
                .eq('performer_id', window.user.id)
                .eq('date', booking.date)
                .eq('start_time', booking.start_time);

            if (availError) throw availError;
        }

        // Update the booking status
        const { error: updateError } = await supabase
            .from('performances')
            .update({ status: status })
            .eq('id', bookingId);

        if (updateError) throw updateError;

        // Refresh data
        await refreshPerformanceData();
        showToast(`Booking ${status === 'confirmed' ? 'accepted' : 'declined'} successfully`);
    } catch (error) {
        console.error('Error handling booking response:', error);
        showToast('Error updating booking status', 'error');
    }
};

window.cancelPerformance = async function(performanceId) {
    try {
        // Get the performance details before deleting
        const { data: performance, error: fetchError } = await supabase
            .from('performances')
            .select('*')
            .eq('id', performanceId)
            .single();

        if (fetchError) throw fetchError;

        // Delete the performance
        const { error: deleteError } = await supabase
            .from('performances')
            .delete()
            .eq('id', performanceId)
            .eq('performer_id', window.user.id);

        if (deleteError) throw deleteError;

        // Restore the availability
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

        // Refresh data
        await refreshPerformanceData();
        showToast('Performance cancelled successfully');
    } catch (error) {
        console.error('Error cancelling performance:', error);
        showToast('Error cancelling performance', 'error');
    }
};

async function refreshPerformanceData() {
    await Promise.all([
        loadPerformances(),
        loadAvailability()
    ]);
}

// Availability Management Functions
async function loadAvailability() {
    try {
        const { data: availability, error } = await supabase
            .from('performer_availability')
            .select('*')
            .eq('performer_id', window.user.id)
            .gte('date', new Date().toISOString().split('T')[0])
            .order('date');

        if (error) throw error;

        updateAvailabilityUI(availability);
    } catch (error) {
        console.error('Error loading availability:', error);
        showToast('Error loading availability', 'error');
    }
}

function updateAvailabilityUI(availability) {
    const availabilityList = document.getElementById('availabilityList');
    
    if (availability && availability.length > 0) {
        availabilityList.innerHTML = '';
        availability.forEach(slot => {
            availabilityList.appendChild(renderAvailabilityItem(slot));
        });
    } else {
        availabilityList.innerHTML = '<p class="text-center text-gray-400">No availability set</p>';
    }
}

function renderAvailabilityItem(slot) {
    const duration = calculateDuration(slot.start_time, slot.end_time);
    const totalCost = duration * slot.rate_per_hour;

    const div = document.createElement('div');
    div.className = 'border-l-4 border-blue-500 pl-4 flex justify-between items-center';
    div.dataset.availabilityId = slot.id;

    div.innerHTML = `
        <div>
            <p class="font-semibold text-black">${formatDate(slot.date)}</p>
            <p class="text-black">${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}</p>
            <div class="flex space-x-2 text-sm text-gray-400">
                <p>Rate: £${slot.rate_per_hour}/hr</p>
                <span>•</span>
                <p>Total: £${totalCost.toFixed(2)}</p>
            </div>
        </div>
        <button 
            class="text-red-400 hover:text-red-300 transition-colors duration-200"
            onclick="deleteAvailability('${slot.id}')"
        >
            Delete
        </button>
    `;

    return div;
}

// Modal Management Functions
let availabilityToDelete = null;

window.openAvailabilityModal = function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('availabilityDate').min = today;
    document.getElementById('availabilityModal').classList.remove('hidden');
};

window.closeAvailabilityModal = function() {
    document.getElementById('availabilityModal').classList.add('hidden');
    document.getElementById('availabilityForm').reset();
};

function openConfirmationModal(id) {
    availabilityToDelete = id;
    document.getElementById('confirmationModal').classList.remove('hidden');
}

function closeConfirmationModal() {
    availabilityToDelete = null;
    document.getElementById('confirmationModal').classList.add('hidden');
}

// Availability Delete Functions
window.deleteAvailability = async function(id) {
    openConfirmationModal(id);
};

// Form Handlers
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

// Confirmation Modal Handler
document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!availabilityToDelete) return;
    
    try {
        const { error } = await supabase
            .from('performer_availability')
            .delete()
            .eq('id', availabilityToDelete);

        if (error) throw error;

        await loadAvailability();
        closeConfirmationModal();
        showToast('Availability deleted successfully');
    } catch (error) {
        console.error('Error deleting availability:', error);
        showToast('Error deleting availability', 'error');
    }
});

function updatePerformanceHistoryTable(performances) {
    const tableBody = document.getElementById('performanceHistoryTable');
    
    // Sort performances by date, newest first
    const sortedPerformances = [...performances].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    tableBody.innerHTML = sortedPerformances.map(perf => {
        const duration = calculateDuration(perf.start_time, perf.end_time);
        const totalCost = duration * perf.booking_rate;
        
        const statusColors = {
            confirmed: 'bg-green-500/20 text-green-400',
            pending: 'bg-yellow-500/20 text-yellow-400',
            rejected: 'bg-red-500/20 text-red-400'
        };

        return `
            <tr class="border-t border-black/10">
                <td class="py-4">${formatDate(perf.date)}</td>
                <td class="py-4">${perf.venues.venue_name}</td>
                <td class="py-4">${formatTime(perf.start_time)} - ${formatTime(perf.end_time)}</td>
                <td class="py-4">£${perf.booking_rate}/hr</td>
                <td class="py-4">£${totalCost.toFixed(2)}</td>
                <td class="py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[perf.status]}">
                        ${perf.status.charAt(0).toUpperCase() + perf.status.slice(1)}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Navigation Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Set up navigation
    const currentTab = window.location.hash.slice(1) || 'dashboard';
    setActiveTab(currentTab);

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.getAttribute('data-tab');
            setActiveTab(tabId);

            // Load reports data if reports tab is clicked
            if (tabId === 'reports') {
                loadReportsData();
            }
            
            // Handle mobile menu
            if (window.innerWidth < 1024) {
                document.getElementById('sidebar').classList.add('-translate-x-full');
            }
        });
    });

    // Mobile menu handlers
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('-translate-x-full');
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
});

// Initialize Dashboard
async function initializeDashboard() {
    try {
        await Promise.all([
            loadDashboardData(),
            loadPerformances(),
            loadAvailability()
        ]);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showToast('Error loading dashboard', 'error');
    }
}

// Start the application
initializeDashboard();

// Refresh data every minute
setInterval(initializeDashboard, 60000);