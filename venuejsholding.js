
function getActiveTab() {
    return localStorage.getItem('activeTab') || 'dashboard'; // Default to dashboard if no tab is stored
}


// Your existing utility functions remain the same
// [Keep all your existing functions like formatTime, calculateTotalCost, etc.]

// Update the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // Get the stored tab or use dashboard as default
    const storedTab = getActiveTab();
    setActiveTab(storedTab);
    
    // Initialize UI elements
    document.getElementById('venueName').textContent = window.user.venue_name;
    document.getElementById('welcomeMessage').textContent = `Welcome back, ${window.user.first_name}`;
    if (document.getElementById('searchDate')) {
        document.getElementById('searchDate').min = new Date().toISOString().split('T')[0];
    }

    // Show the stored tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${storedTab}-tab`).classList.remove('hidden');

    // Load data based on which tab is selected
    switch(storedTab) {
        case 'reports':
            loadReportsData();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'dashboard':
        default:
            loadDashboardData();
            break;
    }

    // Navigation handlers
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.getAttribute('data-tab');
            saveActiveTab(tabId);
            setActiveTab(tabId);

            // Load data based on which tab is selected
            switch(tabId) {
                case 'reports':
                    loadReportsData();
                    break;
                case 'settings':
                    loadSettings();
                    break;
                case 'dashboard':
                    loadDashboardData();
                    break;
            }

            // Handle mobile menu if needed
            if (window.innerWidth < 1024) {
                document.getElementById('sidebar')?.classList.add('-translate-x-full');
            }
        });
    });

    // Form handlers
    document.getElementById('searchForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('searchDate').value;
        const startTime = document.getElementById('searchStartTime').value;
        await searchPerformers(date, startTime);
    });

    // Settings form handler
    document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            firstName: document.getElementById('settingsFirstName').value,
            lastName: document.getElementById('settingsLastName').value,
            venueName: document.getElementById('settingsVenueName').value,
            email: document.getElementById('settingsEmail').value,
            addressLine1: document.getElementById('settingsAddressLine1').value,
            addressLine2: document.getElementById('settingsAddressLine2').value,
            city: document.getElementById('settingsCity').value,
            county: document.getElementById('settingsCounty').value,
            postcode: document.getElementById('settingsPostcode').value
        };

        await updateSettings(formData);
    });

    // Dropdown toggle functionality
    document.getElementById('userMenuBtn')?.addEventListener('click', function() {
        document.getElementById('userDropdown').classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('userDropdown');
        const button = document.getElementById('userMenuBtn');
        if (dropdown && button && !button.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    });

    // Set up auto-refresh interval for active data
    setInterval(() => {
        const activeTab = getActiveTab();
        switch(activeTab) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'reports':
                loadReportsData();
                break;
            case 'settings':
                // Settings don't need regular refresh
                break;
        }
    }, 60000); // Refresh every minute

    // Initial data load
    loadDashboardData();
});