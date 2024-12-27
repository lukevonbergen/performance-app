// ./js/stripe/pricing.js
import { supabase } from '../utils/supabase.js';

const stripe = Stripe('pk_live_51QaahiDI7vvAgiemQRzk3KpxlXaPAv21XBENyPwtyPK1EudIixAyz3d7fganjK8EwhEfEmNXkaA0wyoG8cNyvufY00xsYJX2dK'); // Replace with your Stripe publishable key

// Price IDs from Stripe (replace these with your actual price IDs)
const PRICES = {
    basic: {
        monthly: 'price_1QaaqfDI7vvAgiemXZhXC3HC',
        annual: 'price_1QaaqfDI7vvAgiemr5ytkfsF'
    },
    pro: {
        monthly: 'price_1Qaar9DI7vvAgiemOaKRyGeqy',
        annual: 'price_1QaarPDI7vvAgiemDbvxc1CX'
    },
    premium: {
        monthly: 'price_1QabheDI7vvAgiemNVIe2weJ',
        annual: 'price_1QabhsDI7vvAgiem7gcxOFQM'
    }
};

// Initialize billing toggle
const billingToggle = document.getElementById('billingToggle');
billingToggle.addEventListener('change', updatePrices);

// Update prices based on billing interval
function updatePrices() {
    const isAnnual = billingToggle.checked;
    
    document.getElementById('basicPrice').textContent = isAnnual ? '£278' : '£29';
    document.getElementById('proPrice').textContent = isAnnual ? '£662' : '£69';
    document.getElementById('premiumPrice').textContent = isAnnual ? '£1430' : '£149';
    
    const interval = isAnnual ? '/year' : '/month';
    document.getElementById('basicInterval').textContent = interval;
    document.getElementById('proInterval').textContent = interval;
    document.getElementById('premiumInterval').textContent = interval;
}

// Handle subscription
window.handleSubscription = async function(plan) {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (!user) {
            window.location.href = '/login';
            return;
        }

        const isAnnual = billingToggle.checked;
        const priceId = PRICES[plan][isAnnual ? 'annual' : 'monthly'];

        // Create checkout session
        const { data: { sessionId }, error } = await supabase.functions.invoke('create-checkout-session', {
            body: { 
                priceId,
                userId: user.id,
                customerEmail: user.email
            }
        });

        if (error) throw error;

        // Redirect to Stripe Checkout
        const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
        if (stripeError) throw stripeError;

    } catch (error) {
        console.error('Error:', error);
        alert('Something went wrong. Please try again.');
    }
}

// Check URL params for success/cancel messages
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('success')) {
    alert('Thanks for subscribing! You can now access your dashboard.');
    window.location.href = '/dashboard';
} else if (urlParams.get('canceled')) {
    alert('Subscription canceled. If you have any questions, please contact support.');
}