// Auto-fill the current date
document.getElementById("currentDate").textContent = new Date().toLocaleDateString();

// Function to generate a WhatsApp shareable message
function generateWhatsAppMessage() {
    const patientName = document.getElementById("previewPatientName").textContent;
    const age = document.getElementById("previewAge").textContent;
    const gender = document.getElementById("previewGender").textContent;
    const mobile = document.getElementById("previewMobile").textContent;
    const lensType = document.getElementById("previewVisionType").textContent;
    const rightSPH = document.getElementById("previewRightSPH").textContent;
    const rightCYL = document.getElementById("previewRightCYL").textContent;
    const rightAXIS = document.getElementById("previewRightAXIS").textContent;
    const leftSPH = document.getElementById("previewLeftSPH").textContent;
    const leftCYL = document.getElementById("previewLeftCYL").textContent;
    const leftAXIS = document.getElementById("previewLeftAXIS").textContent;
    const lensType = document.getElementById("previewLensType").textContent;
    const amount = document.getElementById("previewAmount").textContent;
    const date = document.getElementById("previewDate").textContent;

    // Format the message
    const message = `
        *Prescription Details:*
        ----------------------
        *Patient Name:* ${patientName}
        *Age:* ${age}
        *Gender:* ${gender}
        *Mobile:* ${mobile}
        *Date:* ${date}

        *Vision Type:* ${visionType}
        
        *Right Eye:*
        - SPH: ${rightSPH}
        - CYL: ${rightCYL}
        - AXIS: ${rightAXIS}

        *Left Eye:*
        - SPH: ${leftSPH}
        - CYL: ${leftCYL}
        - AXIS: ${leftAXIS}

        *Lens Type:* ${lensType}
        *Amount:* ₹${amount}

        Thank you for choosing us!
    `;

    // Encode the message for URL
    return encodeURIComponent(message);
}

// Function to share on WhatsApp
function shareOnWhatsApp() {
    const message = generateWhatsAppMessage();
    const mobile = document.getElementById("previewMobile").textContent;

    // Open WhatsApp with the pre-filled message
    const whatsappUrl = `https://wa.me/${mobile}?text=${message}`;
    window.open(whatsappUrl, "_blank");
}

// Enable WhatsApp Share Button after form submission
function submitForm() {
    // ... (existing form submission logic)

    // Enable the WhatsApp Share button
    document.getElementById("whatsappShareButton").disabled = false;

    // ... (rest of the code)
}

// Add event listener for the WhatsApp Share button
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("whatsappShareButton").addEventListener("click", shareOnWhatsApp);
});

// PWA Installation
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(() => console.log("Service Worker Registered"))
        .catch((error) => console.log("Service Worker Registration Failed", error));
}

// Handle PWA Install Prompt
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;

    // Show install prompt after 3 seconds
    setTimeout(() => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === "accepted") {
                    console.log("User accepted the install prompt.");
                } else {
                    console.log("User dismissed the install prompt.");
                }
                deferredPrompt = null;
            }).catch(error => console.error("Install prompt error:", error));
        }
    }, 3000);
});

// Initialize counters
let prescriptionCount = 0;
let amountEarned = 0;

// Function to update prescription count and amount earned
function updateStats() {
    document.getElementById("prescriptionCount").textContent = prescriptionCount;
    document.getElementById("amountEarned").textContent = amountEarned.toFixed(2); // Format to 2 decimal places
}

// Function to check if the day has changed
function checkDayChange() {
    const today = new Date().toLocaleDateString(); // Get current date in "MM/DD/YYYY" format
    const lastUpdatedDate = localStorage.getItem("lastUpdatedDate");

    if (lastUpdatedDate !== today) {
        // Day has changed, reset counters
        prescriptionCount = 0;
        amountEarned = 0;
        localStorage.setItem("lastUpdatedDate", today); // Update the last updated date
    } else {
        // Day has not changed, load existing counters from localStorage
        prescriptionCount = parseInt(localStorage.getItem("prescriptionCount")) || 0;
        amountEarned = parseFloat(localStorage.getItem("amountEarned")) || 0;
    }

    updateStats(); // Update the UI with the current counters
}

// Function to save counters to localStorage
function saveCounters() {
    localStorage.setItem("prescriptionCount", prescriptionCount);
    localStorage.setItem("amountEarned", amountEarned);
}

