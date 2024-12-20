// Import and Global Setup
import { supabase } from '/js/utils/supabase.js';

class RatingManager {
    constructor() {
        this.venueId = this.getVenueIdFromUrl();
        this.deviceId = this.getOrCreateDeviceId();
        this.selectedPerformance = null;
    }

    async initialize() {
        await this.loadVenueInfo();
        await this.loadTodaysPerformances();
        this.setupEventListeners();
    }
    
    async loadVenueInfo() {
        try {
            const { data: venue, error } = await supabase
                .from('venues')
                .select('venue_name')
                .eq('id', this.venueId)
                .single();
    
            if (error) throw error;
    
            const venueNameElement = document.getElementById('venueName');
            if (venueNameElement) {
                venueNameElement.textContent = venue.venue_name;
            }
        } catch (error) {
            console.error('Error loading venue info:', error);
            const venueNameElement = document.getElementById('venueName');
            if (venueNameElement) {
                venueNameElement.textContent = 'Unknown Venue';
            }
        }
    }
    
    validateRating(data) {
        if (!document.getElementById('venueVerification').checked) {
            alert('Please confirm you are at the venue');
            return false;
        }
        if (!data.overall || !data.presence || !data.songs) {
            alert('Please provide all ratings');
            return false;
        }
        return true;
    }

    getVenueIdFromUrl() {
        const urlParts = window.location.pathname.split('/');
        return urlParts[urlParts.length - 1];
    }

    getOrCreateDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = crypto.randomUUID();
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    async loadTodaysPerformances() {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        
        try {
            const { data: performances, error } = await supabase
                .from('performances')
                .select(`
                    *,
                    performers (stage_name)
                `)
                .eq('venue_id', this.venueId)
                .order('date', { ascending: true })
                .order('start_time', { ascending: true });
    
            if (error) throw error;
    
            // Filter out performances older than 6 hours ago
            const filteredPerformances = performances.filter(perf => {
                const perfDate = new Date(perf.date);
                const perfTime = perf.start_time.split(':');
                perfDate.setHours(parseInt(perfTime[0]), parseInt(perfTime[1]), 0);
                return perfDate >= sixHoursAgo;
            });
    
            console.log('Filtered Performances:', filteredPerformances);
            this.renderPerformances(filteredPerformances);
        } catch (error) {
            console.error('Error fetching performances:', error);
            return;
        }
    }

