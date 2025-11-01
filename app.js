// app.js - Consolidated from app.js and script.js - FULL FEATURE SET
// Global Variables
let currentPrescriptionData = null;
let whatsappImageUrl = null;
let isFormFilled = false;
let deferredPrompt;
let isProfileComplete = false;
let lastValidSection = 'dashboard'; 
let timerInterval;
let timerSeconds = 0;
let isFirstPrescription = localStorage.getItem('isFirstPrescription') !== 'false'; // D: PWA Flag
let selectedPrescriptionToDelete = null; // E: Custom Delete Modal
let patientLookupData = null; // F: Patient data cache after lookup
let selectedPlan = 'yearly'; // Default to yearly plan

// --- NEW FEATURE GLOBALS (F, G, H) ---
let currentPatientId = null; 
// ------------------------------------

// NEW GLOBAL: Tracks premium status
let isPremium = false; 

// 🛑 CRITICAL FIX: Use onAuthStateChanged to prevent the redirect loop.
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeApp);
        } else {
            initializeApp();
        }
    } else {
        window.location.replace('auth.html');
    }
});

async function initializeApp() {
    console.log('Initializing app...');
    const user = auth.currentUser;
    
    if (!user) {
        console.error('No user found during initialization');
        return;
    }

    setCurrentDate();
    
    // Load user profile and check for completion
    await loadUserProfile();
    
    // Initialize Remote Config
    const configLoaded = await initializeRemoteConfig();
    
    if (!configLoaded) {
        console.warn('Remote Config failed, using default configuration');
        showStatusMessage('Using default configuration', 'info');
    }
    
    setupEventListeners();
    setupPWA(); 
    
    setInitialDateFilters();
    
    try {
        // --- MODIFIED: Determine premium status early ---
        const subscription = await checkActiveSubscription(user.uid);
        isPremium = subscription.active;
        // ------------------------------------------------

        // Add usage counter to dashboard
        addUsageCounterToDashboard();
        
        await updateSubscriptionStatus();
        await updatePremiumUI(); 
        
        // C: Check and update usage counter with Resilience check
        await checkPrescriptionLimit(true); 

        // G: Fetch templates after initialization
        fetchTemplates(); 
        
        // H: Fetch reminders on Dashboard load
        if (window.location.hash.includes('dashboard')) {
            fetchCheckupReminders(false); // Do not display on dashboard load, just count
        }
        
        // --- NEW: Apply feature locks/unlocks based on premium status ---
        lockFeatures();
        // -----------------------------------------------------------------

        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error during app initialization:', error);
    }
}

// -----------------------------------------------------------
// 1. Core App Setup Helpers
// -----------------------------------------------------------

function setInitialDateFilters() {
    const today = new Date().toISOString().split('T')[0];
    const startDateElements = [
        document.getElementById('prescriptionDateStart'),
        document.getElementById('reportDateStart')
    ];
    const endDateElements = [
        document.getElementById('prescriptionDateEnd'),
        document.getElementById('reportDateEnd')
    ];
    
    endDateElements.forEach(el => {
        if (el) el.value = today;
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const defaultStart = thirtyDaysAgo.toISOString().split('T')[0];
    
    startDateElements.forEach(el => {
        if (el) el.value = defaultStart;
    });
}

function setCurrentDate() {
    const today = new Date();
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    };
    const todayDate = today.toLocaleDateString('en-US', options);
    
    const currentDateElement = document.getElementById('currentDate');
    const previewCurrentDateElement = document.getElementById('previewcurrentDate');
    
    if (currentDateElement) {
        currentDateElement.textContent = todayDate;
    }
    
    if (previewCurrentDateElement) {
        previewCurrentDateElement.textContent = todayDate;
    }
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
    
    if (history.state === null || history.state?.page === 'initial') {
        const initialPage = window.location.hash.substring(1) || 'dashboard';
        history.replaceState({ page: initialPage }, initialPage, location.href); 
    }
    
    // Dashboard Stats listener
    const statsSelect = document.getElementById('statsTimePeriod');
    if (statsSelect) {
        statsSelect.addEventListener('change', fetchDashboardStats);
    }
    
    // F: Patient Search Listener
    const patientSearchInput = document.getElementById('patientSearchInput');
    if (patientSearchInput) {
        patientSearchInput.addEventListener('keyup', filterPatients);
    }
}

function setupPWA() {
    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/LensPrescriptionApp/service-worker.js')
            .then((registration) => {
                
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateNotification();
                        }
                    });
                });
            });
    }
    // PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
    });

    // Handle PWA installed event
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        hideInstallPromotion();
    });

    // Online/Offline detection
    window.addEventListener('online', () => showStatusMessage('Back online', 'success'));
    window.addEventListener('offline', () => showStatusMessage('You are currently offline', 'warning'));

    // Initial online status check
    if (!navigator.onLine) {
        showStatusMessage('You are currently offline', 'warning');
    }
}

function showInstallPromotion() {
    hideInstallPromotion();
    
    const installPrompt = document.createElement('div');
    installPrompt.id = 'installPrompt';
    installPrompt.innerHTML = `
        <div class="install-prompt">
            <div class="install-content">
                <i class="fas fa-download"></i>
                <div class="install-text">
                    <strong>Install Lens Prescription App</strong>
                    <small>Get the full app experience</small>
                </div>
                <div class="install-buttons">
                    <button onclick="installPWA()" class="btn btn-primary btn-sm">
                        Install
                    </button>
                    <button onclick="hideInstallPromotion()" class="btn btn-secondary btn-sm">
                        Later
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(installPrompt);
    
    setTimeout(() => {
        if (document.getElementById('installPrompt')) {
            hideInstallPromotion();
        }
    }, 15000);
}

function hideInstallPromotion() {
    const installPrompt = document.getElementById('installPrompt');
    if (installPrompt) {
        installPrompt.remove();
    }
}

function showUpdateNotification() {
    const updateNotification = document.createElement('div');
    updateNotification.id = 'updateNotification';
    updateNotification.innerHTML = `
        <div class="update-notification">
            <div class="update-content">
                <i class="fas fa-sync-alt"></i>
                <span>New version available!</span>
                <button onclick="window.location.reload()" class="btn btn-success btn-sm">
                    Update
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(updateNotification);
}

// Status message function for PDF feedback
function showStatusMessage(message, type = 'info') {
    const existingMessages = document.querySelectorAll('.status-message');
    existingMessages.forEach(msg => msg.remove());

    const statusMessage = document.createElement('div');
    statusMessage.className = `status-message alert status-${type}`;
    statusMessage.innerHTML = `
        <i class="fas fa-${getStatusIcon(type)}"></i>
        ${message}
    `;
    statusMessage.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 10000;
        min-width: 250px;
        padding: 12px 16px;
        border-radius: 8px;
        background: ${getStatusColor(type)};
        color: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
    `;
    
    document.body.appendChild(statusMessage);
    
    setTimeout(() => {
        if (statusMessage.parentNode) {
            statusMessage.remove();
        }
    }, 4000);
}

function getStatusIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function getStatusColor(type) {
    const colors = {
        'success': '#28a745',
        'error': '#dc3545',
        'warning': '#ffc107',
        'info': '#17a2b8'
    };
    return colors[type] || '#17a2b8';
}

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

// -----------------------------------------------------------
// 2. Navigation and Routing
// -----------------------------------------------------------

/**
 * Checks if profile is complete before navigating. Forces user to setup screen if not.
 */
function navigateIfProfileComplete(navFunction, sectionName) {
    if (isProfileComplete) {
        enableNavigationButtons();
        
        const hash = sectionName === 'dashboard' ? 'dashboard' : 
                     sectionName === 'form' ? 'form' : 
                     sectionName === 'notifications' ? 'notifications' : // NEW SECTION
                     sectionName === 'prescriptions' ? 'prescriptions' : 
                     sectionName === 'reports' ? 'reports' : 
                     sectionName === 'patients' ? 'patients' : 
                     'setup';
        
        history.replaceState({ page: sectionName }, sectionName, `app.html#${hash}`);

        navFunction();
        lastValidSection = sectionName; 
    } else {
        showProfileSetup(true); 
    }
}

function routeToHashedSection() {
    const hash = window.location.hash.substring(1); 

    switch (hash) {
        case 'dashboard':
            showDashboard();
            break;
        case 'form':
            showPrescriptionForm();
            break;
        case 'notifications':
            showNotifications(); // NEW FUNCTION CALL
            break;
        case 'prescriptions':
            showPrescriptions();
            break;
        case 'reports':
            showReports();
            break;
        case 'patients': 
            showPatients();
            break;
        case 'setup':
            showProfileSetup(false);
            break;
        default:
            showDashboard();
            break;
    }
}

function showDashboard() {
    hideAllSections();
    const dashboardSection = document.getElementById('dashboardSection');
    if (dashboardSection) dashboardSection.classList.add('active');
    updateActiveNavLink('showDashboard');
    
    document.getElementById('statsTimePeriod').value = 'daily';
    fetchDashboardStats();
    fetchCheckupReminders(false); // Only update count on dashboard
}

function showNotifications() {
    hideAllSections();
    const notificationsSection = document.getElementById('notificationsSection');
    if (notificationsSection) notificationsSection.classList.add('active');
    updateActiveNavLink('showNotifications');
    
    fetchCheckupReminders(true); // Fetch and display reminders on this page
}

function showPrescriptionForm() {
    hideAllSections();
    const formSection = document.getElementById('prescriptionFormSection');
    if (formSection) formSection.classList.add('active');
    updateActiveNavLink('showPrescriptionForm'); 
    
    resetForm(true); 
    fetchTemplates(); 
    lastValidSection = 'form';
}