// Check for day change when the page loads
checkDayChange();

function submitForm() {
    // Get form values
    const patientName = document.getElementById("patientName").value.trim();
    const age = document.getElementById("age").value.trim();
    const gender = document.getElementById("gender").value.trim();
    const mobile = document.getElementById("patientMobile").value.trim();
    const rightSPH = document.getElementById("rightSPH").value.trim();
    const rightCYL = document.getElementById("rightCYL").value.trim();
    const rightAXIS = document.getElementById("rightAXIS").value.trim();
    const leftSPH = document.getElementById("leftSPH").value.trim();
    const leftCYL = document.getElementById("leftCYL").value.trim();
    const leftAXIS = document.getElementById("leftAXIS").value.trim();
    const amount = parseFloat(document.getElementById("amount").value);

    // Validate required fields
    if (!patientName || !age || !mobile || isNaN(amount) || amount <= 0) {
        alert("Please fill in all required fields correctly.");
        return;
    }

 // Generate vision type selection
    let visionType = [];
    if (document.getElementById("nearvision").checked) visionType.push("Near Vision");
    if (document.getElementById("rearvision").checked) visionType.push("Rear Vision");
    if (document.getElementById("both").checked) visionType.push("Both");
    
    
    // Generate lens type selection
    let lensType = [];
    if (document.getElementById("blueCut").checked) lensType.push("Blue Cut");
    if (document.getElementById("progressive").checked) lensType.push("Progressive");
    if (document.getElementById("bifocal").checked) lensType.push("Bifocal");
    if (document.getElementById("antiGlare").checked) lensType.push("Anti-Glare");

    // Update Prescription Preview
    document.getElementById("previewPatientName").textContent = patientName;
    document.getElementById("previewAge").textContent = age;
    document.getElementById("previewGender").textContent = gender;
    document.getElementById("previewMobile").textContent = mobile;
    document.getElementById("previewLensType").textContent = visionType.join(", ") || "None";
    document.getElementById("previewRightSPH").textContent = rightSPH;
    document.getElementById("previewRightCYL").textContent = rightCYL;
    document.getElementById("previewRightAXIS").textContent = rightAXIS;
    document.getElementById("previewLeftSPH").textContent = leftSPH;
    document.getElementById("previewLeftCYL").textContent = leftCYL;
    document.getElementById("previewLeftAXIS").textContent = leftAXIS;
    document.getElementById("previewLensType").textContent = lensType.join(", ") || "None";
    document.getElementById("previewAmount").textContent = amount.toFixed(2);

    // Update the date in the preview (use the auto-filled date)
    document.getElementById("previewDate").textContent = document.getElementById("currentDate").textContent;
    
    // Show Prescription Preview
    document.getElementById("prescriptionPreview").style.display = "block";

    // Enable the print button
    document.getElementById("printButton").disabled = false;

    // Increment prescription count and earnings
    prescriptionCount++;
    amountEarned += amount;
    updateStats();
    saveCounters();

    // Reset the form for the next prescription
    resetForm();
}

// Reset form fields
function resetForm() {
    document.getElementById("patientName").value = "";
    document.getElementById("age").value = "";
    document.getElementById("gender").value = "Male";
    document.getElementById("patientMobile").value = "";

    document.getElementById("nearvision").checked = false;
    document.getElementById("rearvision").checked = false;
    document.getElementById("both").checked = false;

    document.getElementById("rightSPH").value = "";
    document.getElementById("rightCYL").value = "";
    document.getElementById("rightAXIS").value = "";
    document.getElementById("leftSPH").value = "";
    document.getElementById("leftCYL").value = "";
    document.getElementById("leftAXIS").value = "";

    document.getElementById("blueCut").checked = false;
    document.getElementById("progressive").checked = false;
    document.getElementById("bifocal").checked = false;
    document.getElementById("antiGlare").checked = false;

    document.getElementById("amount").value = "";
}

function resetStats() {
    localStorage.setItem("prescriptionCount", "0");
    localStorage.setItem("amountEarned", "0");
    alert("Prescription count and amount earned have been reset.");
    location.reload(); // Reloads page to reflect changes
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("resetButton").addEventListener("click", resetStats);
});
