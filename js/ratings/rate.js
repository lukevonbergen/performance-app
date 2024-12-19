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
            document.getElementById('venueName').textContent = venue.name;
            document.getElementById('venueNameConfirm').textContent = venue.name;
        }
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

            container.innerHTML += `
                <div class="performance-card ${status.class} ${hasRated ? 'rated' : ''}">
                    <h3>${perf.performers.stage_name}</h3>
                    <p>${this.formatTimeSlot(perf.start_time, perf.end_time)}</p>
                    <span class="status-badge">${status.label}</span>
                    ${!hasRated && status.canRate ? 
                        `<button data-perf-id="${perf.id}" class="rate-now-btn">Rate Now</button>` : 
                        ''}
                </div>
            `;
        });
    }

    getPerformanceStatus(perf, now) {
        const start = new Date(perf.start_time);
        const end = new Date(perf.end_time);
    
        if (now < start) {
            return { label: "Upcoming", class: "bg-blue-200", canRate: false };
        } else if (now >= start && now <= end) {
            return { label: "Currently Playing", class: "bg-green-200", canRate: true };
        } else {
            return { label: "Finished", class: "bg-gray-200", canRate: true };
        }
    }

    checkIfRated(performanceId) {
        return localStorage.getItem(`rated-${performanceId}`) !== null;
    }
    

    formatTimeSlot(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
    
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return "Invalid Date";
        }
    
        const options = { hour: '2-digit', minute: '2-digit' };
        return `${start.toLocaleTimeString([], options)} - ${end.toLocaleTimeString([], options)}`;
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
    }

    showRatingForm() {
        document.getElementById('performerSelect').classList.add('hidden');
        document.getElementById('ratingForm').classList.remove('hidden');
    }

    getRatingValue(category) {
        const element = document.querySelector(`.star-rating[data-category="${category}"]`);
        return element ? element.getAttribute('data-value') : null;
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
