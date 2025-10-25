// app.js - Consolidated from app.js and script.js

// Global Variables
let currentPrescriptionData = null;
let isFormFilled = false;
let deferredPrompt;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    setupPWA();
});

function initializeApp() {
    // Check authentication
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }

    // Load user profile
    loadUserProfile();
    
    // Set current date
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString();
    document.getElementById('previewcurrentDate').textContent = new Date().toLocaleDateString();
    
    // Show dashboard by default
    showDashboard();
}

function setupEventListeners() {
    // Form field tracking
    const formFields = ['patientName', 'age', 'patientMobile'];
    formFields.forEach(field => {
        const element = document.getElementById(field);
        if (element) {
            element.addEventListener('input', checkFormFilled);
        }
    });

    // Exit prompt handlers
    const confirmExit = document.getElementById('confirmExit');
    const cancelExit = document.getElementById('cancelExit');
    if (confirmExit) confirmExit.addEventListener('click', confirmExitAction);
    if (cancelExit) cancelExit.addEventListener('click', cancelExitAction);

    // Input validation
    setupInputValidation();

    // Browser back button handling
    window.addEventListener('popstate', handleBrowserBack);
    history.pushState(null, document.title, location.href);
}

function setupPWA() {
    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => console.log("Service Worker Registered"))
            .catch((error) => console.log("Service Worker Registration Failed", error));
    }

    // PWA Install Prompt
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredPrompt = event;
        const installBtn = document.getElementById("install-btn");
        if (installBtn) installBtn.style.display = "block";
    });

    // Handle PWA installed event
    window.addEventListener("appinstalled", () => {
        console.log("PWA installed successfully!");
        deferredPrompt = null;
    });
}

// Navigation Functions
function showDashboard() {
    hideAllSections();
    document.getElementById('dashboardSection').classList.add('active');
    updateActiveNavLink('dashboard');
}

function showPrescriptionForm() {
    hideAllSections();
    document.getElementById('prescriptionFormSection').classList.add('active');
    updateActiveNavLink('prescription');
    resetForm();
}

function showPrescriptions() {
    hideAllSections();
    document.getElementById('prescriptionsSection').classList.add('active');
    updateActiveNavLink('prescriptions');
    fetchPrescriptions();
}

function showReports() {
    hideAllSections();
    document.getElementById('reportsSection').classList.add('active');
    updateActiveNavLink('reports');
}

function showPreview(prescriptionData = null) {
    hideAllSections();
    document.getElementById('previewSection').classList.add('active');
    
    if (prescriptionData) {
        loadPreviewData(prescriptionData);
    } else {
        loadPreviewFromForm();
    }
}

function hideAllSections() {
    const sections = document.querySelectorAll('.page-section');
    sections.forEach(section => section.classList.remove('active'));
}

function updateActiveNavLink(activeSection) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
}

// User Profile Management
async function loadUserProfile() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            const userData = doc.data();
            updateProfileUI(userData);
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

function updateProfileUI(userData) {
    // Update main form
    document.getElementById('clinicName').textContent = userData.clinicName;
    document.getElementById('clinicAddress').textContent = userData.address;
    document.getElementById('optometristName').textContent = userData.optometristName;
    document.getElementById('contactNumber').textContent = userData.contactNumber;

    // Update preview section
    document.getElementById('previewClinicName').textContent = userData.clinicName;
    document.getElementById('previewClinicAddress').textContent = userData.address;
    document.getElementById('previewOptometristName').textContent = userData.optometristName;
    document.getElementById('previewContactNumber').textContent = userData.contactNumber;
}

function openEditProfile() {
    document.getElementById('editProfileModal').style.display = 'flex';
    
    // Pre-fill with current data
    document.getElementById('editClinicName').value = document.getElementById('clinicName').textContent;
    document.getElementById('editOptometristName').value = document.getElementById('optometristName').textContent;
    document.getElementById('editAddress').value = document.getElementById('clinicAddress').textContent;
    document.getElementById('editContactNumber').value = document.getElementById('contactNumber').textContent;
}

function closeEditProfile() {
    document.getElementById('editProfileModal').style.display = 'none';
}

