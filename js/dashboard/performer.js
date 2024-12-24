// Import and Global Setup
import { supabase } from '../utils/supabase.js';
let performanceToCancel = null;
let earningsChartInstance = null;
let timesChartInstance = null;
let venueChartInstance = null;
let performanceTrendChartInstance = null;


// Make supabase and user globally available
window.supabase = supabase;
window.user = JSON.parse(sessionStorage.getItem('user'));

// Authentication Check
if (!window.user || window.user.type !== 'performer') {
    window.location.href = 'login';
}

// Tab persistence functions
function saveActiveTab(tabId) {
    localStorage.setItem('activeTab', tabId);
}

function getActiveTab() {
    return localStorage.getItem('activeTab') || 'dashboard'; // Default to dashboard if no tab is stored
}

// Authentication Functions
window.logout = function() {
    sessionStorage.removeItem('user');
    localStorage.removeItem('activeTab'); // Clear stored tab on logout
    window.location.href = 'login';
};

// Initialize UI and Navigation
if (!window.hasInitializedNavigation) {
    // Dropdown toggle functionality
    document.getElementById('userMenuBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('userDropdown').classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('userDropdown');
        const button = document.getElementById('userMenuBtn');
        if (!button.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    });

    window.hasInitializedNavigation = true;
}

// Initialize UI
document.getElementById('performerName').textContent = window.user.stage_name || 'Performer Dashboard';

// Fix the destroyCharts function near the top of the file
function destroyCharts() {
    if (earningsChartInstance) {
        earningsChartInstance.destroy();
        earningsChartInstance = null;
    }
    if (timesChartInstance) {
        timesChartInstance.destroy();
        timesChartInstance = null;
    }
    if (venueChartInstance) {
        venueChartInstance.destroy();
        venueChartInstance = null;
    }
    if (performanceTrendChartInstance) {
        performanceTrendChartInstance.destroy();
        performanceTrendChartInstance = null;
    }
}

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

// Navigation Functions
function setActiveTab(tabId) {
    // Remove active class from all tabs
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('bg-white/5', 'bg-white/10');
    });

    // Add active class to the selected tab
    const activeTab = document.querySelector(`[data-tab="${tabId}"]`);
    if (activeTab) {
        activeTab.classList.add('bg-white/5');
    } else {
        console.warn(`Active tab not found for tabId: ${tabId}`);
    }

    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });

    // Show the selected tab content
    const tabContent = document.getElementById(`${tabId}-tab`);
    if (tabContent) {
        tabContent.classList.remove('hidden');
    } else {
        console.warn(`Tab content not found for tabId: ${tabId}`);
    }

    // Destroy charts before loading new tab
    destroyCharts();

    if (tabId === 'reports') {
        loadReportsData();
    }
}


// Authentication Functions
window.logout = function() {
    sessionStorage.removeItem('user');
    window.location.href = 'login';
};

