// landing.js
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const menuButton = document.querySelector('.mobile-menu-button');
    const mobileMenu = document.querySelector('.mobile-menu');

    if (menuButton && mobileMenu) {
        menuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Mobile dropdowns
    const dropdownButtons = document.querySelectorAll('.mobile-dropdown-button');
    
    dropdownButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', () => {
                const dropdownContent = button.nextElementSibling;
                button.classList.toggle('active');
                
                if (dropdownContent.classList.contains('hidden')) {
                    dropdownContent.classList.remove('hidden');
                } else {
                    dropdownContent.classList.add('hidden');
                }
            });
        }
    });
});