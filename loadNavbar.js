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
