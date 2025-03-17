// Function to load the navbar
function loadNavbar() {
    fetch('navbar.html')
        .then(response => response.text())
        .then(data => {
            // Insert the navbar HTML into the <header> element
            document.querySelector('header').innerHTML = data;
        })
        .catch(error => console.error('Error loading navbar:', error));
}

// Call the function to load the navbar when the page loads
document.addEventListener('DOMContentLoaded', loadNavbar);

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

    // Call the function when the page loads
    document.addEventListener('DOMContentLoaded', highlightActiveLink);

    // Add footer inside the offcanvas body
    document.addEventListener("DOMContentLoaded", function () {
        const footerHTML = `
            <div style="
                text-align: center; 
                margin-top: auto; 
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
        offcanvasBody.insertAdjacentHTML('beforeend', footerHTML);
    });
