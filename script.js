document.addEventListener("DOMContentLoaded", function () {
  // Auto-fill the current date
document.getElementById("currentDate").textContent = new Date().toLocaleDateString();

function generatePDF() {
    const element = document.getElementById('prescription');
    html2pdf().from(element).save('Lens_Prescription.pdf')
        .catch((error) => console.error("PDF generation failed:", error));
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(() => console.log("Service Worker Registered"))
        .catch((error) => console.log("Service Worker Registration Failed", error));
}

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

function showInstallButton() {
    const installButton = document.createElement('button');
    installButton.textContent = 'Install App';
    installButton.style.position = 'fixed';
    installButton.style.bottom = '20px';
    installButton.style.right = '20px';
    installButton.style.padding = '10px 20px';
    installButton.style.backgroundColor = '#007bff';
    installButton.style.color = '#fff';
    installButton.style.border = 'none';
    installButton.style.borderRadius = '5px';
    installButton.style.cursor = 'pointer';
    installButton.style.zIndex = '1000';
    document.body.appendChild(installButton);

    installButton.addEventListener('click', () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                deferredPrompt = null;
                installButton.remove(); // Remove the button after prompting
            });
        }
    });

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton(); // Show the custom install button
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
    document.getElementById("previewDate").textContent = new Date().toLocaleDateString();
    document.getElementById("previewRightSPH").textContent = rightSPH;
    document.getElementById("previewRightCYL").textContent = rightCYL;
    document.getElementById("previewRightAXIS").textContent = rightAXIS;
    document.getElementById("previewLeftSPH").textContent = leftSPH;
    document.getElementById("previewLeftCYL").textContent = leftCYL;
    document.getElementById("previewLeftAXIS").textContent = leftAXIS;
    document.getElementById("previewLensType").textContent = lensType.join(", ") || "None";
    document.getElementById("previewAmount").textContent = amount.toFixed(2);

    // Show Prescription Preview
    document.getElementById("prescriptionPreview").style.display = "block";

    // Enable Print Button
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