async function saveProfile() {
    const user = auth.currentUser;
    if (!user) return;

    const updatedData = {
        clinicName: document.getElementById('editClinicName').value,
        optometristName: document.getElementById('editOptometristName').value,
        address: document.getElementById('editAddress').value,
        contactNumber: document.getElementById('editContactNumber').value
    };

    try {
        await db.collection('users').doc(user.uid).update(updatedData);
        updateProfileUI(updatedData);
        alert('Profile updated successfully!');
        closeEditProfile();
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile: ' + error.message);
    }
}

// Prescription Management
async function submitPrescription() {
    const user = auth.currentUser;
    if (!user) {
        alert('You are not logged in!');
        window.location.href = 'auth.html';
        return;
    }

    // Get form values
    const formData = getFormData();
    
    // Validation
    if (!validateFormData(formData)) {
        return;
    }

    try {
        // Save to Firestore
        await db.collection('prescriptions').add({
            userId: user.uid,
            ...formData,
            date: new Date().toISOString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Prescription saved successfully!');
        
        // Store data for preview
        currentPrescriptionData = formData;
        
        // Show preview
        showPreview(formData);
        
        // Reset form
        resetForm();

    } catch (error) {
        console.error('Error saving prescription:', error);
        alert('Error saving prescription: ' + error.message);
    }
}

function getFormData() {
    return {
        patientName: document.getElementById('patientName').value.trim(),
        age: parseInt(document.getElementById('age').value.trim()),
        gender: document.getElementById('gender').value.trim(),
        mobile: document.getElementById('patientMobile').value.trim(),
        amount: parseFloat(document.getElementById('amount').value.trim()),
        visionType: document.getElementById('visionType').value,
        lensType: document.getElementById('lensType').value,
        frameType: document.getElementById('frameType').value,
        paymentMode: document.getElementById('paymentMode').value,
        prescriptionData: {
            rightDistSPH: document.getElementById('rightDistSPH').value.trim(),
            rightDistCYL: document.getElementById('rightDistCYL').value.trim(),
            rightDistAXIS: document.getElementById('rightDistAXIS').value.trim(),
            rightDistVA: document.getElementById('rightDistVA').value.trim(),
            leftDistSPH: document.getElementById('leftDistSPH').value.trim(),
            leftDistCYL: document.getElementById('leftDistCYL').value.trim(),
            leftDistAXIS: document.getElementById('leftDistAXIS').value.trim(),
            leftDistVA: document.getElementById('leftDistVA').value.trim(),
            rightAddSPH: document.getElementById('rightAddSPH').value.trim(),
            rightAddCYL: document.getElementById('rightAddCYL').value.trim(),
            rightAddAXIS: document.getElementById('rightAddAXIS').value.trim(),
            rightAddVA: document.getElementById('rightAddVA').value.trim(),
            leftAddSPH: document.getElementById('leftAddSPH').value.trim(),
            leftAddCYL: document.getElementById('leftAddCYL').value.trim(),
            leftAddAXIS: document.getElementById('leftAddAXIS').value.trim(),
            leftAddVA: document.getElementById('leftAddVA').value.trim()
        }
    };
}

function validateFormData(data) {
    if (!data.patientName) {
        alert('Please enter patient name');
        return false;
    }
    if (!data.age || data.age <= 0) {
        alert('Please enter valid age');
        return false;
    }
    if (!data.mobile || !data.mobile.match(/^\d{10}$/)) {
        alert('Please enter valid 10-digit mobile number');
        return false;
    }
    if (!data.amount || data.amount <= 0) {
        alert('Please enter valid amount');
        return false;
    }
    return true;
}

function resetForm() {
    document.getElementById('patientName').value = '';
    document.getElementById('age').value = '';
    document.getElementById('gender').value = 'Male';
    document.getElementById('patientMobile').value = '';
    document.getElementById('amount').value = '';

    // Reset prescription fields
    const prescriptionFields = [
        'rightDistSPH', 'rightDistCYL', 'rightDistAXIS', 'rightDistVA',
        'leftDistSPH', 'leftDistCYL', 'leftDistAXIS', 'leftDistVA',
        'rightAddSPH', 'rightAddCYL', 'rightAddAXIS', 'rightAddVA',
        'leftAddSPH', 'leftAddCYL', 'leftAddAXIS', 'leftAddVA'
    ];

    prescriptionFields.forEach(field => {
        document.getElementById(field).value = '';
    });

    isFormFilled = false;
}

// Prescriptions List Management
async function fetchPrescriptions() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const querySnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .orderBy('createdAt', 'desc')
            .get();

        const prescriptions = [];
        querySnapshot.forEach((doc) => {
            prescriptions.push({
                id: doc.id,
                ...doc.data()
            });
        });

        displayPrescriptions(prescriptions);
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        alert('Failed to fetch prescriptions.');
    }
}