// Dashboard Functions
async function loadDashboardData() {
    try {
        // Get all performances for this performer
        const { data: performances, error: perfError } = await supabase
            .from('performances')
            .select(`
                *,
                venues (
                    venue_name,
                    id
                )
            `)
            .eq('performer_id', window.user.id);

        if (perfError) throw perfError;

        // Get all ratings for all performances by this performer
        const { data: ratings, error: ratingsError } = await supabase
            .from('ratings')
            .select('overall_rating')
            .in('performance_id', performances.map(p => p.id));

        if (ratingsError) throw ratingsError;

        updateDashboardStats(performances, ratings);
        updatePerformanceTrend(performances);
        updateRecentActivity(performances);

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// Update the dashboard stats function to calculate total earnings from completed performances
function updateDashboardStats(performances, ratings) {
    // Add null checks for all elements first
    const elements = {
        upcomingGigs: document.getElementById('upcomingGigs'),
        averageRating: document.getElementById('averageRating'),
        totalEarnings: document.getElementById('totalEarnings'),
        monthlyEarnings: document.getElementById('monthlyEarnings'),
        completedGigs: document.getElementById('completedGigs'),
        topVenue: document.getElementById('topVenue'),
        monthlyGigs: document.getElementById('monthlyGigs')
    };

    // Check if any required elements are missing
    const missingElements = Object.entries(elements)
        .filter(([key, element]) => !element)
        .map(([key]) => key);

    if (missingElements.length > 0) {
        console.warn('Missing dashboard elements:', missingElements);
        return; // Exit early if elements are missing
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Calculate upcoming performances
    const upcomingPerformances = performances.filter(perf => 
        perf.date >= today && perf.status === 'confirmed'
    );
    
    // Calculate completed performances and their earnings
    const completedPerformances = performances.filter(perf => {
        const perfDateTime = new Date(`${perf.date} ${perf.end_time}`);
        return perfDateTime < now && perf.status === 'confirmed';
    });
    
    const totalEarnings = completedPerformances.reduce((sum, perf) => {
        const duration = calculateDuration(perf.start_time, perf.end_time);
        return sum + (duration * perf.booking_rate);
    }, 0);
    
    // Calculate average rating
    let averageRating = '--';
    if (ratings && ratings.length > 0) {
        const totalRating = ratings.reduce((sum, rating) => sum + rating.overall_rating, 0);
        averageRating = (totalRating / ratings.length).toFixed(1);
    }

    // Calculate performance stats for this month
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthPerformances = completedPerformances.filter(perf => {
        const perfDate = new Date(perf.date);
        return perfDate.getMonth() === currentMonth && 
               perfDate.getFullYear() === currentYear;
    });

    const thisMonthEarnings = thisMonthPerformances.reduce((sum, perf) => {
        const duration = calculateDuration(perf.start_time, perf.end_time);
        return sum + (duration * perf.booking_rate);
    }, 0);

    // Get most frequent venue
    const venueFrequency = completedPerformances.reduce((acc, perf) => {
        const venueName = perf.venues?.venue_name || 'Unknown';
        acc[venueName] = (acc[venueName] || 0) + 1;
        return acc;
    }, {});

    const topVenue = Object.entries(venueFrequency)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || '--';

    // Update UI elements with null checks
    elements.upcomingGigs.textContent = upcomingPerformances.length;
    elements.averageRating.textContent = averageRating;
    elements.totalEarnings.textContent = `£${totalEarnings.toFixed(2)}`;
    elements.monthlyEarnings.textContent = `£${thisMonthEarnings.toFixed(2)}`;
    elements.completedGigs.textContent = completedPerformances.length;
    elements.topVenue.textContent = topVenue;
    elements.monthlyGigs.textContent = thisMonthPerformances.length;
}

function updatePerformanceTrend(performances) {
    const ctx = document.getElementById('performanceTrendChart');
    if (!ctx) {
        console.warn('Performance trend chart canvas not found');
        return;
    }

    // Destroy existing chart instance if it exists
    if (performanceTrendChartInstance) {
        performanceTrendChartInstance.destroy();
        performanceTrendChartInstance = null;
    }

    const now = new Date();
    const last6Months = Array.from({length: 6}, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return d.toLocaleString('default', { month: 'short' });
    }).reverse();

    const performanceCounts = last6Months.map(month => {
        return performances.filter(perf => {
            const perfDate = new Date(perf.date);
            return perfDate.toLocaleString('default', { month: 'short' }) === month &&
                   perf.status === 'confirmed';
        }).length;
    });

    // Create new chart instance and store it
    performanceTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last6Months,
            datasets: [{
                label: 'Performances',
                data: performanceCounts,
                borderColor: '#8B5CF6',
                tension: 0.1,
                fill: true,
                backgroundColor: 'rgba(139, 92, 246, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
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
                            perf.status === 'pending' ? 'bg-yellow-700/20 text-yellow-700' :
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

// Performance Management Functions
async function loadPerformances() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get all performances for this performer
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
            .order('date');

        if (error) throw error;

        // Split performances into categories
        const upcoming = performances?.filter(p => p.date >= today && p.status === 'confirmed') || [];
        const pending = performances?.filter(p => p.date >= today && p.status === 'pending') || [];
        const rejected = performances?.filter(p => p.date >= today && p.status === 'rejected') || [];
        const past = performances?.filter(p => p.date < today) || [];

        // Update the badge with pending count
        updatePendingBadge(pending.length);

        // Update all performance sections
        updatePerformancesUI(upcoming, pending, rejected, past);

    } catch (error) {
        console.error('Error loading performances:', error);
        showToast('Error loading performances', 'error');
    }
}

function updatePerformancesUI(upcoming, pending, rejected, past) {
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
        pendingList.innerHTML = pending.map(perf => performancePendingTemplate(perf)).join('');
    } else {
        pendingList.innerHTML = '<p class="text-center text-gray-400">No pending requests</p>';
    }

    // Update Rejected Performances
    const rejectedList = document.getElementById('rejectedPerformancesList');
    if (rejected.length > 0) {
        rejectedList.innerHTML = rejected.map(perf => performanceRejectedTemplate(perf)).join('');
    } else {
        rejectedList.innerHTML = '<p class="text-center text-gray-400">No rejected performances</p>';
    }

    // Update Past Performances
    const pastList = document.getElementById('pastPerformancesList');
    if (past.length > 0) {
        pastList.innerHTML = past
            .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date, most recent first
            .map(perf => `
                <div class="border-l-4 border-gray-500 pl-4">
                    <div>
                        <h3 class="font-medium text-black">${perf.venues?.venue_name || 'Unknown Venue'}</h3>
                        <p class="text-black">${formatDate(perf.date)}</p>
                        <p class="text-black">${formatTime(perf.start_time)} - ${formatTime(perf.end_time)}</p>
                        <div class="flex space-x-2 text-sm text-gray-400">
                            <p>Rate: £${perf.booking_rate}/hr</p>
                            <span>•</span>
                            <p>Total: £${calculatePerformanceTotal(perf)}</p>
                            <span>•</span>
                            <p>Status: ${perf.status.charAt(0).toUpperCase() + perf.status.slice(1)}</p>
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
            `)
            .join('');
    } else {
        pastList.innerHTML = '<p class="text-center text-gray-400">No past performances</p>';
    }
}

function performancePendingTemplate(perf) {
    return `
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
                <div class="flex flex-col space-y-2">
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
    `;
}

function performanceRejectedTemplate(perf) {
    return `
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
    `;
}

function calculatePerformanceTotal(performance) {
    const duration = calculateDuration(performance.start_time, performance.end_time);
    return (duration * performance.booking_rate).toFixed(2);
}

// Availability Management Functions
async function loadAvailability() {
    console.log('Loading availability...');
    try {
        const { data: availability, error } = await supabase
            .from('performer_availability')
            .select('*')
            .eq('performer_id', window.user.id)
            .gte('date', new Date().toISOString().split('T')[0])
            .order('date');

        if (error) {
            console.error('Availability error:', error);
            throw error;
        }

        console.log('Availability data:', availability);
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

// Settings Functions
async function loadSettings() {
    try {
        const { data: performer, error } = await supabase
            .from('performers')
            .select('*')
            .eq('id', window.user.id)
            .single();

        if (error) throw error;

        // Populate form fields
        document.getElementById('settingsFirstName').value = performer.first_name;
        document.getElementById('settingsLastName').value = performer.last_name;
        document.getElementById('settingsStageName').value = performer.stage_name;
        document.getElementById('settingsEmail').value = performer.email;
        document.getElementById('settingsPerformanceType').value = performer.performance_type;

    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Error loading settings. Please try again.', 'error');
    }
}

async function updateSettings(formData) {
    try {
        const { error } = await supabase
            .from('performers')
            .update({
                first_name: formData.firstName,
                last_name: formData.lastName,
                stage_name: formData.stageName,
                email: formData.email,
                performance_type: formData.performanceType
            })
            .eq('id', window.user.id);

        if (error) throw error;

        // Update session storage with new data
        const user = JSON.parse(sessionStorage.getItem('user'));
        user.first_name = formData.firstName;
        user.stage_name = formData.stageName;
        sessionStorage.setItem('user', JSON.stringify(user));

        // Update UI elements
        document.getElementById('performerName').textContent = formData.stageName;

        showToast('Settings updated successfully');
    } catch (error) {
        console.error('Error updating settings:', error);
        showToast('Error updating settings. Please try again.', 'error');
    }
}

// Add settings form handler to your DOMContentLoaded event listener
document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        firstName: document.getElementById('settingsFirstName').value,
        lastName: document.getElementById('settingsLastName').value,
        stageName: document.getElementById('settingsStageName').value,
        email: document.getElementById('settingsEmail').value,
        performanceType: document.getElementById('settingsPerformanceType').value
    };

    await updateSettings(formData);
});

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

// Add these two functions to the window object
window.openConfirmationModal = function(id) {
    availabilityToDelete = id;
    document.getElementById('confirmationModal').classList.remove('hidden');
};

window.closeConfirmationModal = function() {
    availabilityToDelete = null;
    document.getElementById('confirmationModal').classList.add('hidden');
};

// Availability Delete Functions
window.deleteAvailability = async function(id) {
    openConfirmationModal(id);
};

// Form Handlers
document.getElementById('availabilityForm')?.addEventListener('submit', async (e) => {
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

// Confirmation Modal Handler for Availability
document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
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

// Reports Functions
async function loadReportsData() {
    try {
        // Destroy existing charts first
        destroyCharts();

        const period = document.getElementById('reportPeriod')?.value || '30';
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

        const stats = processReportsData(performances, parseInt(period));
        updateReportsSummary(stats);
        createEarningsChart(stats.periodData);
        createTimesChart(stats.timeStats);
        createVenueAnalysis(stats.venueStats);
        updatePerformanceHistoryTable(performances, parseInt(period));

    } catch (error) {
        console.error('Error loading reports data:', error);
        showToast('Error loading reports data', 'error');
    }
}

function calculatePeriodMetrics(performances) {
    if (!performances.length) return {
        totalEarnings: 0,
        averageRate: 0,
        averageDuration: 0
    };

    const totalEarnings = performances.reduce((sum, perf) => {
        const duration = calculateDuration(perf.start_time, perf.end_time);
        return sum + (duration * perf.booking_rate);
    }, 0);

    const totalDuration = performances.reduce((sum, perf) => {
        return sum + calculateDuration(perf.start_time, perf.end_time);
    }, 0);

    const averageRate = performances.reduce((sum, perf) => sum + perf.booking_rate, 0) / performances.length;

    return {
        totalEarnings,
        averageRate,
        averageDuration: totalDuration / performances.length
    };
}

function processTimeStats(performances) {
    return performances.reduce((acc, perf) => {
        const hour = parseInt(perf.start_time.split(':')[0]);
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
    }, {});
}

function processPeriodData(performances, periodDays) {
    const data = [];
    const now = new Date();
    let currentDate = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));

    while (currentDate <= now) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayPerformances = performances.filter(perf => perf.date === dateStr);
        
        const dailyEarnings = dayPerformances.reduce((sum, perf) => {
            const duration = calculateDuration(perf.start_time, perf.end_time);
            return sum + (duration * perf.booking_rate);
        }, 0);

        data.push({
            date: dateStr,
            earnings: dailyEarnings,
            performances: dayPerformances.length
        });

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return data;
}

function createEarningsChart(data) {
    const ctx = document.getElementById('earningsChart');
    if (!ctx) {
        console.warn('Earnings chart canvas not found');
        return;
    }
    
    
    if (earningsChartInstance) {
        earningsChartInstance.destroy();
    }

    earningsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => formatDate(d.date)),
            datasets: [{
                label: 'Daily Earnings',
                data: data.map(d => d.earnings),
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `£${value}`
                    }
                }
            }
        }
    });
}

