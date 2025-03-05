// Track if the form is filled
let isFormFilled = false;

// Function to check if the form is filled
function checkFormFilled() {
    isFormFilled = document.getElementById("patientName").value.trim() !== "" ||
                   document.getElementById("age").value.trim() !== "" ||
                   document.getElementById("patientMobile").value.trim() !== "";
}

// Add event listeners to form fields to track changes
document.getElementById("patientName").addEventListener("input", checkFormFilled);
document.getElementById("age").addEventListener("input", checkFormFilled);
document.getElementById("patientMobile").addEventListener("input", checkFormFilled);

// Handle back button press in PWA
window.addEventListener("popstate", (event) => {
    if (isFormFilled) {
        // Show the custom modal
        document.getElementById("exitPromptModal").style.display = "flex";

        // Prevent the default back navigation
        history.pushState(null, document.title, location.href);
    }
});

// Handle exit confirmation
document.getElementById("confirmExit").addEventListener("click", () => {
    // Allow the user to leave
    window.history.back();
});

// Handle cancel exit
document.getElementById("cancelExit").addEventListener("click", () => {
    // Hide the modal
    document.getElementById("exitPromptModal").style.display = "none";
});

// Initialize history state
history.pushState(null, document.title, location.href);

// Handle PWA standalone mode (optional)
window.addEventListener("appinstalled", () => {
    console.log("PWA installed successfully!");
});

// Handle beforeunload event for closing the PWA
window.addEventListener("beforeunload", (event) => {
    if (isFormFilled) {
        event.preventDefault();
        event.returnValue = ""; // Required for Chrome and other modern browsers
        return ""; // Required for older browsers
    }
});


document.addEventListener("DOMContentLoaded", () => {
    // Check if splash screen was already shown in this session
    if (sessionStorage.getItem("splashShown")) {
        document.getElementById("splash-screen").style.display = "none"; // Hide splash
    } else {
        // Show splash screen for first-time app opening
        document.getElementById("splash-screen").style.display = "flex";

        setTimeout(() => {
            document.getElementById("splash-screen").classList.add("hidden");
            sessionStorage.setItem("splashShown", "true"); // Store flag in sessionStorage
        }, 3000); // Show splash for 3 seconds
    }
});

// Clear splash screen flag when the app is fully closed
window.addEventListener("beforeunload", () => {
    if (!navigator.onLine) {
        localStorage.removeItem("splashShown"); // Reset splash flag only on full close
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const darkModeToggle = document.getElementById("darkModeToggle");

    // Check if Dark Mode was enabled before
    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        darkModeToggle.checked = true;
    }

    // Toggle Dark Mode on Switch Click
    darkModeToggle.addEventListener("change", () => {
        if (darkModeToggle.checked) {
            document.body.classList.add("dark-mode");
            localStorage.setItem("darkMode", "enabled");
        } else {
            document.body.classList.remove("dark-mode");
            localStorage.setItem("darkMode", "disabled");
        }
    });
});



// Auto-fill the current date
document.getElementById("currentDate").textContent = new Date().toLocaleDateString();

function generatePDF() {
    // Ensure the preview is updated before generating the PDF
    submitForm();  // Calls the function to fill the preview

    // Wait a short time to allow the preview to update
    setTimeout(() => {
        const element = document.getElementById('prescriptionPreview');
        if (!element || element.style.display === "none") {
            alert("Please submit the form before downloading the PDF.");
            return;
        }
        
        // Generate the PDF from the preview section
        html2pdf()
            .set({
                margin: 5,
                filename: 'Lens_Prescription.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            })
            .from(element)
            .save();
    }, 500); // Small delay to ensure preview updates
}

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
    document.getElementById("install-btn").style.display = "block"; // Show the install button
});

