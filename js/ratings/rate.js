// Import and Global Setup
import { supabase } from '/js/utils/supabase.js';

class RatingManager {
    constructor() {
        this.venueId = this.getVenueIdFromUrl();
        this.deviceId = this.getOrCreateDeviceId();
        this.selectedPerformance = null;
    }

    async initialize() {
        await this.loadTodaysPerformances();
        this.setupEventListeners();
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

    getPerformanceStatus(performance, now) {
        const start = new Date(performance.start_time);
        const end = new Date(performance.end_time);

        if (now < start) return { label: 'Upcoming', class: 'upcoming', canRate: false };
        if (now >= start && now <= end) return { label: 'Currently Playing', class: 'playing', canRate: true };
        return { label: 'Finished', class: 'finished', canRate: true };
    }

    checkIfRated(performanceId) {
        return localStorage.getItem(`rated-${performanceId}`) !== null;
    }

    formatTimeSlot(start, end) {
        const options = { hour: '2-digit', minute: '2-digit' };
        return `${new Date(start).toLocaleTimeString([], options)} - ${new Date(end).toLocaleTimeString([], options)}`;
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
