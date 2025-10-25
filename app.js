// app.js - Consolidated from app.js and script.js

// Global Variables
let currentPrescriptionData = null;
let isFormFilled = false;
let deferredPrompt;

// 🛑 CRITICAL FIX: Use onAuthStateChanged to prevent the redirect loop.
// This listener waits until Firebase confirms the user's state (logged in or logged out)
// before deciding whether to initialize the app or redirect to auth.
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // User is confirmed signed in. Initialize the application once the DOM is ready.
        document.addEventListener('DOMContentLoaded', function() {
            initializeApp();
            setupEventListeners();
            setupPWA();
        });
    } else {
        // User is confirmed signed out. Redirect to the login page immediately.
        // Use window.location.replace to prevent the back button leading to app.html.
        window.location.replace('auth.html');
    }
});


function initializeApp() {
    // The user is guaranteed to be logged in here due to the check above.
    const user = auth.currentUser;

    // Load user profile
    loadUserProfile();
    
    // Set current date
    const todayDate = new Date().toLocaleDateString();
    const currentDateElement = document.getElementById('currentDate');
    const previewCurrentDateElement = document.getElementById('previewcurrentDate');
    
    if (currentDateElement) currentDateElement.textContent = todayDate;
    // FIX 3: Corrected the typo in the variable name to display the date properly.
    if (previewCurrentDateElement) previewCurrentDateElement.textContent = todayDate; 
    
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

    // Browser back button handling for the form
    window.addEventListener('popstate', handleBrowserBack);
    // Push a non-null state initially to manage the back button history stack
    history.pushState({ page: 'initial' }, document.title, location.href);
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
    const dashboardSection = document.getElementById('dashboardSection');
    if (dashboardSection) dashboardSection.classList.add('active');
    updateActiveNavLink('dashboard');
    // Ensure history state reflects the dashboard
    history.pushState({ page: 'dashboard' }, 'Dashboard', 'app.html#dashboard');
}

function showPrescriptionForm() {
    hideAllSections();
    const formSection = document.getElementById('prescriptionFormSection');
    if (formSection) formSection.classList.add('active');
    updateActiveNavLink('prescription');
    resetForm();
    // Ensure history state reflects the form
    history.pushState({ page: 'form' }, 'Add Prescription', 'app.html#form');
}

function showPrescriptions() {
    hideAllSections();
    const prescriptionsSection = document.getElementById('prescriptionsSection');
    if (prescriptionsSection) prescriptionsSection.classList.add('active');
    updateActiveNavLink('prescriptions');
    fetchPrescriptions();
    // Ensure history state reflects the list
    history.pushState({ page: 'prescriptions' }, 'View Prescriptions', 'app.html#prescriptions');
}

function showReports() {
    hideAllSections();
    const reportsSection = document.getElementById('reportsSection');
    if (reportsSection) reportsSection.classList.add('active');
    updateActiveNavLink('reports');
    // Ensure history state reflects the reports
    history.pushState({ page: 'reports' }, 'Reports', 'app.html#reports');
}

