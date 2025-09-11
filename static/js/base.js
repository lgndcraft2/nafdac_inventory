// Mobile menu toggle functionality
function toggleMobileMenu() {
    const mobileNav = document.getElementById('mobileNav');
    const menuButton = document.querySelector('.mobile-menu-button svg');
    
    mobileNav.classList.toggle('show');
    
    // Change hamburger to X and vice versa
    if (mobileNav.classList.contains('show')) {
        menuButton.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>';
    } else {
        menuButton.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>';
    }
}

// Close mobile menu when clicking on a link
document.querySelectorAll('.mobile-nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        const mobileNav = document.getElementById('mobileNav');
        const menuButton = document.querySelector('.mobile-menu-button svg');
        
        mobileNav.classList.remove('show');
        menuButton.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>';
    });
});

// Dropdown toggle functionality
function toggleDropdown() {
    const dropdown = document.getElementById('dropdownMenu');
    const arrow = document.querySelector('.dropdown-arrow');
    
    dropdown.classList.toggle('show');
    arrow.style.transform = dropdown.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0deg)';
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const userProfile = document.querySelector('.user-profile');
    const dropdown = document.getElementById('dropdownMenu');
    const mobileNav = document.getElementById('mobileNav');
    const mobileMenuButton = document.querySelector('.mobile-menu-button');
    
    // Close user dropdown
    if (!userProfile.contains(event.target)) {
        dropdown.classList.remove('show');
        document.querySelector('.dropdown-arrow').style.transform = 'rotate(0deg)';
    }
    
    // Close mobile menu
    if (!mobileNav.contains(event.target) && !mobileMenuButton.contains(event.target)) {
        mobileNav.classList.remove('show');
        document.querySelector('.mobile-menu-button svg').innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>';
    }
});

// Handle window resize
window.addEventListener('resize', function() {
    const mobileNav = document.getElementById('mobileNav');
    const menuButton = document.querySelector('.mobile-menu-button svg');
    
    // Close mobile menu on desktop view
    if (window.innerWidth > 768) {
        mobileNav.classList.remove('show');
        menuButton.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>';
    }
});