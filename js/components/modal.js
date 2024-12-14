// js/components/modal.js
export class Modal {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.setupListeners();
    }

    show() {
        this.modal.classList.remove('hidden');
        return this;
    }

    hide() {
        this.modal.classList.add('hidden');
        return this;
    }

    setContent(contentHtml) {
        const contentContainer = this.modal.querySelector('[data-modal-content]');
        if (contentContainer) {
            contentContainer.innerHTML = contentHtml;
        }
        return this;
    }

    setupListeners() {
        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // Close modal when clicking close button
        const closeButtons = this.modal.querySelectorAll('[data-modal-close]');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => this.hide());
        });
    }

    onConfirm(callback) {
        const confirmButton = this.modal.querySelector('[data-modal-confirm]');
        if (confirmButton) {
            confirmButton.addEventListener('click', callback);
        }
        return this;
    }

    onCancel(callback) {
        const cancelButton = this.modal.querySelector('[data-modal-cancel]');
        if (cancelButton) {
            cancelButton.addEventListener('click', callback);
        }
        return this;
    }
}