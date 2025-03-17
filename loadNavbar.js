// loadNavbar.js

// Function to load the navbar
function loadNavbar() {
    fetch('navbar.html')
        .then(response => response.text())
        .then(data => {
            // Insert the navbar HTML into the <header> element
            document.querySelector('header').innerHTML = data;

            // After navbar is loaded, highlight the active link and insert the footer
            highlightActiveLink();
            insertFooter();
        })
        .catch(error => console.error('Error loading navbar:', error));
}

// Function to highlight the active link
function highlightActiveLink() {
    const currentUrl = window.location.href;
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.href === currentUrl) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Function to insert the footer inside the offcanvas body
function insertFooter() {
    const footerHTML = `
        <div style="
            text-align: center; 
            margin-top: 240px; 
            font-size: 12px;
            font-weight: bolder;
            color: black; 
            background-color: white; 
            padding: 15px; 
            position: relative;
            bottom: 0;
            width: 100%;">
            @2025 Lens-Prescription-App developed by <strong>MANITEJA (MNR DEVELOPERS)</strong>
        </div>
    `;
    const offcanvasBody = document.querySelector('.offcanvas-body');
    if (offcanvasBody) {
        offcanvasBody.insertAdjacentHTML('beforeend', footerHTML);
    }
}

// Call the function to load the navbar when the page loads
document.addEventListener('DOMContentLoaded', loadNavbar);