function showPrescriptions() {
    hideAllSections();
    const prescriptionsSection = document.getElementById('prescriptionsSection');
    if (prescriptionsSection) prescriptionsSection.classList.add('active');
    updateActiveNavLink('showPrescriptions'); 
    
    fetchPrescriptions();
}

function showReports() {
    hideAllSections();
    const reportsSection = document.getElementById('reportsSection');
    if (reportsSection) reportsSection.classList.add('active');
    updateActiveNavLink('showReports'); 
    
    fetchReportDataByRange();
}

function showPatients() {
    hideAllSections();
    const patientsSection = document.getElementById('patientsSection');
    if (patientsSection) patientsSection.classList.add('active');
    updateActiveNavLink('showPatients'); 
    
    fetchPatients();
}

function showProfileSetup(isForced) {
    hideAllSections();
    const setupSection = document.getElementById('profileSetupSection');
    if (setupSection) setupSection.classList.add('active');
    
    if (isForced) {
        disableNavigationButtons();
    } else {
        enableNavigationButtons();
    }
    updateActiveNavLink('showProfileSetup'); 

    const user = auth.currentUser;
    const emailDisplay = document.getElementById('userEmailDisplay');
    if (emailDisplay) {
        emailDisplay.textContent = user ? user.email : 'N/A';
        updatePremiumUI();
    }

    const saveBtn = document.getElementById('saveSetupProfileBtn');
    if (saveBtn) {
        saveBtn.textContent = isForced ? 'Save Profile & Continue' : 'Save Changes';
    }

    if (!isForced) {
        const userData = JSON.parse(localStorage.getItem('userProfile') || '{}');
        document.getElementById('setupClinicName').value = userData.clinicName || '';
        document.getElementById('setupOptometristName').value = userData.optometristName || '';
        document.getElementById('setupAddress').value = userData.address || '';
        document.getElementById('setupContactNumber').value = userData.contactNumber || '';
    } else {
         document.getElementById('setupClinicName').value = '';
         document.getElementById('setupOptometristName').value = '';
         document.getElementById('setupAddress').value = '';
         document.getElementById('setupContactNumber').value = '';
    }
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

function updateActiveNavLink(activeFunction) {
    const navLinks = document.querySelectorAll('.nav-link-custom');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(activeFunction)) {
            link.classList.add('active');
        }
    });
}

function disableNavigationButtons() {
    const navButtons = document.querySelectorAll('.nav-link-custom');
    navButtons.forEach(btn => {
        btn.classList.add('nav-disabled');
    });
}

function enableNavigationButtons() {
    const navButtons = document.querySelectorAll('.nav-link-custom');
    navButtons.forEach(btn => {
        btn.classList.remove('nav-disabled');
    });
}

// -----------------------------------------------------------
// 3. User & Profile Management
// -----------------------------------------------------------

async function loadUserProfile() {
    const user = auth.currentUser;
    if (!user) {
        return;
    }

    const isFreshRegistration = localStorage.getItem('freshRegistration') === 'true';
    if (isFreshRegistration) {
        localStorage.removeItem('freshRegistration');
    }
    
    let userData = null;

    try {
        const doc = await db.collection('users').doc(user.uid).get();
        
        if (doc.exists) {
            userData = doc.data();
            
            const isDataValid = userData.clinicName && userData.optometristName;
            
            if (isDataValid) {
                isProfileComplete = true;
                updateProfileUI(userData);
                localStorage.setItem('userProfile', JSON.stringify(userData));
                enableNavigationButtons(); 
                routeToHashedSection(); 
                return;
            }
            
            isProfileComplete = false;
            showProfileSetup(true);

        } else {
            isProfileComplete = false;
            showProfileSetup(true);
        }
    } catch (error) {
        console.error('Error loading user profile from Firestore:', error);
        
        const localProfile = localStorage.getItem('userProfile');
        if (localProfile) {
            userData = JSON.parse(localProfile);
            isProfileComplete = userData.clinicName && userData.optometristName;
            updateProfileUI(userData);
            if (isProfileComplete) {
                enableNavigationButtons();
                routeToHashedSection();
            } else {
                showProfileSetup(true);
            }
        } else {
            showProfileSetup(true);
        }
    }
}

async function saveSetupProfile() {
    const user = auth.currentUser;
    if (!user) {
        return;
    }

    const updatedData = {
        clinicName: document.getElementById('setupClinicName').value.trim(),
        optometristName: document.getElementById('setupOptometristName').value.trim(),
        address: document.getElementById('setupAddress').value.trim(),
        contactNumber: document.getElementById('setupContactNumber').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        email: user.email
    };
    
    if (!updatedData.clinicName || !updatedData.optometristName) {
        showStatusMessage('Clinic Name and Optometrist Name are required to continue.', 'error');
        return;
    }

    try {
        const saveBtn = document.getElementById('saveSetupProfileBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        await db.collection('users').doc(user.uid).set(updatedData, { merge: true });
        
        isProfileComplete = true;
        updateProfileUI(updatedData);
        localStorage.setItem('userProfile', JSON.stringify(updatedData));
        
        enableNavigationButtons();

        const cameFromPrescriptionForm = document.getElementById('prescriptionFormSection')?.classList.contains('active') || 
                                        lastValidSection === 'form';
        
        if (cameFromPrescriptionForm) {
            navigateIfProfileComplete(showPrescriptionForm, 'form');
        } else {
            navigateIfProfileComplete(showDashboard, 'dashboard');
        }

    } catch (error) {
        console.error('Error saving profile:', error);
        showStatusMessage('Error saving profile: ' + error.message, 'error');
    } finally {
        const saveBtn = document.getElementById('saveSetupProfileBtn');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Profile & Continue';
    }
}


function updateProfileUI(userData) {
    
    if (!userData) {
        return;
    }
    
    const fields = [
        { id: 'clinicName', text: userData.clinicName || 'Your Clinic Name' },
        { id: 'clinicAddress', text: userData.address || 'Clinic Address' },
        { id: 'optometristName', text: userData.optometristName || 'Optometrist Name' },
        { id: 'contactNumber', text: userData.contactNumber || 'Contact Number' },
        { id: 'previewClinicName', text: userData.clinicName || 'Your Clinic Name' },
        { id: 'previewClinicAddress', text: userData.address || 'Clinic Address' },
        { id: 'previewOptometristName', text: userData.optometristName || 'Optometrist Name' },
        { id: 'previewContactNumber', text: userData.contactNumber || 'Contact Number' },
    ];
    
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.textContent = field.text;
        }
    });

    const dashboardText = document.getElementById('dashboardWelcomeText');
    if (dashboardText) {
        dashboardText.textContent = `Welcome, ${userData.optometristName || 'Optometrist'}!`;
    }
}

function logoutUser() {
    auth.signOut().then(() => {
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        sessionStorage.setItem("explicitLogout", "true");
        window.location.replace('index.html');
    }).catch(error => {
        console.error('Logout failed:', error);
    });
}

// -----------------------------------------------------------
// 4. Prescription Core Logic (Submission & Data)
// -----------------------------------------------------------