document.getElementById("install-btn").addEventListener("click", () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === "accepted") {
                console.log("User accepted the install prompt.");
            } else {
                console.log("User dismissed the install prompt.");
            }
            deferredPrompt = null;
        });
    }
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
    const amount = document.getElementById("amount").value.trim();

    // Prescription Fields
    const rightSPH = document.getElementById("rightSPH").value.trim();
    const rightCYL = document.getElementById("rightCYL").value.trim();
    const rightAXIS = document.getElementById("rightAXIS").value.trim();
    const leftSPH = document.getElementById("leftSPH").value.trim();
    const leftCYL = document.getElementById("leftCYL").value.trim();
    const leftAXIS = document.getElementById("leftAXIS").value.trim();

    // Validation Checks
    if (!patientName) {
        alert("Patient Name is required.");
        return;
    }
    
    if (!age || isNaN(age) || age <= 0) {
        alert("Please enter a valid Age.");
        return;
    }

    if (!mobile || !/^\d{10}$/.test(mobile)) {
        alert("Please enter a valid 10-digit Mobile Number.");
        return;
    }

    if (!amount || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid Amount.");
        return;
    }

    // Validate Prescription Inputs (Allow only numbers and decimals)
    const prescriptionFields = [rightSPH, rightCYL, rightAXIS, leftSPH, leftCYL, leftAXIS];
    const validNumberPattern = /^-?\d*\.?\d*$/; // Allows numbers and decimals (e.g., -1.25, 2.00)
    
    for (let i = 0; i < prescriptionFields.length; i++) {
        if (prescriptionFields[i] && !validNumberPattern.test(prescriptionFields[i])) {
            alert("Please enter valid prescription values (numbers only).");
            return;
        }
    }

    // Generate Lens Type Selection
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
    document.getElementById("previewRightSPH").textContent = rightSPH;
    document.getElementById("previewRightCYL").textContent = rightCYL;
    document.getElementById("previewRightAXIS").textContent = rightAXIS;
    document.getElementById("previewLeftSPH").textContent = leftSPH;
    document.getElementById("previewLeftCYL").textContent = leftCYL;
    document.getElementById("previewLeftAXIS").textContent = leftAXIS;
    document.getElementById("previewLensType").textContent = lensType.join(", ") || "None";
    document.getElementById("previewAmount").textContent = parseFloat(amount).toFixed(2);

    // Update the date in the preview
    document.getElementById("previewcurrentDate").textContent = new Date().toLocaleDateString();

    // Show Prescription Preview
    document.getElementById("prescriptionPreview").style.display = "block";

    // Enable the print button
    document.getElementById("printButton").disabled = false;
    
    // Increment prescription count and earnings
    prescriptionCount++;
    amountEarned += parseFloat(amount);
    updateStats();
    saveCounters();

    // Reset the form for the next prescription
    resetForm();
}

let newRef = firebase.database().ref("prescriptions").push();
    newRef.set(patientData)
        .then(() => alert("Prescription Saved!"))
        .catch(error => alert("Error: " + error));
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

function sendWhatsApp() {
    const mobileNumber = document.getElementById("patientMobile").value.trim();

    if (!mobileNumber) {
        alert("Please enter a valid mobile number before sending.");
        return;
    }

    // Ensure the preview is updated before capturing the image
    submitForm();

    // Wait for the preview update before capturing the image
    setTimeout(() => {
        const element = document.getElementById('prescriptionPreview');

        if (!element || element.style.display === "none") {
            alert("Please submit the form before sending via WhatsApp.");
            return;
        }

        // Convert the prescription preview to an image
        html2canvas(element, { scale: 2 }).then(canvas => {
            const imageData = canvas.toDataURL("image/png"); // Convert to base64

            // Upload the image to ImgBB
            uploadImageToImgBB(imageData, mobileNumber);
        });
    }, 500);
}

// Function to upload image to ImgBB and send via WhatsApp
function uploadImageToImgBB(base64Image, mobileNumber) {
    const apiKey = "bbfde58b1da5fc9ee9d7d6a591852f71"; // Your ImgBB API Key
    const formData = new FormData();
    formData.append("image", base64Image.split(',')[1]); // Remove 'data:image/png;base64,'

    fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const imageURL = data.data.url; // Get the uploaded image URL
            const message = "Here is your digital prescription from Lens Prescription App: " + imageURL;
            const whatsappURL = `https://wa.me/${mobileNumber}?text=${encodeURIComponent(message)}`;

            // Open WhatsApp with the image URL
            window.open(whatsappURL, "_blank");
        } else {
            alert("Image upload failed. Please try again.");
        }
    })
    .catch(error => {
        console.error("Image upload error:", error);
        alert("Error uploading image. Please check your internet connection.");
    });
}

document.getElementById("age").addEventListener("input", function () {
    this.value = this.value.replace(/[^0-9]/g, ""); // Only allow numbers
});

const prescriptionInputs = ["rightSPH", "rightCYL", "rightAXIS", "leftSPH", "leftCYL", "leftAXIS"];
prescriptionInputs.forEach(id => {
    document.getElementById(id).addEventListener("input", function () {
        this.value = this.value.replace(/[^0-9.-]/g, ""); // Allow numbers, decimals, and negative values
    });
});

function loadPrescriptions() {
    firebase.database().ref("prescriptions").once("value", (snapshot) => {
        let data = snapshot.val();
        let table = document.getElementById("prescriptionsTable");

        table.innerHTML = "<tr><th>Name</th><th>Age</th><th>Mobile</th><th>Right Eye</th><th>Left Eye</th><th>Lens Type</th><th>Amount</th></tr>";

        for (let key in data) {
            let prescription = data[key];
            let row = `<tr>
                <td>${prescription.patientName}</td>
                <td>${prescription.age}</td>
                <td>${prescription.mobile}</td>
                <td>${prescription.rightEye}</td>
                <td>${prescription.leftEye}</td>
                <td>${prescription.lensType}</td>
                <td>${prescription.amount}</td>
            </tr>`;
            table.innerHTML += row;
        }
    });
}
