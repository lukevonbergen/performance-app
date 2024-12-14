/* Add this JavaScript to your existing scripts */
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const menuButton = document.querySelector('.mobile-menu-button');
    const mobileMenu = document.querySelector('.mobile-menu');

    menuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    // Mobile dropdowns
    const dropdownButtons = document.querySelectorAll('.mobile-dropdown-button');
    
    dropdownButtons.forEach(button => {
        button.addEventListener('click', () => {
            const dropdownContent = button.nextElementSibling;
            button.classList.toggle('active');
            
            if (dropdownContent.classList.contains('hidden')) {
                dropdownContent.classList.remove('hidden');
            } else {
                dropdownContent.classList.add('hidden');
            }
        });
    });
});