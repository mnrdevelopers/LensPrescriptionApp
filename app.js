// app.js - Corrected and Working Version

// Global Variables
let currentPrescriptionData = null;
let isFormFilled = false;
let deferredPrompt;

// Firebase Auth State Listener
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        document.addEventListener('DOMContentLoaded', function() {
            initializeApp();
            setupEventListeners();
            setupPWA();
        });
    } else {
        // User is signed out
        window.location.replace('auth.html');
    }
});

function initializeApp() {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }

    // Set current date
    const todayDate = new Date().toLocaleDateString();
    const currentDateElement = document.getElementById('currentDate');
    const previewCurrentDateElement = document.getElementById('previewcurrentDate');
    
    if (currentDateElement) currentDateElement.textContent = todayDate;
    if (previewCurrentDateElement) previewCurrentDateElement.textContent = todayDate;
    
    // Load user profile
    loadUserProfile();
    
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
    history.pushState({ page: 'initial' }, document.title, location.href);
}

function setupPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => console.log("Service Worker Registered"))
            .catch((error) => console.log("Service Worker Registration Failed", error));
    }

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredPrompt = event;
    });
}

// Navigation Functions
function showDashboard() {
    hideAllSections();
    const dashboardSection = document.getElementById('dashboardSection');
    if (dashboardSection) dashboardSection.classList.add('active');
    updateActiveNavLink('dashboard');
    history.pushState({ page: 'dashboard' }, 'Dashboard', 'app.html#dashboard');
}

function showPrescriptionForm() {
    hideAllSections();
    const formSection = document.getElementById('prescriptionFormSection');
    if (formSection) formSection.classList.add('active');
    updateActiveNavLink('prescription');
    resetForm();
    history.pushState({ page: 'form' }, 'Add Prescription', 'app.html#form');
}

function showPrescriptions() {
    hideAllSections();
    const prescriptionsSection = document.getElementById('prescriptionsSection');
    if (prescriptionsSection) prescriptionsSection.classList.add('active');
    updateActiveNavLink('prescriptions');
    fetchPrescriptions();
    history.pushState({ page: 'prescriptions' }, 'View Prescriptions', 'app.html#prescriptions');
}

function showReports() {
    hideAllSections();
    const reportsSection = document.getElementById('reportsSection');
    if (reportsSection) reportsSection.classList.add('active');
    updateActiveNavLink('reports');
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
        } else {
            // Create default profile if doesn't exist
            const defaultProfile = {
                clinicName: 'Your Clinic Name',
                optometristName: 'Optometrist Name',
                address: 'Clinic Address',
                contactNumber: 'Contact Number',
                email: user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('users').doc(user.uid).set(defaultProfile);
            updateProfileUI(defaultProfile);
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        const fallbackData = {
            clinicName: 'Your Clinic',
            optometristName: 'Optometrist',
            address: 'Clinic Address',
            contactNumber: 'Contact Number'
        };
        updateProfileUI(fallbackData);
    }
}

function updateProfileUI(userData) {
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
}

function openEditProfile() {
    const modal = document.getElementById('editProfileModal');
    if (modal) modal.style.display = 'flex';
    
    // Pre-fill with current data
    const clinicName = document.getElementById('clinicName')?.textContent;
    const optometristName = document.getElementById('optometristName')?.textContent;
    const address = document.getElementById('clinicAddress')?.textContent;
    const contactNumber = document.getElementById('contactNumber')?.textContent;

    const editClinicName = document.getElementById('editClinicName');
    const editOptometristName = document.getElementById('editOptometristName');
    const editAddress = document.getElementById('editAddress');
    const editContactNumber = document.getElementById('editContactNumber');
    
    if (editClinicName) editClinicName.value = clinicName === 'Loading...' ? '' : clinicName;
    if (editOptometristName) editOptometristName.value = optometristName === 'Loading...' ? '' : optometristName;
    if (editAddress) editAddress.value = address === 'Please wait...' ? '' : address;
    if (editContactNumber) editContactNumber.value = contactNumber === 'Please wait...' ? '' : contactNumber;
}

function closeEditProfile() {
    const modal = document.getElementById('editProfileModal');
    if (modal) modal.style.display = 'none';
}