async function submitPrescription() {
    if (!isProfileComplete) {
        showStatusMessage('Please complete your Clinic Profile before adding prescriptions.', 'error');
        showProfileSetup(true);
        return;
    }

    // --- MODIFIED: Direct check on submission ---
    // This check handles both premium status and limit checking
    const canSubmit = await checkPrescriptionLimit();
    if (!canSubmit) {
        // Limit check will show the appropriate prompt modal (Limit Reached), no need for a separate error
        return; 
    }
    // ------------------------------------------
    
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }

    const formData = getFormData();
    
    if (!validateFormData(formData)) {
        showStatusMessage('Please fill all required patient and amount fields correctly.', 'error');
        return;
    }

    try {
        const nextCheckupDate = new Date();
        nextCheckupDate.setDate(nextCheckupDate.getDate() + 365);
        
        const patientData = await savePatientRecord(formData, nextCheckupDate);

        const newPrescriptionRef = await db.collection('prescriptions').add({
            userId: user.uid,
            patientId: patientData.patientId, 
            ...formData,
            nextCheckupDate: firebase.firestore.Timestamp.fromDate(nextCheckupDate), 
            date: new Date().toISOString(), 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        currentPrescriptionData = { 
            ...formData, 
            nextCheckupDate: nextCheckupDate.toLocaleDateString()
        };
        
        whatsappImageUrl = null; 
        
        checkAndPromptPWAInstall();

        showPreview(currentPrescriptionData);
        
        resetForm();

    } catch (error) {
        console.error('Error saving prescription:', error);
        showStatusMessage('Error saving prescription. Please check logs.', 'error');
    }
}

function getFormData() {
    const getNumberValue = (id) => {
        const value = document.getElementById(id)?.value.trim();
        return value ? parseFloat(value) : 0;
    };
    const getStringValue = (id) => document.getElementById(id)?.value.trim() || '';

    return {
        patientId: getStringValue('patientId'),
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
    if (!data.patientName) return false;
    if (!data.age || data.age <= 0) return false;
    if (!data.mobile || !data.mobile.match(/^\d{10}$/)) return false;
    if (!data.amount || data.amount < 0) return false;
    return true;
}

function resetForm(clearPatientData = false) {
    const form = document.getElementById('prescriptionForm');
    if (form) {
        form.querySelectorAll('input:not([type="hidden"]), select').forEach(element => {
            if (element.tagName === 'INPUT') {
                element.value = '';
            } else if (element.tagName === 'SELECT') {
                element.selectedIndex = 0; 
            }
        });
        // Clear all prescription data inputs
        document.querySelectorAll('#prescriptionFormSection input[type="text"]').forEach(input => input.value = '');
    }
    isFormFilled = false;
    
    // Clear patient data if requested
    if (clearPatientData) {
        document.getElementById('patientId').value = '';
        currentPatientId = null;
        patientLookupData = null;
    }
}

// A: Copy OD to OS Function
function copyRightToLeft() {
    // --- MODIFIED: Use new feature lock prompt ---
    if (!isPremium) {
        showPremiumFeaturePrompt();
        return;
    }
    // ------------------------------------------
    
    const fields = [
        'DistSPH', 'DistCYL', 'DistAXIS', 'DistVA',
        'AddSPH', 'AddCYL', 'AddAXIS', 'AddVA'
    ];

    fields.forEach(field => {
        const rightValue = document.getElementById(`right${field}`)?.value;
        const leftElement = document.getElementById(`left${field}`);
        
        if (leftElement) {
            leftElement.value = rightValue;
            leftElement.dispatchEvent(new Event('input'));
        }
    });
    
    showStatusMessage("Right Eye (OD) values copied to Left Eye (OS).", 'info');
}

// -----------------------------------------------------------
// 5. Patient/History Management
// -----------------------------------------------------------

async function savePatientRecord(formData, nextCheckupDate) {
    const user = auth.currentUser;
    const patientId = formData.patientId;
    const patientData = {
        userId: user.uid,
        name: formData.patientName,
        mobile: formData.mobile,
        age: formData.age,
        gender: formData.gender,
        lastVisit: firebase.firestore.FieldValue.serverTimestamp(),
        nextCheckupDate: firebase.firestore.Timestamp.fromDate(nextCheckupDate),
    };
    
    try {
        if (patientId) {
            // Update existing patient
            await db.collection('patients').doc(patientId).update(patientData);
            return { ...patientData, patientId };
        } else {
            // Create new patient
            const newPatientRef = await db.collection('patients').add({
                ...patientData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                prescriptionCount: 1 
            });
            document.getElementById('patientId').value = newPatientRef.id;
            return { ...patientData, patientId: newPatientRef.id };
        }
    } catch (error) {
        console.error('Error saving patient record:', error);
        throw new Error('Failed to save patient record.');
    }
}

async function checkPatientExists(mobile) {
    const user = auth.currentUser;
    const mobileValue = mobile.replace(/\D/g, '');
    
    if (!mobileValue || mobileValue.length !== 10) {
        document.getElementById('patientId').value = '';
        currentPatientId = null;
        patientLookupData = null;
        return;
    }
    
    try {
        const querySnapshot = await db.collection('patients')
            .where('userId', '==', user.uid)
            .where('mobile', '==', mobileValue)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            showStatusMessage('New patient: Ready to create record.', 'info');
            document.getElementById('patientId').value = '';
            currentPatientId = null;
            patientLookupData = null;
            return;
        }

        const doc = querySnapshot.docs[0];
        const patient = doc.data();
        
        document.getElementById('patientId').value = doc.id;
        document.getElementById('patientName').value = patient.name || '';
        document.getElementById('age').value = patient.age || '';
        document.getElementById('gender').value = patient.gender || 'Male';
        
        currentPatientId = doc.id;
        patientLookupData = patient;

        showStatusMessage(`Patient ${patient.name} found. Details autofilled.`, 'success');
        
    } catch (error) {
        console.error('Error checking patient existence:', error);
        showStatusMessage('Error checking patient database.', 'error');
    }
}

async function fetchPatients() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const querySnapshot = await db.collection('patients')
            .where('userId', '==', user.uid)
            .orderBy('lastVisit', 'desc')
            .get();

        const patients = [];
        const today = new Date();
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const lastVisitDate = data.lastVisit?.toDate().toLocaleDateString() || 'N/A';
            const nextCheckupDate = data.nextCheckupDate?.toDate();
            
            const isDue = nextCheckupDate && nextCheckupDate <= today;
            
            patients.push({
                id: doc.id,
                ...data,
                lastVisitDisplay: lastVisitDate,
                nextCheckupDisplay: nextCheckupDate ? nextCheckupDate.toLocaleDateString() : 'N/A',
                isDue: isDue
            });
        });

        displayPatients(patients);

    } catch (error) {
        console.error('Error fetching patients:', error);
        showStatusMessage('Error fetching patient records.', 'error');
    }
}

function displayPatients(patients) {
    const tbody = document.getElementById('patientTable')?.getElementsByTagName('tbody')[0];
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!patients || patients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No patient records found.</td></tr>';
        return;
    }

    patients.forEach(patient => {
        const row = tbody.insertRow();
        
        const nextCheckupClass = patient.isDue ? 'text-danger fw-bold' : '';
        
        row.insertCell().textContent = patient.name;
        row.insertCell().textContent = patient.mobile;
        row.insertCell().textContent = `${patient.age || 'N/A'} / ${patient.gender || 'N/A'}`;
        row.insertCell().textContent = patient.lastVisitDisplay;
        row.insertCell().innerHTML = `<span class="${nextCheckupClass}">${patient.nextCheckupDisplay}</span>`;
        row.insertCell().textContent = patient.prescriptionCount || 0;

        const actionsCell = row.insertCell();
        const viewHistoryBtn = document.createElement('button');
        viewHistoryBtn.innerHTML = '<i class="fas fa-history"></i>';
        viewHistoryBtn.className = 'btn-view-history';
        viewHistoryBtn.title = 'View Prescriptions';
        // F: Set filter by mobile number and jump to prescription list
        viewHistoryBtn.onclick = () => filterPrescriptionsByMobile(patient.mobile); 
        
        actionsCell.appendChild(viewHistoryBtn);
    });

    filterPatients();
}

function filterPrescriptionsByMobile(mobile) {
    navigateIfProfileComplete(showPrescriptions, 'prescriptions');
    
    // Set the search input value and trigger fetch/filter
    setTimeout(() => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = mobile;
            fetchPrescriptions();
            showStatusMessage(`Filtered history for mobile: ${mobile}`, 'info');
        }
    }, 100);
}

function filterPatients() {
    const input = document.getElementById('patientSearchInput')?.value.toLowerCase();
    const table = document.getElementById('patientTable');
    const tbody = table?.getElementsByTagName('tbody')[0];
    if (!tbody || !input) return;
    
    const rows = tbody.getElementsByTagName('tr');

    for (let row of rows) {
        const name = row.cells[0]?.textContent.toLowerCase() || '';
        const mobile = row.cells[1]?.textContent.toLowerCase() || '';
        
        row.style.display = (name.includes(input) || mobile.includes(input)) ? '' : 'none';
    }
}

async function fetchCheckupReminders(displayOnPage = false) {
    const user = auth.currentUser;
    if (!user) return;
    
    const today = new Date();
    const thirtyDaysFuture = new Date();
    thirtyDaysFuture.setDate(today.getDate() + 30);
    const notificationsContent = document.getElementById('notificationsContent');
    
    let htmlContent = '';

    try {
        const querySnapshot = await db.collection('patients')
            .where('userId', '==', user.uid)
            .where('nextCheckupDate', '<=', firebase.firestore.Timestamp.fromDate(thirtyDaysFuture))
            .orderBy('nextCheckupDate', 'asc') // Order by date ascending
            .get();

        let countDue = 0;
        let reminders = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const nextCheckupDate = data.nextCheckupDate?.toDate();
            
            if (nextCheckupDate && nextCheckupDate <= thirtyDaysFuture) {
                countDue++;
                reminders.push({
                    name: data.name,
                    mobile: data.mobile,
                    date: nextCheckupDate.toLocaleDateString(),
                    isDue: nextCheckupDate <= today
                });
            }
        });

        // 1. Update Dashboard Card
        const statReminders = document.getElementById('statRemindersDue');
        if (statReminders) {
            statReminders.textContent = countDue.toString();
        }
        
        // 2. Display on Notifications Page if requested
        if (displayOnPage && notificationsContent) {
            if (reminders.length === 0) {
                 htmlContent = `<div class="alert alert-success text-center">
                                    <i class="fas fa-check-circle me-2"></i>No patient checkup reminders due in the next 30 days!
                                </div>`;
            } else {
                htmlContent += `<div class="alert alert-warning">
                                    <i class="fas fa-calendar-check me-2"></i>You have **${reminders.length} patients** due for a checkup soon (within 30 days).
                                </div>
                                <ul class="list-group list-group-flush">`;

                reminders.forEach(r => {
                    const statusText = r.isDue ? 'OVERDUE' : 'DUE SOON';
                    const statusClass = r.isDue ? 'list-group-item-danger' : 'list-group-item-warning';
                    
                    htmlContent += `
                        <li class="list-group-item ${statusClass} d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${r.name}</strong> 
                                <span class="badge bg-secondary ms-2">${r.mobile}</span>
                                <br>
                                <small class="text-muted">Next Checkup: ${r.date}</small>
                            </div>
                            <span class="badge bg-dark">${statusText}</span>
                            <button onclick="filterPrescriptionsByMobile('${r.mobile}')" class="btn btn-sm btn-info ms-3">
                                <i class="fas fa-history"></i> History
                            </button>
                        </li>
                    `;
                });
                htmlContent += `</ul>`;
            }
            notificationsContent.innerHTML = htmlContent;
        }

    } catch (error) {
        console.error('Error fetching checkup reminders:', error);
        
        const statReminders = document.getElementById('statRemindersDue');
        if (statReminders) {
            statReminders.textContent = 'N/A';
        }
        
        if (displayOnPage && notificationsContent) {
            notificationsContent.innerHTML = `<div class="alert alert-danger text-center">
                                                <i class="fas fa-exclamation-circle me-2"></i>Error loading reminders. Check your network or permissions.
                                            </div>`;
        }
    }
}

// -----------------------------------------------------------
// 6. Templates (G)
// -----------------------------------------------------------

