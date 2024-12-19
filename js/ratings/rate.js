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
        const { data: venue, error } = await supabase
            .from('venues')
            .select('venue_name')
            .eq('id', this.venueId)
            .single();
    
        if (error || !venue) {
            document.getElementById('venueName').textContent = "Unknown Venue";
            document.getElementById('venueNameConfirm').textContent = "Unknown Venue";
        } else {
            document.getElementById('venueName').textContent = venue.venue_name; // Changed from venue.name
            document.getElementById('venueNameConfirm').textContent = venue.venue_name;
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

        const { data: performances, error } = await supabase
            .from('performances')
            .select(`*, performers (stage_name)`)
            .eq('venue_id', this.venueId)
            .gte('date', sixHoursAgo.toISOString())
            .order('start_time');

        if (error) {
            console.error('Error fetching performances:', error);
            return;
        }

        this.renderPerformances(performances);
    }

    renderPerformances(performances) {
        const container = document.getElementById('performerList');
        const now = new Date();
    
        performances.forEach(perf => {
            const status = this.getPerformanceStatus(perf, now);
            const hasRated = this.checkIfRated(perf.id);
    
            const performanceCard = document.createElement('div');
            performanceCard.className = 'rounded-lg shadow-sm p-4 mb-4 bg-white';
            performanceCard.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900">${perf.performers.stage_name}</h3>
                        <p class="text-sm text-gray-600">${this.formatTimeSlot(perf.start_time, perf.end_time)}</p>
                        <span class="inline-block px-2 py-1 mt-2 text-xs font-medium rounded-full ${
                            status.label === "Currently Playing" ? "bg-green-100 text-green-800" :
                            status.label === "Upcoming" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-800"
                        }">
                            ${status.label}
                        </span>
                    </div>
                    <button 
                        data-perf-id="${perf.id}" 
                        class="rate-now-btn bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors ${
                            hasRated ? 'opacity-50 cursor-not-allowed' : ''
                        }"
                        ${hasRated ? 'disabled' : ''}
                    >
                        ${hasRated ? 'Already Rated' : 'Rate Performance'}
                    </button>
                </div>
            `;
    
            container.appendChild(performanceCard);
        });
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
        const performanceDate = new Date(perf.date);
        const start = new Date(performanceDate.setHours(
            ...perf.start_time.split(':').map(Number)
        ));
        const end = new Date(performanceDate.setHours(
            ...perf.end_time.split(':').map(Number)
        ));
    
        if (now < start) {
            return { label: "Upcoming", class: "bg-blue-100", canRate: false };
        } else if (now >= start && now <= end) {
            return { label: "Currently Playing", class: "bg-green-100", canRate: true };
        } else {
            return { label: "Finished", class: "bg-gray-100", canRate: true };
        }
    }

    checkIfRated(performanceId) {
        return localStorage.getItem(`rated-${performanceId}`) !== null;
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
        document.getElementById('performerList').addEventListener('click', (event) => {
            if (event.target.classList.contains('rate-now-btn')) {
                this.selectedPerformance = event.target.getAttribute('data-perf-id');
                this.showRatingForm();
            }
        });

        document.getElementById('submitRating').addEventListener('click', () => {
            this.submitRating({
                overall: this.getRatingValue('overall'),
                presence: this.getRatingValue('presence'),
                songs: this.getRatingValue('songs'),
                comment: document.getElementById('comments').value,
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
