// js/booking/create-booking.js
export async function createBooking(bookingData) {
    const { data, error } = await supabase
        .from('performances')
        .insert([{
            ...bookingData,
            status: 'pending'
        }]);

    if (error) throw error;
    return data;
}

// js/components/modal.js
export class Modal {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.setupListeners();
    }

    setupListeners() {
        // Close on background click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
    }

    open() {
        this.modal.classList.remove('hidden');
    }

    close() {
        this.modal.classList.add('hidden');
    }

    setContent(content) {
        const contentDiv = this.modal.querySelector('.modal-content');
        if (contentDiv) contentDiv.innerHTML = content;
    }
}

