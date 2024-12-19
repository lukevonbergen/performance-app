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

    async loadTodaysPerformances() {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        
        const { data: performances } = await supabase
            .from('performances')
            .select(`
                *,
                performers (stage_name)
            `)
            .eq('venue_id', this.venueId)
            .gte('date', sixHoursAgo.toISOString())
            .order('start_time');

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
                        `<button onclick="ratePerformance('${perf.id}')">Rate Now</button>` : 
                        ''}
                </div>
            `;
        });
    }

    async submitRating(data) {
        // Validate all required fields
        if (!this.validateRating(data)) return;

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
                    verified_at_venue: true
                });

            if (error) throw error;
            this.showThankYou();
        } catch (error) {
            console.error('Error submitting rating:', error);
            this.showError('Unable to submit rating. Please try again.');
        }
    }
}

// Initialize on page load
const ratingManager = new RatingManager();
ratingManager.initialize();