function displayPrescriptions(data) {
    const tbody = document.getElementById('prescriptionTable').getElementsByTagName('tbody')[0];
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center">No prescriptions found</td></tr>';
        return;
    }

    // Group by date
    const grouped = groupPrescriptionsByDate(data);
    
    // Display grouped prescriptions
    Object.keys(grouped).forEach(group => {
        // Add group header
        const headerRow = tbody.insertRow();
        const headerCell = headerRow.insertCell();
        headerCell.colSpan = 11;
        headerCell.textContent = group;
        headerCell.className = 'prescription-group-header';
        
        // Add prescriptions for this group
        grouped[group].forEach(prescription => {
            addPrescriptionRow(tbody, prescription);
        });
    });
}

function groupPrescriptionsByDate(prescriptions) {
    const today = new Date().toLocaleDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayFormatted = yesterday.toLocaleDateString();

    const grouped = {
        'Today': [],
        'Yesterday': [],
        'Older': []
    };

    prescriptions.forEach(prescription => {
        const prescriptionDate = new Date(prescription.date).toLocaleDateString();
        if (prescriptionDate === today) {
            grouped['Today'].push(prescription);
        } else if (prescriptionDate === yesterdayFormatted) {
            grouped['Yesterday'].push(prescription);
        } else {
            grouped['Older'].push(prescription);
        }
    });

    // Remove empty groups
    Object.keys(grouped).forEach(group => {
        if (grouped[group].length === 0) {
            delete grouped[group];
        }
    });

    return grouped;
}

function addPrescriptionRow(tbody, prescription) {
    const row = tbody.insertRow();
    
    const date = new Date(prescription.date).toLocaleString();
    const fields = [
        date,
        prescription.patientName,
        prescription.age,
        prescription.gender,
        prescription.mobile,
        `₹${prescription.amount}`,
        prescription.visionType,
        prescription.lensType,
        prescription.frameType,
        prescription.paymentMode
    ];

    fields.forEach((field, index) => {
        const cell = row.insertCell();
        cell.textContent = field;
    });

    // Actions cell
    const actionsCell = row.insertCell();
    
    const previewBtn = document.createElement('button');
    previewBtn.innerHTML = '👁️';
    previewBtn.className = 'btn-preview';
    previewBtn.title = 'Preview';
    previewBtn.onclick = () => previewPrescription(prescription);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.className = 'btn-delete';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = () => deletePrescription(prescription);
    
    actionsCell.appendChild(previewBtn);
    actionsCell.appendChild(deleteBtn);
}

function filterPrescriptions() {
    const input = document.getElementById('searchInput').value.toLowerCase();
    const table = document.getElementById('prescriptionTable');
    const tbody = table.getElementsByTagName('tbody')[0];
    if (!tbody) return;
    
    const rows = tbody.getElementsByTagName('tr');

    for (let row of rows) {
        if (row.className === 'prescription-group-header') continue;
        
        const name = row.cells[1]?.textContent.toLowerCase() || '';
        const mobile = row.cells[4]?.textContent.toLowerCase() || '';
        
        row.style.display = (name.includes(input) || mobile.includes(input)) ? '' : 'none';
    }
}

function previewPrescription(prescription) {
    showPreview(prescription);
}

async function deletePrescription(prescription) {
    if (!confirm('Are you sure you want to delete this prescription?')) {
        return;
    }

    try {
        await db.collection('prescriptions').doc(prescription.id).delete();
        alert('Prescription deleted successfully!');
        fetchPrescriptions(); // Refresh the list
    } catch (error) {
        console.error('Error deleting prescription:', error);
        alert('Failed to delete prescription.');
    }
}

// Preview Management
function loadPreviewFromForm() {
    const formData = getFormData();
    loadPreviewData(formData);
}

