// ./js/auth/login.js

import { supabase } from '../utils/supabase.js';

export class VenueSignup {
    constructor() {
        this.form = document.getElementById('signupForm');
        this.step1 = document.getElementById('step1');
        this.step2 = document.getElementById('step2');
        this.step1Indicator = document.getElementById('step1-indicator');
        this.step2Indicator = document.getElementById('step2-indicator');
        this.nextButton = document.getElementById('nextButton');
        this.backButton = document.getElementById('backButton');
        this.messageDiv = document.getElementById('message');

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.nextButton.addEventListener('click', () => this.handleNext());
        this.backButton.addEventListener('click', () => this.handleBack());
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    handleNext() {
        const requiredFields = ['firstName', 'lastName', 'venueName', 'email', 'password', 'passwordConfirm'];
        const allFilled = requiredFields.every(field => document.getElementById(field).value.trim() !== '');
        
        if (!allFilled) {
            this.showMessage('Please fill in all required fields', 'error');
            return;
        }

        if (document.getElementById('password').value !== document.getElementById('passwordConfirm').value) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }

        this.step1.classList.add('hidden');
        this.step2.classList.remove('hidden');
        this.step2Indicator.classList.remove('bg-gray-600');
        this.step2Indicator.classList.add('bg-indigo-500');
        this.messageDiv.textContent = '';
    }

    handleBack() {
        this.step2.classList.add('hidden');
        this.step1.classList.remove('hidden');
        this.step2Indicator.classList.remove('bg-indigo-500');
        this.step2Indicator.classList.add('bg-gray-600');
        this.messageDiv.textContent = '';
    }

    showMessage(text, type = 'default') {
        this.messageDiv.textContent = text;
        this.messageDiv.className = `mt-4 text-center ${
            type === 'error' ? 'text-red-400' : 
            type === 'success' ? 'text-green-400' : 
            'text-white'
        }`;
    }

    async handleSubmit(e) {
        e.preventDefault();
        this.messageDiv.className = 'mt-4 text-center text-white';

        try {
            const email = document.getElementById('email').value;
            
            const { data: existingVenue, error: checkError } = await supabase
                .from('venues')
                .select('email')
                .eq('email', email);
                
            if (checkError) throw checkError;
            
            if (existingVenue?.length > 0) {
                this.showMessage('It looks like you are already a user, please login.', 'error');
                return;
            }

            const userData = {
                first_name: document.getElementById('firstName').value,
                last_name: document.getElementById('lastName').value,
                venue_name: document.getElementById('venueName').value,
                email: email,
                password: document.getElementById('password').value,
                address_line1: document.getElementById('addressLine1').value,
                address_line2: document.getElementById('addressLine2').value || null,
                city: document.getElementById('city').value,
                county: document.getElementById('county').value || null,
                postcode: document.getElementById('postcode').value,
                created_at: new Date().toISOString()
            };
            
            const { data, error } = await supabase
                .from('venues')
                .insert([userData]);
                
            if (error) throw error;
            
            this.showMessage('Sign up successful!', 'success');
            this.form.reset();

            setTimeout(() => {
                window.location.href = 'login';
            }, 2000);
            
        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error signing up. Please try again.', 'error');
        }
    }
}