async function saveProfile() {
    const user = auth.currentUser;
    if (!user) return;

    const updatedData = {
        clinicName: document.getElementById('editClinicName').value.trim(),
        optometristName: document.getElementById('editOptometristName').value.trim(),
        address: document.getElementById('editAddress').value.trim(),
        contactNumber: document.getElementById('editContactNumber').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (!updatedData.clinicName || !updatedData.optometristName) {
        alert('Clinic Name and Optometrist Name are required.');
        return;
    }

    try {
        await db.collection('users').doc(user.uid).set(updatedData, { merge: true });
        updateProfileUI(updatedData);
        closeEditProfile();
        alert('Profile updated successfully!');
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile: ' + error.message);
    }
}

// Prescription Management
async function submitPrescription() {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }

    const formData = getFormData();
    
    if (!validateFormData(formData)) {
        return;
    }

    try {
        const newPrescriptionRef = await db.collection('prescriptions').add({
            userId: user.uid,
            ...formData,
            date: new Date().toISOString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Prescription saved successfully! ID: ${newPrescriptionRef.id}`);
        
        currentPrescriptionData = formData;
        showPreview(formData);
        resetForm();
        isFormFilled = false;

    } catch (error) {
        console.error('Error saving prescription:', error);
        alert('Error saving prescription: ' + error.message);
    }
}

function getFormData() {
    const getNumberValue = (id) => {
        const value = document.getElementById(id)?.value.trim();
        return value ? parseFloat(value) : 0;
    };
    
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
            rightAddCYL: getStringValue('rightAddCYL'),
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
    if (!data.amount || data.amount < 0) {
        alert('Please enter valid amount');
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
                element.selectedIndex = 0;
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

    const grouped = groupPrescriptionsByDate(data);
    
    Object.keys(grouped).forEach(group => {
        const headerRow = tbody.insertRow();
        const headerCell = headerRow.insertCell();
        headerCell.colSpan = 11;
        headerCell.textContent = group;
        headerCell.className = 'prescription-group-header';
        
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

    Object.keys(grouped).forEach(group => {
        if (grouped[group].length === 0) {
            delete grouped[group];
        }
    });

    return grouped;
}

function addPrescriptionRow(tbody, prescription) {
    const row = tbody.insertRow();
    
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

    const actionsCell = row.insertCell();
    
    const previewBtn = document.createElement('button');
    previewBtn.innerHTML = '👁️';
    previewBtn.className = 'btn-preview';
    previewBtn.title = 'Preview';
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
    const confirmed = window.prompt("Type 'DELETE' to confirm deletion of this prescription:") === 'DELETE';

    if (!confirmed) {
        return;
    }

    try {
        await db.collection('prescriptions').doc(prescription.id).delete();
        fetchPrescriptions();
    } catch (error) {
        console.error('Error deleting prescription:', error);
    }
}

// Preview Management
function loadPreviewFromForm() {
    const formData = getFormData();
    if (!validateFormData(formData)) {
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
        alert("PDF Error: Prescription Preview element not found.");
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
    const mobile = document.getElementById('previewMobile')?.textContent;
    if (!mobile) {
        alert('WhatsApp Error: No mobile number available for preview.');
        return;
    }

    try {
        const element = document.getElementById('prescriptionPreview');
        if (!element) {
            alert("WhatsApp Error: Prescription Preview element not found.");
            return;
        }

        const canvas = await html2canvas(element, { scale: 2 });
        const imageData = canvas.toDataURL('image/png');
        
        const imageUrl = await uploadImageToImgBB(imageData);
        
        const message = `Here is your digital prescription from ${document.getElementById('previewClinicName')?.textContent || 'Your Clinic'}: ${imageUrl}`;
        const whatsappURL = `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`;
        window.open(whatsappURL, '_blank');
        
    } catch (error) {
        console.error('Error sending WhatsApp:', error);
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
        const timestamp = data.createdAt;
        if (!timestamp || typeof timestamp.toDate !== 'function') return;
        
        const date = timestamp.toDate();
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
    isFormFilled = false;
    window.history.back();
}

function cancelExitAction() {
    document.getElementById('exitPromptModal').style.display = 'none';
    history.pushState({ page: 'form' }, 'Add Prescription', 'app.html#form');
}

function handleBrowserBack(event) {
    const currentState = history.state?.page;
    if (currentState === 'form' && isFormFilled) {
        const modal = document.getElementById('exitPromptModal');
        if (modal) modal.style.display = 'flex';
        history.pushState({ page: 'form' }, 'Add Prescription', 'app.html#form');
    }
}

// Input Validation
function setupInputValidation() {
    const ageInput = document.getElementById('age');
    if (ageInput) {
        ageInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

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
            }
            deferredPrompt = null;
        });
    }
}

// Logout Function
function logoutUser() {
    auth.signOut().then(() => {
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        window.location.href = 'auth.html';
    }).catch(error => {
        console.error('Logout failed:', error);
    });
}

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