function loadPreviewData(data) {
    // Patient details
    document.getElementById('previewPatientName').textContent = data.patientName;
    document.getElementById('previewAge').textContent = data.age;
    document.getElementById('previewGender').textContent = data.gender;
    document.getElementById('previewMobile').textContent = data.mobile;
    document.getElementById('previewAmount').textContent = data.amount;
    document.getElementById('previewVisionType').textContent = data.visionType;
    document.getElementById('previewLensType').textContent = data.lensType;
    document.getElementById('previewFrameType').textContent = data.frameType;
    document.getElementById('previewPaymentMode').textContent = data.paymentMode;

    // Prescription data
    const prescriptionFields = [
        'rightDistSPH', 'rightDistCYL', 'rightDistAXIS', 'rightDistVA',
        'leftDistSPH', 'leftDistCYL', 'leftDistAXIS', 'leftDistVA',
        'rightAddSPH', 'rightAddCYL', 'rightAddAXIS', 'rightAddVA',
        'leftAddSPH', 'leftAddCYL', 'leftAddAXIS', 'leftAddVA'
    ];

    prescriptionFields.forEach(field => {
        const element = document.getElementById(`preview${field}`);
        if (element && data.prescriptionData) {
            element.textContent = data.prescriptionData[field] || '';
        }
    });
}

// Export Functions
function generatePDF() {
    const element = document.getElementById('prescriptionPreview');
    if (!element) {
        alert("Please submit the form before downloading the PDF.");
        return;
    }

    html2pdf()
        .set({
            margin: 5,
            filename: 'Lens_Prescription.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(element)
        .save();
}

function printPreview() {
    window.print();
}

async function sendWhatsApp() {
    const mobile = document.getElementById('previewMobile').textContent;
    if (!mobile) {
        alert('No mobile number available');
        return;
    }

    try {
        const element = document.getElementById('prescriptionPreview');
        if (!element) {
            alert("Please submit the form before sending via WhatsApp.");
            return;
        }

        const canvas = await html2canvas(element, { scale: 2 });
        const imageData = canvas.toDataURL('image/png');
        
        // Upload to ImgBB
        const imageUrl = await uploadImageToImgBB(imageData);
        
        const message = `Here is your digital prescription from ${document.getElementById('previewClinicName').textContent}: ${imageUrl}`;
        const whatsappURL = `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`;
        window.open(whatsappURL, '_blank');
        
    } catch (error) {
        console.error('Error sending WhatsApp:', error);
        alert('Error sending prescription via WhatsApp');
    }
}

async function uploadImageToImgBB(base64Image) {
    const apiKey = "bbfde58b1da5fc9ee9d7d6a591852f71";
    const formData = new FormData();
    formData.append("image", base64Image.split(',')[1]);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            return data.data.url;
        } else {
            throw new Error('Image upload failed');
        }
    } catch (error) {
        console.error('Image upload error:', error);
        throw error;
    }
}

// Reports Management
async function fetchDailyReport() {
    const user = auth.currentUser;
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
        const querySnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .where('date', '>=', today.toISOString())
            .where('date', '<', tomorrow.toISOString())
            .get();

        const reportData = processReportData(querySnapshot, 'day');
        displayReport(reportData);
    } catch (error) {
        console.error('Error fetching daily report:', error);
    }
}

async function fetchWeeklyReport() {
    const user = auth.currentUser;
    if (!user) return;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    try {
        const querySnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .where('date', '>=', oneWeekAgo.toISOString())
            .get();

        const reportData = processReportData(querySnapshot, 'week');
        displayReport(reportData);
    } catch (error) {
        console.error('Error fetching weekly report:', error);
    }
}

async function fetchMonthlyReport() {
    const user = auth.currentUser;
    if (!user) return;

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    try {
        const querySnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .where('date', '>=', oneMonthAgo.toISOString())
            .get();

        const reportData = processReportData(querySnapshot, 'month');
        displayReport(reportData);
    } catch (error) {
        console.error('Error fetching monthly report:', error);
    }
}

function processReportData(querySnapshot, period = 'day') {
    const reportData = {};
    
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const date = new Date(data.date);
        let key;
        
        if (period === 'day') {
            key = date.toLocaleDateString();
        } else if (period === 'week') {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay());
            key = `Week of ${startOfWeek.toLocaleDateString()}`;
        } else if (period === 'month') {
            key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        
        if (!reportData[key]) {
            reportData[key] = { prescriptions: 0, totalAmount: 0 };
        }
        
        reportData[key].prescriptions += 1;
        reportData[key].totalAmount += parseFloat(data.amount);
    });
    
    return reportData;
}