async function fetchTemplates() {
    const user = auth.currentUser;
    const select = document.getElementById('templateSelect');
    if (!user || !select) return;
    
    select.innerHTML = '<option value="">-- Select Template --</option>';

    try {
        // We fetch templates even for free users, but lock the save function.
        const querySnapshot = await db.collection('templates')
            .where('userId', '==', user.uid)
            .orderBy('name', 'asc')
            .get();

        querySnapshot.forEach((doc) => {
            const template = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = template.name;
            option.dataset.templateData = JSON.stringify(template.data);
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error fetching templates:', error);
    }
}

async function saveAsTemplate() {
    // --- MODIFIED: Use new feature lock prompt ---
    if (!isPremium) {
        showPremiumFeaturePrompt();
        return;
    }
    // ------------------------------------------
    
    const user = auth.currentUser;
    if (!user) return;
    
    const templateName = window.prompt("Enter a name for this prescription template:");
    if (!templateName || templateName.trim() === "") {
        showStatusMessage("Template save cancelled.", 'info');
        return;
    }
    
    const formData = getFormData();
    
    const templateData = {
        visionType: formData.visionType,
        lensType: formData.lensType,
        frameType: formData.frameType,
        prescriptionData: formData.prescriptionData
    };
    
    try {
        await db.collection('templates').add({
            userId: user.uid, // ← Make sure this is included
            name: templateName.trim(),
            data: templateData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showStatusMessage(`Template "${templateName}" saved successfully!`, 'success');
        fetchTemplates();
        
    } catch (error) {
        console.error('Error saving template:', error);
        showStatusMessage('Failed to save template. Please try again.', 'error');
    }
}

function loadTemplate(templateId) {
    if (!templateId) return;

    const select = document.getElementById('templateSelect');
    const selectedOption = Array.from(select.options).find(opt => opt.value === templateId);
    
    if (!selectedOption || !selectedOption.dataset.templateData) {
        showStatusMessage('Template data not found.', 'error');
        return;
    }

    try {
        const template = JSON.parse(selectedOption.dataset.templateData);
        
        document.getElementById('visionType').value = template.visionType || 'Single Vision';
        document.getElementById('lensType').value = template.lensType || 'Blue Cut';
        document.getElementById('frameType').value = template.frameType || 'Full Rim';

        const presData = template.prescriptionData;
        
        const fields = [
            'rightDistSPH', 'rightDistCYL', 'rightDistAXIS', 'rightDistVA',
            'leftDistSPH', 'leftDistCYL', 'leftDistAXIS', 'leftDistVA',
            'rightAddSPH', 'rightAddCYL', 'rightAddAXIS', 'rightAddVA',
            'leftAddSPH', 'leftAddCYL', 'leftAddAXIS', 'leftAddVA'
        ];

        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                element.value = presData[field] || '';
            }
        });

        showStatusMessage(`Template "${selectedOption.textContent}" loaded.`, 'success');
        
    } catch (error) {
        console.error('Error loading template:', error);
        showStatusMessage('Error applying template.', 'error');
    }
}


// -----------------------------------------------------------
// 7. Data Display (Prescriptions, Reports)
// -----------------------------------------------------------

async function fetchPrescriptions() {
    const user = auth.currentUser;
    if (!user) return;

    const startDateInput = document.getElementById('prescriptionDateStart').value;
    const endDateInput = document.getElementById('prescriptionDateEnd').value;
    const searchInput = document.getElementById('searchInput').value.trim().toLowerCase();
    
    if (startDateInput && endDateInput && new Date(startDateInput) > new Date(endDateInput)) {
        showStatusMessage('Start date cannot be after end date.', 'error');
        return;
    }

    const startDate = startDateInput ? new Date(startDateInput) : null;
    const endDate = endDateInput ? new Date(endDateInput) : null;
    
    if (endDate) {
        // Set end date to end of day for inclusive filtering
        endDate.setHours(23, 59, 59, 999);
    }
    
    // 1. Initial Firestore Query (Simplified for maximum index compatibility)
    // We only filter by the user ID and order by the creation time (descending).
    // The query relies on a simple composite index on (userId, createdAt, desc).
    let baseQuery = db.collection('prescriptions')
        .where('userId', '==', user.uid);

    try {
        const querySnapshot = await baseQuery.orderBy('createdAt', 'desc').get();

        let prescriptions = [];
        querySnapshot.forEach((doc) => {
            prescriptions.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // 2. Client-side Filtering for Date Range and Search (Resilient approach)
        prescriptions = prescriptions.filter(rx => {
            // Firestore timestamps need .toDate() if fetched via data(). We assume
            // rx.date is already a valid date string from the `submitPrescription` function.
            const rxDate = new Date(rx.date);
            
            // Apply Date Range Filter
            const isAfterStart = !startDate || (rxDate.getTime() >= startDate.getTime());
            const isBeforeEnd = !endDate || (rxDate.getTime() <= endDate.getTime());
            
            if (!isAfterStart || !isBeforeEnd) {
                return false;
            }
            
            // Apply Search Filter
            if (searchInput) {
                const name = rx.patientName.toLowerCase();
                const mobile = rx.mobile;
                // Match search input against name or mobile number
                return name.includes(searchInput) || mobile.includes(searchInput);
            }
            
            return true;
        });

        // 3. Client-side Sorting (No sorting needed as Firestore already provided descending order)
        
        displayPrescriptions(prescriptions); // This line was causing the error
        
    } catch (error) {
        // 🚨 CRITICAL ERROR LOGGING: This remains the most important part of debugging index issues.
        console.error('CRITICAL FIRESTORE ERROR fetching prescriptions:', error);
        showStatusMessage('Error fetching prescriptions. You need a composite index on `userId` (Ascending) and `createdAt` (Descending). Check the browser console for details and follow the link to create the required index if one is present.', 'error');
    }
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

    const finalGrouped = {};
    Object.keys(grouped).forEach(group => {
        if (grouped[group].length > 0) {
            finalGrouped[group] = grouped[group];
        }
    });

    return finalGrouped;
}

// -----------------------------------------------------------
// 7.1. New displayPrescriptions Function (Fix)
// -----------------------------------------------------------
function displayNoPrescriptionsFound(tbody) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">No prescriptions found for the selected filter.</td></tr>';
}

function displayPrescriptions(prescriptions) {
    const tbody = document.getElementById('prescriptionTable')?.getElementsByTagName('tbody')[0];
    if (!tbody) return;
    
    tbody.innerHTML = ''; // Clear existing rows

    if (!prescriptions || prescriptions.length === 0) {
        displayNoPrescriptionsFound(tbody);
        return;
    }
    
    // Group and display prescriptions
    const grouped = groupPrescriptionsByDate(prescriptions);
    const groupOrder = ['Today', 'Yesterday', 'Older'];

    groupOrder.forEach(groupName => {
        const group = grouped[groupName];
        if (group && group.length > 0) {
            // Add group header row
            const headerRow = tbody.insertRow();
            headerRow.classList.add('prescription-group-header');
            const headerCell = headerRow.insertCell();
            headerCell.colSpan = 10;
            headerCell.textContent = `${groupName} (${group.length} prescriptions)`;

            // Add prescription rows for the group
            group.forEach(prescription => {
                addPrescriptionRow(tbody, prescription);
            });
        }
    });
}

// B: Updated displayPrescriptions to include Age/Mobile and Time
function addPrescriptionRow(tbody, prescription) {
    const row = tbody.insertRow();
    
    const date = new Date(prescription.date);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const fields = [
        `${dateStr} @ ${timeStr}`,
        prescription.patientName,
        prescription.age,
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
    // --- MODIFIED: Lock delete action for non-premium users ---
    deleteBtn.onclick = () => {
        if (!isPremium) {
            showPremiumFeaturePrompt(); // Show premium feature lock message
        } else {
            showDeleteModal(prescription);
        }
    };
    // ---------------------------------------------------------
    
    actionsCell.appendChild(previewBtn);
    actionsCell.appendChild(deleteBtn);
}

function filterPrescriptions() {
    // Note: The main filtering is now done in fetchPrescriptions() using firebase queries 
    // and supplemental client-side search. This function is essentially now a no-op 
    // unless the user performs keyup after fetch.
}

function previewPrescription(prescription) {
    whatsappImageUrl = null;
    showPreview(prescription);
}

// E: Custom Delete Modal Implementations
function showDeleteModal(prescription) {
    selectedPrescriptionToDelete = prescription;
    const modal = document.getElementById('deleteConfirmationModal');
    const nameDisplay = document.getElementById('deleteRxName');
    
    if (nameDisplay) {
        nameDisplay.textContent = `Prescription for ${prescription.patientName} (Mobile: ${prescription.mobile})`;
    }
    
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeDeleteModal() {
    selectedPrescriptionToDelete = null;
    const modal = document.getElementById('deleteConfirmationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function confirmDeleteAction() {
    if (!selectedPrescriptionToDelete) {
        showStatusMessage('No prescription selected for deletion.', 'error');
        return;
    }
    
    closeDeleteModal(); 
    
    const prescription = selectedPrescriptionToDelete;
    
    try {
        await db.collection('prescriptions').doc(prescription.id).delete();
        showStatusMessage('Prescription deleted successfully!', 'success');
        fetchPrescriptions();
    } catch (error) {
        showStatusMessage('Error deleting prescription. Check console for details.', 'error');
    } finally {
        selectedPrescriptionToDelete = null;
    }
}

// Preview Management (Updated for H: Next Checkup Date)
function loadPreviewFromForm() {
    const formData = getFormData();
    if (!validateFormData(formData)) {
        showPrescriptionForm();
        return;
    }
    loadPreviewData({
        ...formData,
        nextCheckupDate: new Date(new Date().setDate(new Date().getDate() + 365)).toLocaleDateString()
    });
}

function loadPreviewData(data) {
    document.getElementById('previewPatientName').textContent = data.patientName || '';
    document.getElementById('previewAge').textContent = data.age || '';
    document.getElementById('previewGender').textContent = data.gender || '';
    document.getElementById('previewMobile').textContent = data.mobile || '';
    document.getElementById('previewAmount').textContent = data.amount?.toFixed(2) || '0.00';
    document.getElementById('previewVisionType').textContent = data.visionType || '';
    document.getElementById('previewLensType').textContent = data.lensType || '';
    document.getElementById('previewFrameType').textContent = data.frameType || '';
    document.getElementById('previewPaymentMode').textContent = data.paymentMode || '';
    
    const checkupDate = data.nextCheckupDate || 'N/A';
    document.getElementById('previewNextCheckupDate').textContent = checkupDate;

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

// Output functions (generateImage, printPreview, sendWhatsApp) are complex but remain functionally the same.
// They are kept for brevity but should be assumed to be present and correct from the previous detailed response.
// *******************************************************************************************************
function generateImage() {
    // --- MODIFIED: Lock download for non-premium users ---
    if (!isPremium) {
        showPremiumFeaturePrompt();
        return;
    }
    // ----------------------------------------------------
    
    const btn = document.querySelector('.btn-download');
    if (btn) {
        btn.classList.add('btn-loading');
        btn.textContent = 'Generating Image...';
    }
    showStatusMessage('Generating Image for Download...', 'info');

    const patientName = document.getElementById('previewPatientName')?.textContent || 'Patient';
    const shortDate = new Date().toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    }).replace(/\//g, '-');
    const filename = `Prescription_${patientName}_${shortDate}.png`;

    const element = document.getElementById('prescriptionPreview');
    
    html2canvas(element, {
        scale: 3, 
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
    }).then(canvas => {
        const imageDataURL = canvas.toDataURL('image/png');
        
        const downloadLink = document.createElement('a');
        downloadLink.href = imageDataURL;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        showStatusMessage('Image (PNG) downloaded successfully!', 'success');
        
    }).catch((error) => {
        showStatusMessage('Export failed. See console for details.', 'error');
        
    }).finally(() => {
        if (btn) {
            btn.classList.remove('btn-loading');
            btn.textContent = 'Download'; 
        }
    });
}

function printPreview() {
    // --- MODIFIED: Lock printing for non-premium users ---
    if (!isPremium) {
        showPremiumFeaturePrompt();
        return;
    }
    // ----------------------------------------------------
    
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    
    if (!printWindow) {
        window.print();
        return;
    }

    const clinicName = document.getElementById('previewClinicName')?.textContent || 'Your Clinic';
    const clinicAddress = document.getElementById('previewClinicAddress')?.textContent || 'Clinic Address';
    const optometristName = document.getElementById('previewOptometristName')?.textContent || 'Optometrist Name';
    const contactNumber = document.getElementById('previewContactNumber')?.textContent || 'Contact Number';
    
    const now = new Date();
    const shortDate = now.toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
    const shortTime = now.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    const currentDateTime = `${shortDate} ${shortTime}`;
    
    const patientName = document.getElementById('previewPatientName')?.textContent || '';
    const age = document.getElementById('previewAge')?.textContent || '';
    const gender = document.getElementById('previewGender')?.textContent || '';
    const mobile = document.getElementById('previewMobile')?.textContent || '';
    
    const visionType = document.getElementById('previewVisionType')?.textContent || '';
    const lensType = document.getElementById('previewLensType')?.textContent || '';
    const frameType = document.getElementById('previewFrameType')?.textContent || '';
    const amount = document.getElementById('previewAmount')?.textContent || '';
    const paymentMode = document.getElementById('previewPaymentMode')?.textContent || '';

    const prescriptionData = {
        rightDist: {
            SPH: document.getElementById('previewrightDistSPH')?.textContent || '',
            CYL: document.getElementById('previewrightDistCYL')?.textContent || '',
            AXIS: document.getElementById('previewrightDistAXIS')?.textContent || '',
            VA: document.getElementById('previewrightDistVA')?.textContent || ''
        },
        rightAdd: {
            SPH: document.getElementById('previewrightAddSPH')?.textContent || '',
            CYL: document.getElementById('previewrightAddCYL')?.textContent || '',
            AXIS: document.getElementById('previewrightAddAXIS')?.textContent || '',
            VA: document.getElementById('previewrightAddVA')?.textContent || ''
        },
        leftDist: {
            SPH: document.getElementById('previewleftDistSPH')?.textContent || '',
            CYL: document.getElementById('previewleftDistCYL')?.textContent || '',
            AXIS: document.getElementById('previewleftDistAXIS')?.textContent || '',
            VA: document.getElementById('previewleftDistVA')?.textContent || ''
        },
        leftAdd: {
            SPH: document.getElementById('previewleftAddSPH')?.textContent || '',
            CYL: document.getElementById('previewleftAddCYL')?.textContent || '',
            AXIS: document.getElementById('previewleftAddAXIS')?.textContent || '',
            VA: document.getElementById('previewleftAddVA')?.textContent || ''
        }
    };

    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Prescription - ${patientName}</title>
            <meta charset="UTF-8">
            <style>
                * {
                    margin: 0; padding: 0; box-sizing: border-box; font-family: 'Courier New', monospace;
                }
                body {
                    width: 58mm; margin: 0 auto; padding: 3mm; background: white; color: black; font-size: 9px; line-height: 1.1;
                }
                .clinic-header { text-align: center; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #000; }
                .clinic-name { font-size: 11px; font-weight: bold; margin-bottom: 1px; text-transform: uppercase; }
                .clinic-address { font-size: 8px; margin-bottom: 1px; }
                .clinic-contact { font-size: 8px; font-weight: bold; }
                .header-info { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 8px; }
                .name-section { font-weight: bold; }
                .date-section { text-align: right; font-weight: bold; }
                .prescription-title { text-align: center; font-size: 10px; font-weight: bold; margin: 4px 0; text-decoration: underline; }
                .patient-info { margin-bottom: 4px; padding: 3px; border: 1px solid #000; }
                .patient-row { display: flex; margin-bottom: 1px; }
                .patient-label { font-weight: bold; width: 25mm; }
                .patient-value { flex: 1; }
                .prescription-section { margin: 4px 0; }
                .eye-title { text-align: center; background: #e0e0e0; padding: 2px; font-weight: bold; font-size: 9px; border: 1px solid #000; border-bottom: none; }
                .prescription-table { width: 100%; border-collapse: collapse; margin-bottom: 3px; font-size: 7px; }
                .prescription-table th { background: #f0f0f0; border: 1px solid #000; padding: 2px 1px; text-align: center; font-weight: bold; }
                .prescription-table td { border: 1px solid #000; padding: 2px 1px; text-align: center; }
                .section-heading { background: #e8e8e8 !important; font-weight: bold; }
                .options-section { margin: 4px 0; border: 1px solid #000; }
                .options-title { background: #e0e0e0; padding: 2px; text-align: center; font-weight: bold; font-size: 9px; }
                .options-content { padding: 3px; }
                .option-row { display: flex; margin-bottom: 1px; }
                .option-label { font-weight: bold; width: 20mm; }
                .option-value { flex: 1; }
                .amount-section { border: 1px solid #000; margin: 4px 0; }
                .amount-row { display: flex; padding: 2px 3px; }
                .amount-label { font-weight: bold; width: 25mm; }
                .amount-value { flex: 1; font-weight: bold; font-size: 10px; }
                .footer { margin-top: 6px; padding-top: 3px; border-top: 1px solid #000; text-align: center; font-size: 7px; }
                .thank-you { margin-bottom: 2px; font-style: italic; }
                .signature { margin-top: 8px; text-align: right; }
                .signature-line { border-top: 1px solid #000; width: 30mm; margin-left: auto; padding-top: 1px; text-align: center; font-size: 7px; }
                @media print {
                    body { margin: 0; padding: 2mm; width: 58mm; }
                    @page { margin: 0; padding: 0; size: 58mm auto; }
                    .no-print { display: none !important; }
                }
                .print-controls { text-align: center; margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
                .print-btn { padding: 8px 16px; margin: 0 5px; border: none; border-radius: 3px; cursor: pointer; font-size: 10px; }
                .print-primary { background: #007bff; color: white; }
                .print-secondary { background: #6c757d; color: white; }
            </style>
        </head>
        <body>
            <div class="clinic-header">
                <div class="clinic-name">${clinicName}</div>
                <div class="clinic-address">${clinicAddress}</div>
                <div class="clinic-contact">📞 ${contactNumber}</div>
            </div>
            <div class="header-info">
                <div class="name-section"><strong>${optometristName}</strong></div>
                <div class="date-section"><strong>${currentDateTime}</strong></div>
            </div>
            <div class="prescription-title">EYE PRESCRIPTION</div>
            <div class="patient-info">
                <div class="patient-row">
                    <div class="patient-label">Patient Name:</div>
                    <div class="patient-value">${patientName}</div>
                </div>
                <div class="patient-row">
                    <div class="patient-label">Age / Gender:</div>
                    <div class="patient-value">${age} / ${gender}</div>
                </div>
                <div class="patient-row">
                    <div class="patient-label">Mobile:</div>
                    <div class="patient-value">${mobile}</div>
                </div>
            </div>
            <div class="prescription-section">
                <div class="eye-title">RIGHT EYE (OD)</div>
                <table class="prescription-table">
                    <thead>
                        <tr><th>Type</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>V/A</th></tr>
                    </thead>
                    <tbody>
                        <tr><td class="section-heading">DIST</td><td>${prescriptionData.rightDist.SPH}</td><td>${prescriptionData.rightDist.CYL}</td><td>${prescriptionData.rightDist.AXIS}</td><td>${prescriptionData.rightDist.VA}</td></tr>
                        <tr><td class="section-heading">ADD</td><td>${prescriptionData.rightAdd.SPH}</td><td>${prescriptionData.rightAdd.CYL}</td><td>${prescriptionData.rightAdd.AXIS}</td><td>${prescriptionData.rightAdd.VA}</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="prescription-section">
                <div class="eye-title">LEFT EYE (OS)</div>
                <table class="prescription-table">
                    <thead>
                        <tr><th>Type</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>V/A</th></tr>
                    </thead>
                    <tbody>
                        <tr><td class="section-heading">DIST</td><td>${prescriptionData.leftDist.SPH}</td><td>${prescriptionData.leftDist.CYL}</td><td>${prescriptionData.leftDist.AXIS}</td><td>${prescriptionData.leftDist.VA}</td></tr>
                        <tr><td class="section-heading">ADD</td><td>${prescriptionData.leftAdd.SPH}</td><td>${prescriptionData.leftAdd.CYL}</td><td>${prescriptionData.leftAdd.AXIS}</td><td>${prescriptionData.leftAdd.VA}</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="options-section">
                <div class="options-title">RECOMMENDED OPTIONS</div>
                <div class="options-content">
                    <div class="option-row"><div class="option-label">Vision Type:</div><div class="option-value">${visionType}</div></div>
                    <div class="option-row"><div class="option-label">Lens Type:</div><div class="option-value">${lensType}</div></div>
                    <div class="option-row"><div class="option-label">Frame Type:</div><div class="option-value">${frameType}</div></div>
                    <div class="option-row"><div class="option-label">Payment Mode:</div><div class="option-value">${paymentMode}</div></div>
                </div>
            </div>
            <div class="amount-section">
                <div class="amount-row">
                    <div class="amount-label">TOTAL AMOUNT:</div>
                    <div class="amount-value">₹ ${amount}</div>
                </div>
            </div>
            <div class="footer">
                <div class="thank-you">Thank you for choosing ${clinicName}</div>
                <div>For queries: ${contactNumber}</div>
                <div class="signature">
                    <div class="signature-line">
                        Authorized Signature<br>
                        <strong>${optometristName}</strong>
                    </div>
                </div>
            </div>
            <div class="no-print print-controls">
                <button class="print-btn print-primary" onclick="printPreview()">🖨️ Print Now</button>
                <button class="print-btn print-secondary" onclick="window.close()">❌ Close</button>
            </div>
            <script>
                setTimeout(function() { window.print(); }, 500);
                window.onafterprint = function() { setTimeout(function() { window.close(); }, 1000); };
                setTimeout(function() { if (!window.closed) { window.close(); } }, 10000);
            </script>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHTML);
    printWindow.document.close();
}

async function sendWhatsAppMessage(mobile, imageUrl) {
    try {
        const formattedMobile = mobile.replace(/\D/g, '');
        const clinicName = document.getElementById('previewClinicName')?.textContent || 'Our Clinic';
        const optometristName = document.getElementById('previewOptometristName')?.textContent || 'Optometrist';
        const patientName = document.getElementById('previewPatientName')?.textContent || 'Patient';
        
        const message = `Hello ${patientName},\n\nYour eye prescription from ${clinicName} is ready.\n\nThank you for visiting us!\n\n- ${optometristName}`;
        
        let whatsappUrl;
        
        if (imageUrl.startsWith('http')) {
            const messageWithImage = `${message}\n\nView your prescription: ${imageUrl}`;
            const encodedMessageWithImage = encodeURIComponent(messageWithImage);
            whatsappUrl = `https://wa.me/${formattedMobile}?text=${encodedMessageWithImage}`;
        } else {
             const encodedMessage = encodeURIComponent(message);
             whatsappUrl = `https://wa.me/${formattedMobile}?text=${encodedMessage}`;
        }
        
        const whatsappWindow = window.open(whatsappUrl, '_blank');
        
        if (!whatsappWindow) {
            showStatusMessage('Popup blocked. Please allow popups for WhatsApp.', 'warning');
        } else {
            showStatusMessage('Opening WhatsApp...', 'success');
        }
        
    } catch (error) {
        throw new Error('Failed to send WhatsApp message: ' + error.message);
    }
}

function startWhatsappTimer() {
    const modal = document.getElementById('whatsappTimerModal');
    const timerDisplay = document.getElementById('timerDisplay');
    
    if (modal) modal.style.display = 'flex';
    timerSeconds = 0;
    
    if (timerDisplay) timerDisplay.textContent = '00:00';

    timerInterval = setInterval(() => {
        timerSeconds++;
        const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
        const seconds = String(timerSeconds % 60).padStart(2, '0');
        if (timerDisplay) timerDisplay.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopWhatsappTimer() {
    clearInterval(timerInterval);
    const modal = document.getElementById('whatsappTimerModal');
    if (modal) {
        modal.style.display = 'none';
        
    }
}

async function sendWhatsApp() {
    // --- MODIFIED: Lock sharing for non-premium users ---
    if (!isPremium) {
        showPremiumFeaturePrompt();
        return;
    }
    // ----------------------------------------------------
    
    const mobile = document.getElementById('previewMobile')?.textContent;
    if (!mobile) {
        showStatusMessage('No mobile number available for WhatsApp', 'error');
        return;
    }
    
    if (whatsappImageUrl) {
        await sendWhatsAppMessage(mobile, whatsappImageUrl);
        return;
    }
    
    startWhatsappTimer(); 
    
    try {
        const element = document.getElementById('prescriptionPreview');
        if (!element) {
            showStatusMessage('Prescription preview not found', 'error');
            stopWhatsappTimer();
            return;
        }

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff'
        });

        const imageData = canvas.toDataURL('image/png');
        
        try {
            whatsappImageUrl = await uploadImageToImgBB(imageData);
        } catch (imgbbError) {
            whatsappImageUrl = imageData; 
        }

        await sendWhatsAppMessage(mobile, whatsappImageUrl);
        
    } catch (error) {
        showStatusMessage('Failed to send WhatsApp: ' + error.message, 'error');
    } finally {
        stopWhatsappTimer(); 
    }
}

async function uploadImageToImgBB(base64Image) {
    if (!IMGBB_API_KEY || IMGBB_API_KEY === 'DISABLED') {
        throw new Error('Image upload service is currently unavailable.');
    }
    
    const blob = dataURLToBlob(base64Image);
    const formData = new FormData();
    formData.append("image", blob);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
        return data.data.url;
    } else {
        throw new Error(data.error?.message || 'Image upload failed');
    }
}

function dataURLToBlob(dataURL) {
    const parts = dataURL.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);
    
    for (let i = 0; i < raw.length; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    
    return new Blob([uInt8Array], { type: contentType });
}
// *******************************************************************************************************


// -----------------------------------------------------------
// 8. Monetization and Resilience (C, D)
// -----------------------------------------------------------

function checkAndPromptPWAInstall() {
    if (isFirstPrescription) {
        isFirstPrescription = false;
        localStorage.setItem('isFirstPrescription', 'false'); 
        
        if (deferredPrompt) {
            showInstallPromotion(); 
        }
    }
}

async function checkPrescriptionLimit(isInitialLoad = false) {
    const user = auth.currentUser;
    if (!user) return false;

    // Premium users bypass the limit immediately
    if (isPremium) {
        return true;
    }

    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // subscription check already done in initializeApp, just proceed with limit check
        
        const querySnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', monthStart)
            .where('createdAt', '<=', monthEnd)
            .get();

        const prescriptionCount = querySnapshot.size;
        
        updateUsageCounter(prescriptionCount);

        if (prescriptionCount >= FREE_PRESCRIPTION_LIMIT) {
            if (RAZORPAY_KEY_ID) {
                if (!isInitialLoad) { 
                     showLimitReachedPrompt(); // Show specific limit message
                }
                return false;
            } else {
                // If payment is disabled, treat as unlimited free
                return true;
            }
        }
        
        return true;
    } catch (error) {
        if (!isInitialLoad) {
             showStatusMessage('Warning: Database error prevented limit check. Allowing submission temporarily. Please report this issue.', 'error');
        }
        return true; 
    }
}

function updateUsageCounter(currentCount) {
    const usageElement = document.getElementById('usageCounter');
    if (!usageElement) return;

    const percentage = (currentCount / FREE_PRESCRIPTION_LIMIT) * 100;
    const progressBarStyle = `width: ${Math.min(100, percentage)}%`; // Cap at 100%
    const statusText = percentage >= 100 ? `<span class="text-warning fw-bold">Limit Reached</span>` : `${FREE_PRESCRIPTION_LIMIT - currentCount} remaining`;

    usageElement.innerHTML = `
        <div class="usage-counter">
            <h5><i class="fas fa-chart-line"></i> Monthly Usage: ${statusText}</h5>
            <p>${currentCount} of ${FREE_PRESCRIPTION_LIMIT} free prescriptions used</p>
            <div class="progress">
                <div class="progress-bar" role="progressbar" style="${progressBarStyle}"></div>
            </div>
            <small>Upgrade for unlimited prescriptions</small>
        </div>
    `;
}

async function checkActiveSubscription(userId) {
    try {
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();

        if (subscriptionDoc.exists) {
            const subscription = subscriptionDoc.data();
            const now = new Date();
            
            if (subscription.expiryDate && typeof subscription.expiryDate.toDate === 'function') {
                const expiryDate = subscription.expiryDate.toDate();
                
                const isActive = expiryDate > now;
                let remainingDays = 0;
                
                if (isActive) {
                    const diffTime = expiryDate.getTime() - now.getTime();
                    remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                }
                
                return {
                    active: isActive,
                    plan: subscription.plan,
                    expiryDate: expiryDate,
                    remainingDays: remainingDays
                };
            }
        }

        return { active: false };
    } catch (error) {
        throw error; // Propagate error for resilience check in checkPrescriptionLimit
    }
}

async function updateSubscriptionStatus() {
    const user = auth.currentUser;
    if (!user) return;

    const subscription = await checkActiveSubscription(user.uid);
    const statusElement = document.getElementById('subscriptionStatus');
    
    // Update global status
    isPremium = subscription.active; 
    
    if (statusElement) {
        if (subscription.active) {
            const expiryDate = subscription.expiryDate.toLocaleDateString();
            statusElement.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-crown"></i> 
                    <strong>Premium Member</strong> - Subscription active until ${expiryDate}
                </div>
            `;
        } else {
            statusElement.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-info-circle"></i>
                    <strong>Free Plan</strong> - ${FREE_PRESCRIPTION_LIMIT} prescriptions per month
                </div>
            `;
        }
    }
}

function addUsageCounterToDashboard() {
    const dashboardSection = document.getElementById('dashboardSection');
    if (dashboardSection) {
        const usageCounterHTML = `
            <div id="usageCounter">
                <!-- Usage counter will be dynamically updated -->
            </div>
        `;
        
        const welcomeText = document.getElementById('dashboardWelcomeText');
        if (welcomeText) {
            welcomeText.insertAdjacentHTML('afterend', usageCounterHTML);
        }
        
        const subscriptionStatusHTML = `
            <div id="subscriptionStatus" class="mb-4">
                <!-- Subscription status will be dynamically updated -->
            </div>
        `;
        
        const statsFilters = document.querySelector('.stats-filters');
        if (statsFilters) {
            statsFilters.insertAdjacentHTML('beforebegin', subscriptionStatusHTML);
        }
    }
}

async function updatePremiumUI() {
    const user = auth.currentUser;
    if (!user) return;

    const subscription = await checkActiveSubscription(user.uid);
    isPremium = subscription.active; // Re-set global status
    const remainingDays = subscription.remainingDays || 0;
    
    const daysCountDisplay = isPremium && remainingDays > 0 ? `(${remainingDays}d)` : '';

    const navStatusContainer = document.getElementById('navSubscriptionStatus');
    const navBuyButtonContainer = document.getElementById('navBuyPremiumButton'); 
    
    if (navStatusContainer) {
        if (isPremium) {
            navStatusContainer.innerHTML = `<span class="badge bg-success" title="Premium until ${subscription.expiryDate.toLocaleDateString()}"><i class="fas fa-crown me-1"></i> Premium ${daysCountDisplay}</span>`;
            if (navBuyButtonContainer) navBuyButtonContainer.innerHTML = '';
        } else {
            navStatusContainer.innerHTML = `<span class="badge bg-warning" title="Free plan - ${FREE_PRESCRIPTION_LIMIT} prescriptions/month"><i class="fas fa-user me-1"></i> Free</span>`;
            if (navBuyButtonContainer) {
                navBuyButtonContainer.innerHTML = `<button onclick="showPaymentModal()" class="btn btn-sm btn-primary ms-2" style="background: var(--premium-gold); color: var(--premium-navy); border: none; font-weight: 600; padding: 6px 12px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><i class="fas fa-arrow-up"></i></button>`;
            }
        }
    }
    
    const mobileStatusElement = document.getElementById('mobileSubscriptionStatus');
    const mobileBuyButtonElement = document.getElementById('mobileBuyPremiumButton'); 
    
    if (mobileStatusElement && mobileBuyButtonElement) {
        if (isPremium) {
            mobileStatusElement.innerHTML = `<div class="text-center"><span class="badge bg-success mb-2"><i class="fas fa-crown"></i> Premium Member ${daysCountDisplay}</span><br><small class="text-muted">Valid until ${subscription.expiryDate.toLocaleDateString()}</small></div>`;
            mobileBuyButtonElement.innerHTML = '';
        } else {
            mobileStatusElement.innerHTML = `<div class="text-center"><span class="badge bg-warning mb-2"><i class="fas fa-user"></i> Free Plan</span><br><small class="text-muted">${FREE_PRESCRIPTION_LIMIT} prescriptions/month</small></div>`;
            mobileBuyButtonElement.innerHTML = `<div class="text-center mt-3"><button onclick="showPaymentModal()" class="btn btn-primary w-75" style="background: var(--premium-navy); border: none; font-weight: 600;"><i class="fas fa-arrow-up"></i> Buy Premium</button></div>`;
        }
    }

    const premiumTag = document.getElementById('profilePremiumTag');
    
    if (premiumTag) {
        if (isPremium) {
            premiumTag.innerHTML = `<span class="badge bg-success ms-2" title="Premium until ${subscription.expiryDate.toLocaleDateString()}"><i class="fas fa-crown me-1"></i> PREMIUM ${daysCountDisplay}</span>`;
        } else {
            premiumTag.innerHTML = '';
        }
    }
}

// --- NEW FUNCTION: Show prompt for premium features ---
function showPremiumFeaturePrompt() {
    const modal = document.getElementById('premiumFeaturePromptModal');
    if (modal) {
        const messageElement = modal.querySelector('p.text-muted');
        if (messageElement) {
            messageElement.innerHTML = `This feature (e.g., **Export, Delete, Templates**) requires a **Premium Subscription**.`;
        }
        modal.style.display = 'flex';
    }
    showStatusMessage(`This feature is premium-only. Please upgrade.`, 'warning');
}

function closePremiumFeaturePrompt() {
    const modal = document.getElementById('premiumFeaturePromptModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
// --------------------------------------------------------

function showLimitReachedPrompt() {
    const modal = document.getElementById('limitReachedPromptModal');
    if (modal) {
        const messageElement = modal.querySelector('p.text-muted');
        if (messageElement) {
            messageElement.innerHTML = `You have used all **<span class="fw-bold">${FREE_PRESCRIPTION_LIMIT} free prescriptions</span>** for this month.`;
        }
        modal.style.display = 'flex';
    }
    showStatusMessage(`You've hit the monthly limit of ${FREE_PRESCRIPTION_LIMIT} free prescriptions.`, 'warning');
}

function closeLimitReachedPrompt() {
    const modal = document.getElementById('limitReachedPromptModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function updatePlanPrices() {
    const monthlyPrice = SUBSCRIPTION_PLANS.MONTHLY.amount;
    const yearlyPrice = SUBSCRIPTION_PLANS.YEARLY.amount;
    
    const monthlyPriceElement = document.querySelector('.monthly-plan .price');
    const monthlyPlan = document.querySelector('.monthly-plan');
    if (monthlyPriceElement && monthlyPlan) {
        monthlyPriceElement.textContent = `₹${monthlyPrice}`;
    }
    
    const yearlyPriceElement = document.querySelector('.yearly-plan .price');
    const yearlyPlan = document.querySelector('.yearly-plan');
    if (yearlyPriceElement && yearlyPlan) {
        yearlyPriceElement.textContent = `₹${yearlyPrice}`;
        
        const monthlyCost = monthlyPrice * 12;
        const savings = monthlyCost - yearlyPrice;
        const savingsPercentage = Math.round((savings / monthlyCost) * 100);
        
        const savingsElement = yearlyPlan.querySelector('.savings');
        if (savingsElement) {
            savingsElement.textContent = `Save ${savingsPercentage}%`;
        }
    }
}

function showPaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'flex';
        updatePlanPrices();
        selectPlan('yearly');
    }
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function selectPlan(planType) {
    selectedPlan = planType;
    
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    document.querySelectorAll(`.${planType}-plan`).forEach(card => {
        card.classList.add('selected');
    });
    
    document.getElementById(`${planType}Plan`).checked = true;
}

async function proceedToPayment() {
    if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID === 'DISABLED') {
        showStatusMessage('Payment system is currently unavailable. Please try again later.', 'error');
        return;
    }

    const plan = SUBSCRIPTION_PLANS[selectedPlan.toUpperCase()];
    if (!plan) {
        showStatusMessage('Invalid plan selected.', 'error');
        return;
    }

    try {
        document.getElementById('paymentProcessingModal').style.display = 'flex';

        const options = {
            key: RAZORPAY_KEY_ID,
            amount: plan.amount * 100, 
            currency: 'INR',
            name: 'Lens Prescription',
            description: `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Subscription`,
            handler: async function(response) {
                await handlePaymentSuccess(response, selectedPlan, plan.amount);
            },
            prefill: {
                name: auth.currentUser.displayName || '',
                email: auth.currentUser.email
            },
            theme: {
                color: '#007bff'
            },
            modal: {
                ondismiss: function() {
                    document.getElementById('paymentProcessingModal').style.display = 'none';
                }
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.open();
        
        document.getElementById('paymentProcessingModal').style.display = 'none';

    } catch (error) {
        document.getElementById('paymentProcessingModal').style.display = 'none';
        showStatusMessage('Payment failed: ' + error.message, 'error');
    }
}

async function handlePaymentSuccess(paymentResponse, planType, amount) {
    try {
        const user = auth.currentUser;
        
        const now = new Date();
        const plan = SUBSCRIPTION_PLANS[planType.toUpperCase()];
        const expiryDate = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);

        await db.collection('subscriptions').doc(user.uid).set({
            userId: user.uid,
            plan: planType,
            amount: amount,
            paymentId: paymentResponse.razorpay_payment_id,
            orderId: paymentResponse.razorpay_order_id,
            signature: paymentResponse.razorpay_signature,
            purchaseDate: firebase.firestore.FieldValue.serverTimestamp(),
            expiryDate: expiryDate,
            status: 'active'
        });

        closePaymentModal();
        showStatusMessage('Payment successful! Your subscription is now active.', 'success');
        
        setTimeout(() => {
            // After successful payment, setting isPremium to true and reloading ensures all locks are removed
            isPremium = true; 
            window.location.reload(); 
        }, 2000);

    } catch (error) {
        showStatusMessage('Payment verification failed. Please contact support.', 'error');
    }
}


// -----------------------------------------------------------
// 9. Utility Functions (Unchanged)
// -----------------------------------------------------------

function handleBrowserBack(event) {
    const currentState = history.state?.page;
    
    if (currentState === 'setup' && !isProfileComplete) {
        history.pushState({ page: 'setup' }, 'Profile Setup', 'app.html#setup');
        showStatusMessage('Please save your profile details to continue.', 'warning');
        return;
    }
    
    if (currentState === 'form' && isFormFilled) {
        const modal = document.getElementById('exitPromptModal');
        if (modal) modal.style.display = 'flex';
        history.pushState({ page: 'form' }, 'Add Prescription', 'app.html#form');
    }
}

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

function setupInputValidation() {
    const ageInput = document.getElementById('age');
    if (ageInput) {
        ageInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    const prescriptionInputs = [
        { id: 'rightDistSPH', type: 'number' }, { id: 'rightDistCYL', type: 'number' }, 
        { id: 'rightDistAXIS', type: 'number' }, { id: 'rightDistVA', type: 'va' },
        { id: 'leftDistSPH', type: 'number' }, { id: 'leftDistCYL', type: 'number' }, 
        { id: 'leftDistAXIS', type: 'number' }, { id: 'leftDistVA', type: 'va' },
        { id: 'rightAddSPH', type: 'number' }, { id: 'rightAddCYL', type: 'number' }, 
        { id: 'rightAddAXIS', type: 'number' }, { id: 'rightAddVA', type: 'va' },
        { id: 'leftAddSPH', type: 'number' }, { id: 'leftAddCYL', type: 'number' }, 
        { id: 'leftAddAXIS', type: 'number' }, { id: 'leftAddVA', type: 'va' }
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

async function fetchDashboardStats() {
    const period = document.getElementById('statsTimePeriod').value;
    const user = auth.currentUser;
    if (!user) return;
    
    let startDate = new Date();
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999); 

    switch (period) {
        case 'daily':
            startDate.setHours(0, 0, 0, 0); 
            break;
        case 'weekly':
            startDate.setDate(startDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'monthly':
            startDate.setMonth(startDate.getMonth() - 1);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'all':
            startDate = new Date(0); 
            break;
    }
    
    if (period !== 'all') {
        startDate.setHours(0, 0, 0, 0);
    }
    
    let baseQuery = db.collection('prescriptions')
        .where('userId', '==', user.uid);
    
    if (period !== 'all') {
        baseQuery = baseQuery.where('createdAt', '>=', startDate);
    }
    
    if (period !== 'all' || endDate.getTime() !== new Date(2300, 0, 1).getTime()) { 
        baseQuery = baseQuery.where('createdAt', '<=', endDate);
    }

    try {
        const querySnapshot = await baseQuery.get();
        let totalPrescriptions = 0;
        let totalRevenue = 0;
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            totalPrescriptions += 1;
            totalRevenue += (data.amount || 0);
        });
        
        document.getElementById('statPrescriptions').textContent = totalPrescriptions.toString();
        document.getElementById('statRevenue').textContent = `₹ ${totalRevenue.toFixed(2)}`;
        
    } catch (error) {
        document.getElementById('statPrescriptions').textContent = 'N/A';
        document.getElementById('statRevenue').textContent = '₹ N/A';
        showStatusMessage('Failed to load dashboard stats.', 'error');
    }
}

async function fetchReportDataByRange() {
    const user = auth.currentUser;
    if (!user) return;

    const startDateInput = document.getElementById('reportDateStart').value;
    const endDateInput = document.getElementById('reportDateEnd').value;
    
    if (!startDateInput || !endDateInput) {
        showStatusMessage('Please select both start and end dates for the report.', 'warning');
        return;
    }

    let startDate = new Date(startDateInput);
    let endDate = new Date(endDateInput);
    
    endDate.setHours(23, 59, 59, 999);
    
    if (startDate > endDate) {
        showStatusMessage('Start date cannot be after end date.', 'error');
        return;
    }
    
    try {
        const querySnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', startDate)
            .where('createdAt', '<=', endDate)
            .orderBy('createdAt', 'asc')
            .get();

        const prescriptions = [];
        querySnapshot.forEach((doc) => {
            prescriptions.push(doc.data());
        });

        const reportData = processReportDataByDate(prescriptions);
        displayReport(reportData);
        
    } catch (error) {
        showStatusMessage('Error fetching report data. Check console for details.', 'error');
    }
}

function processReportDataByDate(prescriptions) {
    const reportData = {};
    let totalPrescriptions = 0;
    let totalRevenue = 0;
    
    prescriptions.forEach((data) => {
        const timestamp = data.createdAt;
        if (!timestamp || typeof timestamp.toDate !== 'function') return;
        
        const date = timestamp.toDate();
        const key = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        
        if (!reportData[key]) {
            reportData[key] = { prescriptions: 0, totalAmount: 0 };
        }
        
        const amount = data.amount || 0;
        
        reportData[key].prescriptions += 1;
        reportData[key].totalAmount += amount;
        totalPrescriptions += 1;
        totalRevenue += amount;
    });
    
    return { dailyData: reportData, totalPrescriptions, totalRevenue };
}

function displayReport(reportSummary) {
    const tbody = document.getElementById('reportTable')?.getElementsByTagName('tbody')[0];
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const { dailyData, totalPrescriptions, totalRevenue } = reportSummary;

    if (!dailyData || Object.keys(dailyData).length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No data available for the selected range</td></tr>';
    } else {
        Object.entries(dailyData).forEach(([date, report]) => {
            const row = tbody.insertRow();
            row.insertCell().textContent = date;
            row.insertCell().textContent = report.prescriptions;
            row.insertCell().textContent = `₹${report.totalAmount.toFixed(2)}`;
        });
    }
    
    document.getElementById('reportTotalPrescriptions').textContent = totalPrescriptions.toString();
    document.getElementById('reportTotalRevenue').textContent = `₹ ${totalRevenue.toFixed(2)}`;
}

// -----------------------------------------------------------
// 10. Feature Locking (New Function)
// -----------------------------------------------------------
function lockFeatures() {
    const templateSaveBtn = document.querySelector('#prescriptionFormSection .template-management-bar .btn-tertiary');
    const previewDownloadBtn = document.querySelector('#previewSection .btn-download');
    const previewPrintBtn = document.querySelector('#previewSection .btn-print');
    const previewWhatsAppBtn = document.querySelector('#previewSection .btn-whatsapp');
    const prescriptionDeleteBtns = document.querySelectorAll('#prescriptionTable .btn-delete');
    
    // Lock functions are handled by individual function wrappers (submitPrescription, etc.)
    // Here we handle the UI visual locks/unlocks
    
    const elementsToLock = [templateSaveBtn, previewDownloadBtn, previewPrintBtn, previewWhatsAppBtn];
    
    if (!isPremium) {
        // Apply lock styling and override clicks if necessary
        elementsToLock.forEach(el => {
            if (el) {
                el.classList.add('btn-disabled');
                el.title = 'Premium feature - Upgrade to unlock';
            }
        });

        prescriptionDeleteBtns.forEach(el => {
             if (el) {
                el.classList.add('btn-disabled');
                el.title = 'Premium feature - Delete requires subscription';
            }
        });
        
    } else {
        // Remove lock styling and restore functionality where needed
         elementsToLock.forEach(el => {
            if (el) {
                el.classList.remove('btn-disabled');
                el.title = '';
            }
        });

        prescriptionDeleteBtns.forEach(el => {
            if (el) {
                el.classList.remove('btn-disabled');
                el.title = 'Delete';
            }
        });
    }
}


// Global Exports
window.showDashboard = showDashboard;
window.showNotifications = showNotifications; // Export new function
window.showPrescriptionForm = showPrescriptionForm;
window.showPrescriptions = showPrescriptions;
window.showReports = showReports;
window.showPreview = showPreview;
window.showProfileSetup = showProfileSetup;
window.saveSetupProfile = saveSetupProfile;
window.submitPrescription = submitPrescription;
window.filterPrescriptions = filterPrescriptions;
window.generateImage = generateImage;
window.printPreview = printPreview;
window.sendWhatsApp = sendWhatsApp;
window.fetchReportDataByRange = fetchReportDataByRange;
window.fetchDashboardStats = fetchDashboardStats;
window.logoutUser = logoutUser;
window.installPWA = installPWA;
window.navigateIfProfileComplete = navigateIfProfileComplete; 
window.showLimitReachedPrompt = showLimitReachedPrompt;
window.closeLimitReachedPrompt = closeLimitReachedPrompt;
window.showPaymentModal = showPaymentModal;
window.closePaymentModal = closePaymentModal;
window.selectPlan = selectPlan;
window.proceedToPayment = proceedToPayment;

// New Feature Exports
window.showPatients = showPatients;
window.fetchPatients = fetchPatients;
window.filterPatients = filterPatients;
window.copyRightToLeft = copyRightToLeft;
window.showDeleteModal = showDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDeleteAction = confirmDeleteAction;
window.saveAsTemplate = saveAsTemplate;
window.loadTemplate = loadTemplate;
window.checkPatientExists = checkPatientExists;
// --- EXPORT NEW PREMIUM FEATURE PROMPT FUNCTION ---
window.showPremiumFeaturePrompt = showPremiumFeaturePrompt;

// Remote Config Export
window.initializeRemoteConfig = initializeRemoteConfig;