    renderPerformances(performances) {
        const container = document.getElementById('performerList');
        const now = new Date();
    
        let html = '';
    
        // Create category sections
        const categorySections = {
            current: {
                title: 'Current Events',
                description: 'Events that are currently performing or recently finished',
                performances: []
            },
            upcoming: {
                title: 'Upcoming Events',
                description: 'Confirmed future performances',
                performances: []
            },
            expired: {
                title: 'Past Events',
                description: 'Past events that can no longer be rated',
                performances: []
            }
        };
    
        // Sort performances into categories
        performances.forEach(perf => {
            const status = this.getPerformanceStatus(perf, now);
            // Only add the performance if it has a status (not rejected)
            if (status && categorySections[status.category]) {
                categorySections[status.category].performances.push({perf, status});
            }
        });
    
        // Build HTML for each category
        Object.entries(categorySections).forEach(([key, section]) => {
            html += `
                <div class="mb-8">
                    <h3 class="text-lg font-semibold mb-2 ${
                        key === 'current' ? 'text-green-600' :
                        key === 'upcoming' ? 'text-blue-600' :
                        'text-gray-600'
                    }">${section.title}</h3>
                    <p class="text-sm text-gray-500 mb-4">${section.description}</p>
                    <div class="space-y-4">
                        ${section.performances.length === 0 ? 
                            `<p class="text-center text-gray-500 py-4">No ${key} events</p>` :
                            section.performances.map(({perf, status}) => {
                                const hasRated = this.checkIfRated(perf.id);
                                return `
                                    <div class="rounded-lg shadow-sm p-4 bg-white border border-gray-200">
                                        <div class="flex flex-col sm:flex-row justify-between">
                                            <div>
                                                <h3 class="text-lg font-semibold text-gray-900">${perf.performers.stage_name}</h3>
                                                <p class="text-sm text-gray-600 mb-1">${this.formatDate(perf.date)}</p>
                                                <p class="text-sm text-gray-600">${this.formatTimeSlot(perf.start_time, perf.end_time)}</p>
                                                <span class="inline-block px-2 py-1 mt-2 text-xs font-medium rounded-full ${
                                                    status.label === "Currently Playing" ? "bg-green-100 text-green-800" :
                                                    status.label === "Recently Finished" ? "bg-green-100 text-green-800" :
                                                    status.label === "Upcoming" ? "bg-blue-100 text-blue-800" :
                                                    "bg-gray-100 text-gray-800"
                                                }">
                                                    ${status.label}
                                                </span>
                                            </div>
                                            ${status.canRate && !hasRated ? `
                                                <button 
                                                    data-perf-id="${perf.id}" 
                                                    class="rate-now-btn bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors mt-4 sm:mt-0 whitespace-nowrap"
                                                >
                                                    Rate Now
                                                </button>
                                            ` : hasRated ? `
                                                <span class="text-sm text-gray-500 mt-4 sm:mt-0">Already Rated</span>
                                            ` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')
                        }
                    </div>
                </div>
            `;
        });
    
        // Set the inner HTML once after building all content
        container.innerHTML = html;
    }

    setupStarRatings() {
        document.querySelectorAll('.star-rating').forEach(container => {
            const category = container.dataset.category;
            container.addEventListener('click', (e) => {
                if (e.target.classList.contains('star')) {
                    const value = e.target.dataset.value;
                    this.setRating(category, value);
                }
            });
        });
    }
    
    setRating(category, value) {
        const container = document.querySelector(`.star-rating[data-category="${category}"]`);
        container.setAttribute('data-value', value);
        container.querySelectorAll('.star').forEach((star, index) => {
            star.classList.toggle('text-yellow-400', index < value);
            star.classList.toggle('text-gray-300', index >= value);
        });
    }

    getPerformanceStatus(perf, now) {
        // If the performance is rejected, it shouldn't show up in any category
        if (perf.status === 'rejected') {
            return null;
        }
    
        // Create date objects for start and end times
        const performanceDate = new Date(perf.date);
        const [startHours, startMinutes] = perf.start_time.split(':');
        const [endHours, endMinutes] = perf.end_time.split(':');
    
        const start = new Date(performanceDate);
        start.setHours(parseInt(startHours), parseInt(startMinutes), 0);
    
        const end = new Date(performanceDate);
        end.setHours(parseInt(endHours), parseInt(endMinutes), 0);
    
        const sixHoursAfterEnd = new Date(end.getTime() + (6 * 60 * 60 * 1000));
    
        // Check if the performance date is before today (excluding time)
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const perfDay = new Date(perf.date);
        perfDay.setHours(0, 0, 0, 0);
    
        // If it's a past date or it's more than 6 hours after end time
        if (perfDay < today || now > sixHoursAfterEnd) {
            return { 
                label: "Expired", 
                class: "bg-gray-100", 
                canRate: false,
                category: 'expired'
            };
        } else if (now < start) {
            return { 
                label: "Upcoming", 
                class: "bg-blue-100", 
                canRate: false,
                category: 'upcoming'
            };
        } else if (now >= start && now <= sixHoursAfterEnd) {
            return { 
                label: now <= end ? "Currently Playing" : "Recently Finished", 
                class: "bg-green-100", 
                canRate: true,
                category: 'current'
            };
        }
    }

    checkIfRated(performanceId) {
        return localStorage.getItem(`rated-${performanceId}`) !== null;
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
    
        // Reset time part for comparison
        const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const compareToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const compareTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        const compareYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    
        if (compareDate.getTime() === compareToday.getTime()) {
            return 'Today';
        } else if (compareDate.getTime() === compareTomorrow.getTime()) {
            return 'Tomorrow';
        } else if (compareDate.getTime() === compareYesterday.getTime()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-GB', { 
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }
    }
    

    formatTimeSlot(startTime, endTime) {
        // Convert time strings (e.g., "14:00:00") to readable format
        const formatTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;
            return `${hour12}:${minutes} ${ampm}`;
        };
    
        return `${formatTime(startTime)} - ${formatTime(endTime)}`;
    }
    

    setupEventListeners() {
    // Event delegation for rate buttons
        document.getElementById('performerList').addEventListener('click', (event) => {
            const rateButton = event.target.closest('.rate-now-btn');
            if (rateButton) {
                this.selectedPerformance = rateButton.dataset.perfId;
                this.showRatingForm();
            }
        });

        // Submit rating handler
        document.getElementById('submitRating').addEventListener('click', () => {
            this.submitRating({
                overall: this.getRatingValue('overall'),
                presence: this.getRatingValue('presence'),
                songs: this.getRatingValue('songs'),
                comment: document.getElementById('comments').value
            });
        });

        // Add star rating functionality
        document.querySelectorAll('.star-rating').forEach(container => {
            const stars = container.querySelectorAll('.star');
            const category = container.dataset.category;

            stars.forEach(star => {
                star.addEventListener('click', (e) => {
                    const value = parseInt(e.target.dataset.value);
                    
                    // Update visual state
                    stars.forEach(s => {
                        const starValue = parseInt(s.dataset.value);
                        if (starValue <= value) {
                            s.classList.add('text-yellow-400');
                            s.classList.remove('text-gray-300');
                        } else {
                            s.classList.remove('text-yellow-400');
                            s.classList.add('text-gray-300');
                        }
                    });

                    // Store the rating value
                    container.dataset.value = value;
                });

                // Optional: Add hover effects
                star.addEventListener('mouseenter', (e) => {
                    const value = parseInt(e.target.dataset.value);
                    stars.forEach(s => {
                        const starValue = parseInt(s.dataset.value);
                        if (starValue <= value) {
                            s.classList.add('hover:text-yellow-400');
                        }
                    });
                });

                star.addEventListener('mouseleave', (e) => {
                    const selectedValue = parseInt(container.dataset.value) || 0;
                    stars.forEach(s => {
                        const starValue = parseInt(s.dataset.value);
                        s.classList.remove('hover:text-yellow-400');
                        if (starValue <= selectedValue) {
                            s.classList.add('text-yellow-400');
                        } else {
                            s.classList.add('text-gray-300');
                        }
                    });
                });
            });
        });
    }

    showRatingForm() {
        document.getElementById('performerSelect').classList.add('hidden');
        document.getElementById('ratingForm').classList.remove('hidden');
    
        // Add back button functionality
        document.getElementById('backToList').addEventListener('click', () => {
            document.getElementById('ratingForm').classList.add('hidden');
            document.getElementById('performerSelect').classList.remove('hidden');
        });
    }

    getRatingValue(category) {
        const container = document.querySelector(`.star-rating[data-category="${category}"]`);
        return parseInt(container.dataset.value) || 0;
    }

    async submitRating(data) {
        if (!data.overall || !data.presence || !data.songs) {
            alert('Please fill in all ratings before submitting.');
            return;
        }

        try {
            const { error } = await supabase
                .from('ratings')
                .insert({
                    performance_id: this.selectedPerformance,
                    device_id: this.deviceId,
                    overall_rating: data.overall,
                    stage_presence_rating: data.presence,
                    song_selection_rating: data.songs,
                    comment: data.comment,
                    is_during_performance: this.isDuringPerformance(),
                    verified_at_venue: document.getElementById('venueVerification').checked
                });

            if (error) throw error;

            localStorage.setItem(`rated-${this.selectedPerformance}`, true);
            alert('Thank you for your rating!');
            location.reload();
        } catch (error) {
            console.error('Error submitting rating:', error);
            alert('Unable to submit rating. Please try again later.');
        }
    }

    isDuringPerformance() {
        const now = new Date();
        const start = new Date(this.selectedPerformance.start_time);
        const end = new Date(this.selectedPerformance.end_time);
        return now >= start && now <= end;
    }
}

const ratingManager = new RatingManager();
ratingManager.initialize();