function displayReport(data) {
    const tbody = document.getElementById('reportTable').getElementsByTagName('tbody')[0];
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!data || Object.keys(data).length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No data available</td></tr>';
        return;
    }

    Object.entries(data).forEach(([date, report]) => {
        const row = tbody.insertRow();
        row.insertCell().textContent = date;
        row.insertCell().textContent = report.prescriptions;
        row.insertCell().textContent = `₹${report.totalAmount.toFixed(2)}`;
    });
}

// Form Management
function checkFormFilled() {
    const patientName = document.getElementById('patientName').value.trim();
    const age = document.getElementById('age').value.trim();
    const mobile = document.getElementById('patientMobile').value.trim();
    
    isFormFilled = !!(patientName || age || mobile);
}

function confirmExitAction() {
    window.history.back();
}

function cancelExitAction() {
    document.getElementById('exitPromptModal').style.display = 'none';
}

function handleBrowserBack(event) {
    if (isFormFilled) {
        document.getElementById('exitPromptModal').style.display = 'flex';
        history.pushState(null, document.title, location.href);
    }
}

// Input Validation
function setupInputValidation() {
    // Age validation
    const ageInput = document.getElementById('age');
    if (ageInput) {
        ageInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    // Prescription fields validation
    const prescriptionInputs = [
        { id: 'rightDistSPH', type: 'number' },
        { id: 'rightDistCYL', type: 'number' },
        { id: 'rightDistAXIS', type: 'number' },
        { id: 'rightDistVA', type: 'va' },
        { id: 'leftDistSPH', type: 'number' },
        { id: 'leftDistCYL', type: 'number' },
        { id: 'leftDistAXIS', type: 'number' },
        { id: 'leftDistVA', type: 'va' },
        { id: 'rightAddSPH', type: 'number' },
        { id: 'rightAddCYL', type: 'number' },
        { id: 'rightAddAXIS', type: 'number' },
        { id: 'rightAddVA', type: 'va' },
        { id: 'leftAddSPH', type: 'number' },
        { id: 'leftAddCYL', type: 'number' },
        { id: 'leftAddAXIS', type: 'number' },
        { id: 'leftAddVA', type: 'va' }
    ];

    prescriptionInputs.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.addEventListener('input', function() {
                if (field.type === 'number') {
                    this.value = this.value.replace(/[^0-9.-]/g, '');
                } else if (field.type === 'va') {
                    this.value = this.value.replace(/[^0-9/N]/g, '');
                }
            });
        }
    });
}

// PWA Installation
function installPWA() {
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
}

// Stats Management
function resetStats() {
    localStorage.setItem("prescriptionCount", "0");
    localStorage.setItem("amountEarned", "0");
    alert("Prescription count and amount earned have been reset.");
    location.reload();
}

// Logout Function
function logoutUser() {
    auth.signOut().then(() => {
        localStorage.clear();
        window.location.href = 'auth.html';
    });
}

// Handle beforeunload event for closing the PWA
window.addEventListener("beforeunload", (event) => {
    if (isFormFilled) {
        event.preventDefault();
        event.returnValue = "";
        return "";
    }
});

// Make functions globally available
window.showDashboard = showDashboard;
window.showPrescriptionForm = showPrescriptionForm;
window.showPrescriptions = showPrescriptions;
window.showReports = showReports;
window.showPreview = showPreview;
window.openEditProfile = openEditProfile;
window.closeEditProfile = closeEditProfile;
window.saveProfile = saveProfile;
window.submitPrescription = submitPrescription;
window.filterPrescriptions = filterPrescriptions;
window.generatePDF = generatePDF;
window.printPreview = printPreview;
window.sendWhatsApp = sendWhatsApp;
window.fetchDailyReport = fetchDailyReport;
window.fetchWeeklyReport = fetchWeeklyReport;
window.fetchMonthlyReport = fetchMonthlyReport;
window.logoutUser = logoutUser;
window.installPWA = installPWA;
window.resetStats = resetStats;