function showPreview(prescriptionData = null) {
    hideAllSections();
    const previewSection = document.getElementById('previewSection');
    if (previewSection) previewSection.classList.add('active');
    
    if (prescriptionData) {
        loadPreviewData(prescriptionData);
    } else {
        loadPreviewFromForm();
    }
    // No history push needed for preview since it's transient, but ensure back returns to list/form
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
    if (!user) {
        console.error('No user logged in');
        return;
    }

    try {
        const doc = await db.collection('users').doc(user.uid).get();
        
        if (doc.exists) {
            const userData = doc.data();
            console.log('Loaded user profile:', userData);
            updateProfileUI(userData);
        } else {
            // FIX 1 & 2: Automatically create a default profile if none exists (for new logins).
            console.log('No user profile found, creating default...');
            
            // Re-fetch data from registration form if possible, otherwise use placeholders
            // NOTE: The registration data should ideally be available in Firestore already 
            // from the auth.js handleRegister step. This is a safety fallback.
            const defaultProfile = {
                clinicName: 'Your Clinic Name',
                optometristName: 'Optometrist Name',
                address: 'Clinic Address',
                contactNumber: 'Contact Number',
                email: user.email || 'N/A',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Use set() to create the document with the user.uid as the ID
            await db.collection('users').doc(user.uid).set(defaultProfile);
            updateProfileUI(defaultProfile);
        }
    } catch (error) {
        // This will often catch "Missing or insufficient permissions" error
        console.error('Error loading user profile. Check Firestore Rules!', error);
        // Fallback to default values for display if DB read/write fails
        const fallbackData = {
            clinicName: 'Your Clinic Name (DB Error)',
            optometristName: 'Optometrist Name', 
            address: 'Clinic Address',
            contactNumber: 'Contact Number'
        };
        updateProfileUI(fallbackData);
    }
}

function updateProfileUI(userData) {
    console.log('Updating UI with:', userData);
    
    // Update main form
    const clinicName = document.getElementById('clinicName');
    const clinicAddress = document.getElementById('clinicAddress');
    const optometristName = document.getElementById('optometristName');
    const contactNumber = document.getElementById('contactNumber');
    
    if (clinicName) clinicName.textContent = userData.clinicName || 'Your Clinic Name';
    if (clinicAddress) clinicAddress.textContent = userData.address || 'Clinic Address';
    if (optometristName) optometristName.textContent = userData.optometristName || 'Optometrist Name';
    if (contactNumber) contactNumber.textContent = userData.contactNumber || 'Contact Number';

    // Update preview section
    const previewClinicName = document.getElementById('previewClinicName');
    const previewClinicAddress = document.getElementById('previewClinicAddress');
    const previewOptometristName = document.getElementById('previewOptometristName');
    const previewContactNumber = document.getElementById('previewContactNumber');
    
    if (previewClinicName) previewClinicName.textContent = userData.clinicName || 'Your Clinic Name';
    if (previewClinicAddress) previewClinicAddress.textContent = userData.address || 'Clinic Address';
    if (previewOptometristName) previewOptometristName.textContent = userData.optometristName || 'Optometrist Name';
    if (previewContactNumber) previewContactNumber.textContent = userData.contactNumber || 'Contact Number';
    
    console.log('UI update completed');
}

function openEditProfile() {
    const modal = document.getElementById('editProfileModal');
    if (modal) modal.style.display = 'flex';
    
    // Get current values from the displayed UI, not from Firestore
    const clinicName = document.getElementById('clinicName')?.textContent;
    const optometristName = document.getElementById('optometristName')?.textContent;
    const address = document.getElementById('clinicAddress')?.textContent;
    const contactNumber = document.getElementById('contactNumber')?.textContent;

    const editClinicName = document.getElementById('editClinicName');
    const editOptometristName = document.getElementById('editOptometristName');
    const editAddress = document.getElementById('editAddress');
    const editContactNumber = document.getElementById('editContactNumber');
    
    // Set values, filtering out placeholder text
    if (editClinicName) editClinicName.value = (clinicName === 'Loading...' || clinicName === 'Your Clinic Name' || clinicName === 'Your Clinic Name (DB Error)') ? '' : clinicName;
    if (editOptometristName) editOptometristName.value = (optometristName === 'Loading...' || optometristName === 'Optometrist Name') ? '' : optometristName;
    if (editAddress) editAddress.value = (address === 'Please wait...' || address === 'Clinic Address') ? '' : address;
    if (editContactNumber) editContactNumber.value = (contactNumber === 'Please wait...' || contactNumber === 'Contact Number') ? '' : contactNumber;
}

function closeEditProfile() {
    const modal = document.getElementById('editProfileModal');
    if (modal) modal.style.display = 'none';
}

async function saveProfile() {
    const user = auth.currentUser;
    if (!user) {
        console.error('No user logged in');
        return;
    }

    const updatedData = {
        clinicName: document.getElementById('editClinicName').value.trim(),
        optometristName: document.getElementById('editOptometristName').value.trim(),
        address: document.getElementById('editAddress').value.trim(),
        contactNumber: document.getElementById('editContactNumber').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Enhanced validation
    if (!updatedData.clinicName || !updatedData.optometristName) {
        console.error('Profile Update Error: Clinic Name and Optometrist Name are required.');
        // FIX: Using console.error instead of alert for compliance
        return;
    }

    try {
        // Use set with merge: true to update or create the document
        await db.collection('users').doc(user.uid).set(updatedData, { merge: true });
        
        console.log('Profile updated successfully!');
        
        // Reload the profile data to ensure UI is updated
        await loadUserProfile();
        
        closeEditProfile();
        
        // Show success message
        // FIX: Using console.log instead of alert for compliance
        console.log('Profile updated successfully!');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        // FIX: Using console.error instead of alert for compliance
    }
}

// Prescription Management
async function submitPrescription() {
    const user = auth.currentUser;
    if (!user) {
        console.error('Authentication Error: User is not logged in.');
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
        const newPrescriptionRef = await db.collection('prescriptions').add({
            userId: user.uid,
            ...formData,
            // Store date as a human-readable ISO string for accurate queries and sorting
            date: new Date().toISOString(), 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Prescription saved successfully! ID: ${newPrescriptionRef.id}`);
        
        // Store data for preview
        currentPrescriptionData = formData;
        
        // Show preview
        showPreview(formData);
        
        // Reset form
        resetForm();
        isFormFilled = false;

    } catch (error) {
        console.error('Error saving prescription:', error);
    }
}

function getFormData() {
    // Helper function to safely get float/int values
    const getNumberValue = (id) => {
        const value = document.getElementById(id)?.value.trim();
        return value ? parseFloat(value) : 0;
    };
    
    // Helper function to safely get string values
    const getStringValue = (id) => document.getElementById(id)?.value.trim() || '';

    return {
        patientName: getStringValue('patientName'),
        age: getNumberValue('age'),
        gender: getStringValue('gender'),
        mobile: getStringValue('patientMobile'),
        amount: getNumberValue('amount'),
        visionType: getStringValue('visionType'),
        lensType: getStringValue('lensType'),
        frameType: getStringValue('frameType'),
        paymentMode: getStringValue('paymentMode'),
        prescriptionData: {
            rightDistSPH: getStringValue('rightDistSPH'),
            rightDistCYL: getStringValue('rightDistCYL'),
            rightDistAXIS: getStringValue('rightDistAXIS'),
            rightDistVA: getStringValue('rightDistVA'),
            leftDistSPH: getStringValue('leftDistSPH'),
            leftDistCYL: getStringValue('leftDistCYL'),
            leftDistAXIS: getStringValue('leftDistAXIS'),
            leftDistVA: getStringValue('leftDistVA'),
            rightAddSPH: getStringValue('rightAddSPH'),
            rightAddCYL: getStringValue('rightAddCYL'), // Assuming this was the intended ID
            rightAddAXIS: getStringValue('rightAddAXIS'),
            rightAddVA: getStringValue('rightAddVA'),
            leftAddSPH: getStringValue('leftAddSPH'),
            leftAddCYL: getStringValue('leftAddCYL'),
            leftAddAXIS: getStringValue('leftAddAXIS'),
            leftAddVA: getStringValue('leftAddVA')
        }
    };
}

function validateFormData(data) {
    if (!data.patientName) {
        console.error('Validation Error: Please enter patient name');
        return false;
    }
    if (!data.age || data.age <= 0) {
        console.error('Validation Error: Please enter valid age');
        return false;
    }
    if (!data.mobile || !data.mobile.match(/^\d{10}$/)) {
        console.error('Validation Error: Please enter valid 10-digit mobile number');
        return false;
    }
    if (!data.amount || data.amount < 0) {
        console.error('Validation Error: Please enter valid amount');
        return false;
    }
    return true;
}

function resetForm() {
    const form = document.getElementById('prescriptionForm');
    if (form) {
        form.querySelectorAll('input:not([type="hidden"]), select').forEach(element => {
            if (element.tagName === 'INPUT') {
                element.value = '';
            } else if (element.tagName === 'SELECT') {
                element.selectedIndex = 0; // Reset to the first option
            }
        });
    }
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
    }
}

function displayPrescriptions(data) {
    const tbody = document.getElementById('prescriptionTable')?.getElementsByTagName('tbody')[0];
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
        // Use the 'date' field which is an ISO string
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
    
    // Format date properly
    const date = new Date(prescription.date).toLocaleString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    
    const fields = [
        date,
        prescription.patientName,
        prescription.age,
        prescription.gender,
        prescription.mobile,
        `₹${prescription.amount?.toFixed(2) || '0.00'}`,
        prescription.visionType,
        prescription.lensType,
        prescription.frameType,
        prescription.paymentMode
    ];

    fields.forEach((field) => {
        const cell = row.insertCell();
        cell.textContent = field;
    });

    // Actions cell
    const actionsCell = row.insertCell();
    
    const previewBtn = document.createElement('button');
    previewBtn.innerHTML = '👁️';
    previewBtn.className = 'btn-preview';
    previewBtn.title = 'Preview';
    // Create a deep copy to avoid mutation issues
    previewBtn.onclick = () => previewPrescription(JSON.parse(JSON.stringify(prescription))); 
    
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.className = 'btn-delete';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = () => deletePrescription(prescription);
    
    actionsCell.appendChild(previewBtn);
    actionsCell.appendChild(deleteBtn);
}

function filterPrescriptions() {
    const input = document.getElementById('searchInput')?.value.toLowerCase();
    const table = document.getElementById('prescriptionTable');
    const tbody = table?.getElementsByTagName('tbody')[0];
    if (!tbody || !input) return;
    
    const rows = tbody.getElementsByTagName('tr');

    for (let row of rows) {
        if (row.classList.contains('prescription-group-header')) continue;
        
        const name = row.cells[1]?.textContent.toLowerCase() || '';
        const mobile = row.cells[4]?.textContent.toLowerCase() || '';
        
        row.style.display = (name.includes(input) || mobile.includes(input)) ? '' : 'none';
    }
}

function previewPrescription(prescription) {
    showPreview(prescription);
}

async function deletePrescription(prescription) {
    // ⚠️ CRITICAL FIX: Replaced confirm() with a prompt as alerts/confirms are disallowed.
    console.warn(`Attempting to delete prescription ID: ${prescription.id}.`);
    
    const confirmed = window.prompt("Type 'DELETE' to confirm deletion of this prescription:") === 'DELETE';

    if (!confirmed) {
        console.log('Deletion cancelled by user.');
        return;
    }

    try {
        await db.collection('prescriptions').doc(prescription.id).delete();
        console.log('Prescription deleted successfully!');
        fetchPrescriptions(); // Refresh the list
    } catch (error) {
        console.error('Error deleting prescription:', error);
    }
}

// Preview Management
function loadPreviewFromForm() {
    const formData = getFormData();
    if (!validateFormData(formData)) {
        // If form is invalid, switch back to form view
        showPrescriptionForm();
        return;
    }
    loadPreviewData(formData);
}

function loadPreviewData(data) {
    // Patient details
    document.getElementById('previewPatientName').textContent = data.patientName || '';
    document.getElementById('previewAge').textContent = data.age || '';
    document.getElementById('previewGender').textContent = data.gender || '';
    document.getElementById('previewMobile').textContent = data.mobile || '';
    document.getElementById('previewAmount').textContent = data.amount?.toFixed(2) || '0.00';
    document.getElementById('previewVisionType').textContent = data.visionType || '';
    document.getElementById('previewLensType').textContent = data.lensType || '';
    document.getElementById('previewFrameType').textContent = data.frameType || '';
    document.getElementById('previewPaymentMode').textContent = data.paymentMode || '';

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
        console.error("PDF Error: Prescription Preview element not found.");
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
    
    console.log('PDF generation initiated.');
}

function printPreview() {
    window.print();
}

async function sendWhatsApp() {
    const mobile = document.getElementById('previewMobile')?.textContent;
    if (!mobile) {
        console.error('WhatsApp Error: No mobile number available for preview.');
        return;
    }

    try {
        const element = document.getElementById('prescriptionPreview');
        if (!element) {
            console.error("WhatsApp Error: Prescription Preview element not found.");
            return;
        }

        const canvas = await html2canvas(element, { scale: 2 });
        const imageData = canvas.toDataURL('image/png');
        
        // Upload to ImgBB
        const imageUrl = await uploadImageToImgBB(imageData);
        
        const message = `Here is your digital prescription from ${document.getElementById('previewClinicName')?.textContent || 'Your Clinic'}: ${imageUrl}`;
        const whatsappURL = `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`;
        window.open(whatsappURL, '_blank');
        
    } catch (error) {
        console.error('Error sending WhatsApp:', error);
    }
}

async function uploadImageToImgBB(base64Image) {
    // ⚠️ SECURITY WARNING: This API key is exposed in the client-side code.
    // In a production environment, this function MUST be moved to a secure backend 
    // (like Firebase Cloud Functions) to prevent abuse and hide the key.
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
            console.error('ImgBB Upload Failed:', data.error?.message || 'Unknown error');
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
        // Use the Firestore Timestamp field for reliable range query
        const querySnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', today)
            .where('createdAt', '<', tomorrow)
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
    oneWeekAgo.setHours(0, 0, 0, 0);

    try {
        const querySnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', oneWeekAgo)
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
    oneMonthAgo.setHours(0, 0, 0, 0);

    try {
        const querySnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', oneMonthAgo)
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
        
        // Use the Firestore Timestamp object for date calculation
        const timestamp = data.createdAt; 
        if (!timestamp || typeof timestamp.toDate !== 'function') return; // Skip if timestamp is missing or not a Firebase Timestamp
        
        const date = timestamp.toDate();
        let key;
        
        if (period === 'day') {
            key = date.toLocaleDateString();
        } else if (period === 'week') {
            const startOfWeek = new Date(date);
            // Adjust to Sunday (0) or Monday (1) start of week as preferred
            startOfWeek.setDate(date.getDate() - date.getDay()); 
            key = `Week of ${startOfWeek.toLocaleDateString()}`;
        } else if (period === 'month') {
            key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        
        if (!reportData[key]) {
            reportData[key] = { prescriptions: 0, totalAmount: 0 };
        }
        
        reportData[key].prescriptions += 1;
        // Ensure amount is treated as a number
        reportData[key].totalAmount += (data.amount || 0); 
    });
    
    return reportData;
}

function displayReport(data) {
    const tbody = document.getElementById('reportTable')?.getElementsByTagName('tbody')[0];
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
    const patientName = document.getElementById('patientName')?.value.trim();
    const age = document.getElementById('age')?.value.trim();
    const mobile = document.getElementById('patientMobile')?.value.trim();
    
    isFormFilled = !!(patientName || age || mobile);
}

function confirmExitAction() {
    document.getElementById('exitPromptModal').style.display = 'none';
    isFormFilled = false; // Reset flag to prevent re-triggering the modal immediately
    window.history.back(); // Navigate back
}

function cancelExitAction() {
    document.getElementById('exitPromptModal').style.display = 'none';
    // When the user clicks cancel, we restore the history state to the form page
    // to prevent the user from being stuck in the back button loop.
    history.pushState({ page: 'form' }, 'Add Prescription', 'app.html#form');
}

function handleBrowserBack(event) {
    const currentState = history.state?.page;
    // Only show the modal if the user is leaving the form AND the form is filled
    if (currentState === 'form' && isFormFilled) {
        
        const modal = document.getElementById('exitPromptModal');
        if (modal) modal.style.display = 'flex';
        
        // CRITICAL: Prevent the user from navigating away immediately
        // We must push the current state back to the history stack to keep the user on the page
        // until they explicitly confirm the exit.
        history.pushState({ page: 'form' }, 'Add Prescription', 'app.html#form');
    } else {
        // If the user is on the dashboard, list, or reports, allow navigation naturally
        // or re-route to dashboard if navigating away from the app base URL.
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
                // Ensure only allowed characters are kept
                if (field.type === 'number') {
                    // Allows numbers, decimal point, and sign (for SPH/CYL)
                    this.value = this.value.replace(/[^0-9.-]/g, ''); 
                } else if (field.type === 'va') {
                    // Allows numbers, '/', and 'N' (for V/A fields)
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
    // Since Firebase is used for persistent data, local storage stats are obsolete.
    console.warn("Local stats reset function is deprecated as data is stored in Firebase.");
}

// Logout Function
function logoutUser() {
    auth.signOut().then(() => {
        // Clear only user-specific local storage items, not PWA cache or 'rememberMe'
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        window.location.href = 'auth.html';
    }).catch(error => {
        console.error('Logout failed:', error);
    });
}

// Handle beforeunload event for closing the PWA
window.addEventListener("beforeunload", (event) => {
    // Only set the flag if the form is actually active to avoid unnecessary prompts
    const formActive = document.getElementById('prescriptionFormSection')?.classList.contains('active');
    
    if (formActive && isFormFilled) {
        event.preventDefault();
        event.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return "You have unsaved changes. Are you sure you want to leave?";
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