// Modify the createVenueAnalysis function:
function createVenueAnalysis(venueStats) {
    const venueStatsContainer = document.getElementById('venueStats');
    const ctx = document.getElementById('venueChart');
    
    // Add check for null elements
    if (!venueStatsContainer || !ctx) {
        console.warn('Venue analysis elements not found');
        return;
    }

    // First destroy existing chart
    if (venueChartInstance) {
        venueChartInstance.destroy();
        venueChartInstance = null;
    }

    const sortedVenues = Object.entries(venueStats)
        .sort(([,a], [,b]) => b.earnings - a.earnings);

    // Create venue statistics HTML
    venueStatsContainer.innerHTML = sortedVenues.map(([venue, stats]) => `
        <div class="flex justify-between items-center p-4 border-b border-black/10">
            <div>
                <h3 class="font-medium text-black">${venue}</h3>
                <p class="text-sm text-gray-500">${stats.performances} performances</p>
            </div>
            <div class="text-right">
                <p class="font-medium text-black">£${stats.earnings.toFixed(2)}</p>
                <p class="text-sm text-gray-500">£${stats.averageRate.toFixed(2)}/hr avg</p>
            </div>
        </div>
    `).join('');

    // Create venue chart
    venueChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedVenues.map(([venue]) => venue),
            datasets: [{
                data: sortedVenues.map(([,stats]) => stats.earnings),
                backgroundColor: [
                    '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
                    '#6366F1', '#EC4899', '#14B8A6', '#F97316'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Event Listeners
document.getElementById('reportPeriod').addEventListener('change', loadReportsData);

document.getElementById('exportHistory').addEventListener('click', async () => {
    try {
        const { data: performances } = await supabase
            .from('performances')
            .select('*')
            .eq('performer_id', window.user.id);

        const csvContent = generateCSV(performances);
        downloadCSV(csvContent, 'performance_history.csv');
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Error exporting data', 'error');
    }
});

function generateCSV(performances) {
    const headers = ['Date', 'Venue', 'Start Time', 'End Time', 'Rate', 'Duration', 'Total', 'Status'];
    const rows = performances.map(perf => {
        const duration = calculateDuration(perf.start_time, perf.end_time);
        const total = duration * perf.booking_rate;
        return [
            perf.date,
            perf.venues?.venue_name || 'Unknown',
            perf.start_time,
            perf.end_time,
            `£${perf.booking_rate}`,
            `${duration} hours`,
            `£${total.toFixed(2)}`,
            perf.status
        ];
    });

    return [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
}

function processReportsData(performances, periodDays) {
    const now = new Date();
    const periodStart = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));
    const previousPeriodStart = new Date(periodStart.getTime() - (periodDays * 24 * 60 * 60 * 1000));

    // Filter performances for current and previous periods
    const currentPeriodPerfs = performances.filter(perf => {
        const perfDate = new Date(perf.date);
        return perfDate >= periodStart && perfDate <= now && perf.status === 'confirmed';
    });

    const previousPeriodPerfs = performances.filter(perf => {
        const perfDate = new Date(perf.date);
        return perfDate >= previousPeriodStart && perfDate < periodStart && perf.status === 'confirmed';
    });

    // Calculate metrics for current period
    const currentMetrics = calculatePeriodMetrics(currentPeriodPerfs);
    const previousMetrics = calculatePeriodMetrics(previousPeriodPerfs);

    // Calculate changes
    const changes = {
        earnings: calculatePercentageChange(previousMetrics.totalEarnings, currentMetrics.totalEarnings),
        performances: calculatePercentageChange(previousPeriodPerfs.length, currentPeriodPerfs.length),
        rate: calculatePercentageChange(previousMetrics.averageRate, currentMetrics.averageRate),
        duration: calculatePercentageChange(previousMetrics.averageDuration, currentMetrics.averageDuration)
    };

    // Process venue statistics
    const venueStats = performances.reduce((acc, perf) => {
        if (perf.status !== 'confirmed') return acc;
        
        const venueName = perf.venues?.venue_name || 'Unknown';
        if (!acc[venueName]) {
            acc[venueName] = {
                performances: 0,
                earnings: 0,
                averageRate: 0,
                totalDuration: 0
            };
        }

        const duration = calculateDuration(perf.start_time, perf.end_time);
        const earnings = duration * perf.booking_rate;

        acc[venueName].performances++;
        acc[venueName].earnings += earnings;
        acc[venueName].totalDuration += duration;
        acc[venueName].averageRate = acc[venueName].earnings / acc[venueName].totalDuration;

        return acc;
    }, {});

    return {
        currentMetrics,
        previousMetrics,
        changes,
        venueStats,
        timeStats: processTimeStats(currentPeriodPerfs),
        periodData: processPeriodData(currentPeriodPerfs, periodDays)
    };
}

function createTimesChart(timeStats) {
    const ctx = document.getElementById('timesChart');
    if (!ctx) {
        console.warn('Times chart canvas not found');
        return;
    }

    if (timesChartInstance) {
        timesChartInstance.destroy();
    }

    const hours = Object.keys(timeStats).sort();
    const counts = hours.map(hour => timeStats[hour]);

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


// Performer Ratings
async function loadPerformerRatings(performanceId) {
    // Only load if performance is finished
    const { data: performance } = await supabase
        .from('performances')
        .select('*')
        .eq('id', performanceId)
        .single();

    if (new Date() < new Date(`${performance.date} ${performance.end_time}`)) {
        return { message: 'Ratings will be available after the performance' };
    }

    const { data: ratings } = await supabase
        .from('ratings')
        .select('*')
        .eq('performance_id', performanceId);

    return calculateRatingStats(ratings);
}

function updatePerformanceHistoryTable(performances) {
    const tableBody = document.getElementById('performanceHistoryTable');
    
    const sortedPerformances = [...performances].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    tableBody.innerHTML = sortedPerformances.map(perf => {
        const duration = calculateDuration(perf.start_time, perf.end_time);
        const totalCost = duration * perf.booking_rate;
        
        const statusColors = {
            confirmed: 'bg-green-500/20 text-green-400',
            pending: 'bg-yellow-700/20 text-yellow-700',
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

// Performance Notification Badge
function updatePendingBadge(pendingCount) {
    const badge = document.getElementById('pendingBadge');
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// Performance Cancellation Functions
window.cancelPerformance = function(performanceId) {
    performanceToCancel = performanceId;
    document.getElementById('cancelPerformanceModal').classList.remove('hidden');
};

window.closeCancelPerformanceModal = function() {
    performanceToCancel = null;
    document.getElementById('cancelPerformanceModal').classList.add('hidden');
};

async function refreshPerformanceData() {
    await Promise.all([
        loadPerformances(),
        loadAvailability()
    ]);
}

// Data Refresh Functions
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

// Performance cancellation handler
document.getElementById('confirmCancelBtn').addEventListener('click', async () => {
    if (!performanceToCancel) return;
    
    try {
        const { data: performances, error: fetchError } = await supabase
            .from('performances')
            .select('*')
            .eq('id', performanceToCancel);

        if (fetchError) throw fetchError;
        
        if (!performances || performances.length === 0) {
            throw new Error('Performance not found');
        }

        const performance = performances[0];

        const { error: deleteError } = await supabase
            .from('performances')
            .delete()
            .eq('id', performanceToCancel)
            .eq('performer_id', window.user.id);

        if (deleteError) throw deleteError;

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

        await refreshPerformanceData();
        showToast('Performance cancelled successfully');
        closeCancelPerformanceModal();
    } catch (error) {
        console.error('Error cancelling performance:', error);
        showToast('Error cancelling performance', 'error');
        closeCancelPerformanceModal();
    }
});

// Update the navigation handlers in the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Get the stored tab or use 'dashboard' as the default
        const storedTab = getActiveTab();
        setActiveTab(storedTab);

        // Set performer name in the UI
        const performerNameElement = document.getElementById('performerName');
        if (performerNameElement) {
            performerNameElement.textContent = window.user?.stage_name || 'Performer Dashboard';
        } else {
            console.warn('Performer name element not found');
        }

        // Hide all tab contents and show the stored tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        const storedTabContent = document.getElementById(`${storedTab}-tab`);
        if (storedTabContent) {
            storedTabContent.classList.remove('hidden');
        } else {
            console.warn(`Stored tab content for ID "${storedTab}-tab" not found`);
        }

        // Load data for the selected tab
        loadTabData(storedTab);

        const reportsTab = document.querySelector('[data-tab="reports"]');
        if (reportsTab) {
            reportsTab.addEventListener('click', function() {
                setTimeout(() => {
                    destroyCharts();
                    loadReportsData();
                }, 100);
            });
        }
    
    // Also add this period change listener
    document.getElementById('reportPeriod')?.addEventListener('change', loadReportsData);

        // Add click event listeners to all navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.getAttribute('data-tab');
                if (tabId) {
                    saveActiveTab(tabId);
                    setActiveTab(tabId);
                    loadTabData(tabId);
                } else {
                    console.warn('Navigation link is missing a "data-tab" attribute');
                }
            });
        });

        // Set up auto-refresh for active tab data every minute
        setInterval(() => {
            const activeTab = getActiveTab();
            loadTabData(activeTab);
        }, 60000); // Refresh every 60 seconds

        // Initialize dashboard
        initializeDashboard();
    } catch (error) {
        console.error('Error initializing DOMContentLoaded:', error);
        showToast('Error initializing page. Please try reloading.', 'error');
    }
});

// Add these additional helper functions:
function calculatePercentageChange(previous, current) {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
}

function updateReportsSummary(stats) {
    document.getElementById('periodEarnings').textContent = `£${stats.currentMetrics.totalEarnings.toFixed(2)}`;
    document.getElementById('periodPerformances').textContent = stats.currentMetrics.performances;
    document.getElementById('averageRate').textContent = `£${stats.currentMetrics.averageRate.toFixed(2)}`;
    document.getElementById('averageDuration').textContent = `${stats.currentMetrics.averageDuration.toFixed(1)}`;

    updateChangeIndicator('earningsChange', stats.changes.earnings);
    updateChangeIndicator('performancesChange', stats.changes.performances);
    updateChangeIndicator('rateChange', stats.changes.rate);
    updateChangeIndicator('durationChange', stats.changes.duration);
}

function updateChangeIndicator(elementId, change) {
    const element = document.getElementById(elementId);
    const formattedChange = Math.abs(change).toFixed(1);
    const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
    const color = change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-gray-500';
    
    element.className = `${color} font-medium`;
    element.textContent = `${arrow} ${formattedChange}%`;
}

/**
 * Loads data for the given tab ID.
 * @param {string} tabId - The ID of the tab to load data for.
 */

function loadTabData(tabId) {
    switch (tabId) {
        case 'reports':
            loadReportsData();
            break;
        case 'availability':
            loadAvailability();
            break;
        case 'performances':
            loadPerformances();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'dashboard':
        default:
            loadDashboardData();
            break;
    }
}