// app.js - Consolidated from app.js and script.js

// Payment and Subscription Management
let RAZORPAY_KEY_ID = null;
let selectedPlan = 'yearly';

// Global Variables
let currentPrescriptionData = null;
let whatsappImageUrl = null;
let isFormFilled = false;
let deferredPrompt;
let IMGBB_API_KEY = null;
// Flag to track if the user profile is complete
let isProfileComplete = false;
// Store the last valid section to return to after setup
let lastValidSection = 'dashboard'; 
// --- NEW TIMER VARIABLES ---
let timerInterval;
let timerSeconds = 0;
// ---------------------------

// 🛑 CRITICAL FIX: Use onAuthStateChanged to prevent the redirect loop.
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // User is confirmed signed in. Initialize the application once the DOM is ready.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                initializeApp();
            });
        } else {
            initializeApp();
        }
    } else {
        // User is confirmed signed out. Redirect to the login page immediately.
        // NOTE: auth.html will handle the logic if they explicitly logged out.
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

    // Set current date first
    setCurrentDate();
    
    // Load user profile and check for completion
    loadUserProfile();
    
    // Load ImgBB API key
    loadImgbbApiKey();
    
    // Setup event listeners
    setupEventListeners();
    setupPWA(); // Enhanced PWA setup
    
    // Set initial date filter values for prescriptions and reports
    setInitialDateFilters();

    try {
        // Initialize payment system
        await initializePaymentSystem();
        
        // Add usage counter to dashboard
        addUsageCounterToDashboard();
        
        // Update subscription status (Dashboard only)
        await updateSubscriptionStatus();
        
        // Update premium status in nav and profile (NEW)
        await updatePremiumUI(); 
        
        // Check and update usage counter
        await checkPrescriptionLimit();
        
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error during app initialization:', error);
        // Continue with app initialization even if payment/subscription features fail
    }
}

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
    
    // Set end date to today for all
    endDateElements.forEach(el => {
        if (el) el.value = today;
    });

    // Set start date to 30 days ago for a default monthly view on initial load
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
    
    console.log('Setting current date:', todayDate);
    
    const currentDateElement = document.getElementById('currentDate');
    const previewCurrentDateElement = document.getElementById('previewcurrentDate');
    
    if (currentDateElement) {
        currentDateElement.textContent = todayDate;
        console.log('Current date element updated');
    }
    
    if (previewCurrentDateElement) {
        previewCurrentDateElement.textContent = todayDate;
        console.log('Preview date element updated');
    }
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
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
    if (history.state === null || history.state?.page === 'initial') {
        // FIX: Replaced with replaceState to prevent the initial load counting as a back button step
        // We set the initial page to the current hash if one exists, otherwise 'dashboard'
        const initialPage = window.location.hash.substring(1) || 'dashboard';
        history.replaceState({ page: initialPage }, initialPage, location.href); 
    }
    
    // Dashboard Stats listener
    const statsSelect = document.getElementById('statsTimePeriod');
    if (statsSelect) {
        statsSelect.addEventListener('change', fetchDashboardStats);
    }

    console.log('Event listeners setup completed');
}

function setupPWA() {
    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/LensPrescriptionApp/service-worker.js')
            .then((registration) => {
                console.log('Service Worker Registered:', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Service Worker update found!', newWorker);
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New content is available; please refresh.');
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch((error) => {
                console.log('Service Worker Registration Failed:', error);
            });

        // Listen for claiming of clients
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('Service Worker controller changed');
        });
    }
// Enhanced PWA Install Prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (event) => {
        console.log('PWA install prompt triggered');
        event.preventDefault();
        deferredPrompt = event;
        
        // Show install button
        showInstallPromotion();
        
        // Auto-show install prompt after 10 seconds if not dismissed
        setTimeout(() => {
            if (deferredPrompt) {
                showInstallPromotion();
            }
        }, 10000);
    });

    // Handle PWA installed event
    window.addEventListener('appinstalled', (event) => {
        console.log('PWA installed successfully!');
        deferredPrompt = null;
        hideInstallPromotion();
        
        // Track installation
        if (typeof gtag !== 'undefined') {
            gtag('event', 'install', {
                'event_category': 'PWA',
                'event_label': 'App Installation'
            });
        }
    });

    // Online/Offline detection
    window.addEventListener('online', () => {
        console.log('App is online');
        showOnlineStatus();
        syncOfflineData();
    });

    window.addEventListener('offline', () => {
        console.log('App is offline');
        showOfflineStatus();
    });

    // Initial online status check
    if (!navigator.onLine) {
        showOfflineStatus();
    }
}

// Install Promotion Functions
function showInstallPromotion() {
    // Remove existing install prompt if any
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
    
    // Auto-hide after 15 seconds
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

// Online/Offline Status Functions
function showOnlineStatus() {
    showStatusMessage('Back online', 'success');
}

function showOfflineStatus() {
    showStatusMessage('You are currently offline', 'warning');
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

// Offline Data Sync
function syncOfflineData() {
    // Check if there's any offline data to sync
    const offlinePrescriptions = JSON.parse(localStorage.getItem('offlinePrescriptions') || '[]');
    
    if (offlinePrescriptions.length > 0) {
        console.log('Syncing offline prescriptions:', offlinePrescriptions.length);
        // Implement your sync logic here
    }
}

// Enhanced PWA Installation Function
function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === "accepted") {
                console.log("User accepted the install prompt");
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'install_prompt_accepted', {
                        'event_category': 'PWA',
                        'event_label': 'Install Prompt'
                    });
                }
            } else {
                console.log("User dismissed the install prompt");
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'install_prompt_dismissed', {
                        'event_category': 'PWA',
                        'event_label': 'Install Prompt'
                    });
                }
            }
            deferredPrompt = null;
            hideInstallPromotion();
        });
    }
}


// Navigation Functions

/**
 * Checks if profile is complete before navigating. Forces user to setup screen if not.
 * @param {function} navFunction The function to call if profile is complete.
 * @param {string} sectionName The name of the section we are trying to navigate to.
 */
function navigateIfProfileComplete(navFunction, sectionName) {
    if (isProfileComplete) {
        // Ensure navigation is enabled before proceeding
        enableNavigationButtons();
        
        // **FIX**: Use replaceState here instead of pushState for navigation Clicks.
        // This stops back button from cycling through internal nav clicks, but ensures the
        // URL is updated for the user to copy/reload.
        const hash = sectionName === 'dashboard' ? 'dashboard' : 
                     sectionName === 'form' ? 'form' : 
                     sectionName === 'prescriptions' ? 'prescriptions' : 
                     sectionName === 'reports' ? 'reports' : 'setup';

        // Use replaceState to update the URL without polluting the browser history for internal navigation
        history.replaceState({ page: sectionName }, sectionName, `app.html#${hash}`);

        navFunction();
        lastValidSection = sectionName; // Update last valid section
    } else {
        showProfileSetup(true); // Force profile setup
    }
}

// NEW FUNCTION: Handles routing based on the URL hash
function routeToHashedSection() {
    const hash = window.location.hash.substring(1); // Get hash without '#'

    switch (hash) {
        case 'dashboard':
            showDashboard();
            break;
        case 'form':
            showPrescriptionForm();
            break;
        case 'prescriptions':
            showPrescriptions();
            break;
        case 'reports':
            showReports();
            break;
        case 'setup':
            showProfileSetup(false);
            break;
        default:
            // Default to dashboard if no valid hash is found
            showDashboard();
            break;
    }
}

function showDashboard() {
    // We only call navigateIfProfileComplete from external events or if we want to ensure setup is done.
    // When called from routeToHashedSection, we assume profile completion has been verified.
    hideAllSections();
    const dashboardSection = document.getElementById('dashboardSection');
    if (dashboardSection) dashboardSection.classList.add('active');
    updateActiveNavLink('showDashboard'); // Use function name for targeting
    
    // Fetch dashboard stats on load, defaulting to daily
    document.getElementById('statsTimePeriod').value = 'daily';
    fetchDashboardStats();
}

function showPrescriptionForm() {
    hideAllSections();
    const formSection = document.getElementById('prescriptionFormSection');
    if (formSection) formSection.classList.add('active');
    updateActiveNavLink('showPrescriptionForm'); // Use function name for targeting
    
    lastValidSection = 'form';
}

function showPrescriptions() {
    hideAllSections();
    const prescriptionsSection = document.getElementById('prescriptionsSection');
    if (prescriptionsSection) prescriptionsSection.classList.add('active');
    updateActiveNavLink('showPrescriptions'); // Use function name for targeting
    
    // Load initial date filtered data
    fetchPrescriptions();
}

function showReports() {
    hideAllSections();
    const reportsSection = document.getElementById('reportsSection');
    if (reportsSection) reportsSection.classList.add('active');
    updateActiveNavLink('showReports'); // Use function name for targeting
    
    // Load initial report data based on default filters
    fetchReportDataByRange();
}

/**
 * Shows the dedicated profile setup screen.
 * @param {boolean} isForced True if the user is being forced to set up the profile (e.g., after registration).
 */
function showProfileSetup(isForced) {
    hideAllSections();
    const setupSection = document.getElementById('profileSetupSection');
    if (setupSection) setupSection.classList.add('active');
    
    // Disable navigation if forced
    if (isForced) {
        disableNavigationButtons();
    } else {
        // If not forced (user is just editing), keep navigation enabled
        enableNavigationButtons();
    }
    updateActiveNavLink('showProfileSetup'); // Set active state for the profile link

    // **FIX: Track where we're coming from for proper navigation back**
    const currentState = history.state?.page;
    if (currentState === 'form') {
        // If we're coming from the prescription form, remember that
        lastValidSection = 'form';
    }
    
    // Set the user's email in the display field
    const user = auth.currentUser;
    const emailDisplay = document.getElementById('userEmailDisplay');
    if (emailDisplay) {
        emailDisplay.textContent = user ? user.email : 'N/A';
        // Ensure the premium tag is updated when this page is shown (handles user going back to profile)
        updatePremiumUI();
    }

    // Hide continue button if just editing
    const saveBtn = document.getElementById('saveSetupProfileBtn');
    if (saveBtn) {
        saveBtn.textContent = isForced ? 'Save Profile & Continue' : 'Save Changes';
    }

    // Populate current data for editing (FIXED to fetch from localStorage)
    if (!isForced) {
        // If profile is already complete, use the data loaded in local storage
        const userData = JSON.parse(localStorage.getItem('userProfile') || '{}');
        
        document.getElementById('setupClinicName').value = userData.clinicName || '';
        document.getElementById('setupOptometristName').value = userData.optometristName || '';
        document.getElementById('setupAddress').value = userData.address || '';
        document.getElementById('setupContactNumber').value = userData.contactNumber || '';
    } else {
         // Clear fields for new user or prompt
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
    // No history push needed for preview since it's transient, but ensure back returns to list/form
}

function hideAllSections() {
    const sections = document.querySelectorAll('.page-section');
    sections.forEach(section => section.classList.remove('active'));
}

/**
 * Updates the active state of navigation links.
 * @param {string} activeFunction The name of the function called by the active link (e.g., 'showDashboard').
 */
function updateActiveNavLink(activeFunction) {
    const navLinks = document.querySelectorAll('.nav-link-custom');
    navLinks.forEach(link => {
        link.classList.remove('active');
        // Check both desktop and mobile links (based on the onclick attribute)
        if (link.getAttribute('onclick')?.includes(activeFunction)) {
            link.classList.add('active');
        }
    });
}

/**
 * Disables all main navigation buttons.
 */
function disableNavigationButtons() {
    const navButtons = document.querySelectorAll('.nav-link-custom');
    navButtons.forEach(btn => {
        btn.classList.add('nav-disabled');
    });
}

/**
 * Enables all main navigation buttons.
 */
function enableNavigationButtons() {
    const navButtons = document.querySelectorAll('.nav-link-custom');
    navButtons.forEach(btn => {
        btn.classList.remove('nav-disabled');
    });
}

// User Profile Management
async function loadUserProfile() {
    const user = auth.currentUser;
    if (!user) {
        console.error('No user logged in');
        return;
    }

    console.log('Loading user profile for:', user.uid);

    // Check for fresh registration flag
    const isFreshRegistration = localStorage.getItem('freshRegistration') === 'true';
    if (isFreshRegistration) {
        localStorage.removeItem('freshRegistration');
    }
    
    let userData = null;

    try {
        const doc = await db.collection('users').doc(user.uid).get();
        
        if (doc.exists) {
            userData = doc.data();
            console.log('Loaded user profile from Firestore:', userData);
            
            // Check if profile is sufficiently complete
            const isDataValid = userData.clinicName && userData.optometristName;
            
            if (isDataValid) {
                isProfileComplete = true;
                updateProfileUI(userData);
                localStorage.setItem('userProfile', JSON.stringify(userData));
                // Ensure buttons are enabled if loading dashboard successfully
                enableNavigationButtons(); 
                
                // CRITICAL FIX: Route to the section defined in the URL hash immediately after load
                routeToHashedSection(); 
                return;
            }
            
            // If document exists but is incomplete/placeholder (e.g., from an old flow)
            console.warn('User profile found but incomplete. Forcing setup.');
            isProfileComplete = false;
            // showProfileSetup(true) will be called, which handles disabling buttons
            showProfileSetup(true);

        } else {
            console.log('No user profile found in Firestore. Forcing setup.');
            
            // This is a brand new user after registration (or an old user whose doc was deleted)
            isProfileComplete = false;
            // showProfileSetup(true) will be called, which handles disabling buttons
            showProfileSetup(true);
        }
    } catch (error) {
        console.error('Error loading user profile from Firestore:', error);
        // Fallback to local storage or force setup if there's an error
        const localProfile = localStorage.getItem('userProfile');
        if (localProfile) {
            console.log('Firestore failed, using localStorage backup.');
            userData = JSON.parse(localProfile);
            isProfileComplete = userData.clinicName && userData.optometristName;
            updateProfileUI(userData);
            if (isProfileComplete) {
                enableNavigationButtons();
                // CRITICAL FIX: Route to the section defined in the URL hash immediately after load
                routeToHashedSection();
            } else {
                showProfileSetup(true);
            }
        } else {
            console.error('No backup profile available, forcing setup.');
            isProfileComplete = false;
            showProfileSetup(true);
        }
    }
}

/**
 * Saves the profile from the dedicated Profile Setup screen.
 */
async function saveSetupProfile() {
    const user = auth.currentUser;
    if (!user) {
        console.error('No user logged in');
        return;
    }

    const updatedData = {
        clinicName: document.getElementById('setupClinicName').value.trim(),
        optometristName: document.getElementById('setupOptometristName').value.trim(),
        address: document.getElementById('setupAddress').value.trim(),
        contactNumber: document.getElementById('setupContactNumber').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        email: user.email // Ensure email is saved with profile data
    };
    
    // Enhanced validation (basic check)
    if (!updatedData.clinicName || !updatedData.optometristName) {
        alert('Clinic Name and Optometrist Name are required to continue.');
        return;
    }

    try {
        const saveBtn = document.getElementById('saveSetupProfileBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        // Use set to save or update the profile
        await db.collection('users').doc(user.uid).set(updatedData, { merge: true });
        
        console.log('Profile setup/updated successfully!');
        
        // Update flags and UI
        isProfileComplete = true;
        updateProfileUI(updatedData);
        localStorage.setItem('userProfile', JSON.stringify(updatedData));
        
        // **FIX: Re-enable navigation explicitly**
        enableNavigationButtons();

        // **FIX: Determine where to navigate after saving**
        // Check if we came from the prescription form (edit profile scenario)
        const cameFromPrescriptionForm = document.getElementById('prescriptionFormSection')?.classList.contains('active') || 
                                        lastValidSection === 'form';
        
        if (cameFromPrescriptionForm) {
            // If editing profile from prescription form, go back to form
            navigateIfProfileComplete(showPrescriptionForm, 'form');
        } else {
            // Default to dashboard
            navigateIfProfileComplete(showDashboard, 'dashboard');
        }

    } catch (error) {
        console.error('Error saving profile:', error);
        alert('Error saving profile: ' + error.message);
    } finally {
        const saveBtn = document.getElementById('saveSetupProfileBtn');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Profile & Continue';
    }
}


function updateProfileUI(userData) {
    console.log('Updating UI with user data:', userData);
    
    if (!userData) {
        console.error('No user data provided to updateProfileUI');
        return;
    }
    
    // Update main form sections and preview sections
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

    // Update Dashboard Welcome Text
    const dashboardText = document.getElementById('dashboardWelcomeText');
    if (dashboardText) {
        dashboardText.textContent = `Welcome, ${userData.optometristName || 'Optometrist'}!`;
    }
    
    console.log('UI update completed');
}

// The old modal-based edit functions now redirect to the new setup screen
function openEditProfile() {
    // Hide the edit modal, as it's now handled by the dedicated section
    const modal = document.getElementById('editProfileModal');
    if (modal) modal.style.display = 'none'; 
    navigateIfProfileComplete(showProfileSetup, 'setup'); // Use navigateIfProfileComplete
}

function closeEditProfile() {
    const modal = document.getElementById('editProfileModal');
    if (modal) modal.style.display = 'none';
}

async function saveProfile() {
    // This function is for the modal, which is now deprecated.
    // We redirect to the main setup screen instead.
    alert('Please use the dedicated Edit Profile screen.');
    showProfileSetup(false);
}

// Prescription Management
async function submitPrescription() {
    if (!isProfileComplete) {
        alert('Please complete your Clinic Profile before adding prescriptions.');
        showProfileSetup(true);
        return;
    }

    // Check if user can submit prescription
    const canSubmit = await checkPrescriptionLimit();
    if (!canSubmit) {
        return;
    }
    
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
        
        // **IMPORTANT: Clear cached WhatsApp image URL for a new prescription**
        whatsappImageUrl = null; 
        
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

    const startDateInput = document.getElementById('prescriptionDateStart').value;
    const endDateInput = document.getElementById('prescriptionDateEnd').value;
    
    // Basic date validation
    if (startDateInput && endDateInput && new Date(startDateInput) > new Date(endDateInput)) {
        showStatusMessage('Start date cannot be after end date.', 'error');
        return;
    }

    const startDate = startDateInput ? new Date(startDateInput) : null;
    const endDate = endDateInput ? new Date(endDateInput) : null;
    
    // Set end time to end of day for inclusive filtering
    if (endDate) {
        endDate.setHours(23, 59, 59, 999);
    }
    
    let baseQuery = db.collection('prescriptions')
        .where('userId', '==', user.uid);

    if (startDate) {
        baseQuery = baseQuery.where('createdAt', '>=', startDate);
    }
    
    if (endDate) {
        baseQuery = baseQuery.where('createdAt', '<=', endDate);
    }

    try {
        const querySnapshot = await baseQuery.orderBy('createdAt', 'desc').get();

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
        showStatusMessage('Error fetching prescriptions. Check console for details.', 'error');
    }
}

function displayPrescriptions(data) {
    const tbody = document.getElementById('prescriptionTable')?.getElementsByTagName('tbody')[0];
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center">No prescriptions found for selected filters</td></tr>';
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
    
    // Re-apply text-based filter after new data load
    filterPrescriptions();
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
    const finalGrouped = {};
    Object.keys(grouped).forEach(group => {
        if (grouped[group].length > 0) {
            finalGrouped[group] = grouped[group];
        }
    });

    return finalGrouped;
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

    // Action buttons
    const actionCell = row.insertCell();
    actionCell.innerHTML = `
        <button class="btn btn-sm btn-outline-primary" onclick="viewPrescription('${prescription.id}')">
            <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deletePrescription('${prescription.id}')">
            <i class="fas fa-trash"></i>
        </button>
    `;
}

function filterPrescriptions() {
    const searchTerm = document.getElementById('prescriptionSearch').value.toLowerCase();
    const table = document.getElementById('prescriptionTable');
    const rows = table?.getElementsByTagName('tbody')[0]?.getElementsByTagName('tr');
    
    if (!rows) return;
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // Skip group header rows
        if (row.cells.length === 1 && row.cells[0].className === 'prescription-group-header') {
            continue;
        }
        
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    }
}

function viewPrescription(prescriptionId) {
    // Navigate to preview with the specific prescription ID
    // This will be handled in the preview section
    console.log('View prescription:', prescriptionId);
    // You can implement this by fetching the specific prescription and showing preview
}

function deletePrescription(prescriptionId) {
    if (!confirm('Are you sure you want to delete this prescription?')) {
        return;
    }
    
    db.collection('prescriptions').doc(prescriptionId).delete()
        .then(() => {
            console.log('Prescription deleted successfully');
            fetchPrescriptions(); // Refresh the list
        })
        .catch((error) => {
            console.error('Error deleting prescription:', error);
        });
}

// Preview Management
function loadPreviewData(prescriptionData) {
    // Store the data for later use
    currentPrescriptionData = prescriptionData;
    
    // Update preview fields
    const fields = {
        'previewPatientName': prescriptionData.patientName,
        'previewAge': prescriptionData.age,
        'previewGender': prescriptionData.gender,
        'previewMobile': prescriptionData.mobile,
        'previewAmount': `₹${prescriptionData.amount?.toFixed(2) || '0.00'}`,
        'previewVisionType': prescriptionData.visionType,
        'previewLensType': prescriptionData.lensType,
        'previewFrameType': prescriptionData.frameType,
        'previewPaymentMode': prescriptionData.paymentMode,
        'previewDate': new Date().toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        })
    };
    
    Object.keys(fields).forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.textContent = fields[fieldId];
        }
    });
    
    // Update prescription data in preview
    const prescriptionFields = {
        'previewRightDistSPH': prescriptionData.prescriptionData?.rightDistSPH || '',
        'previewRightDistCYL': prescriptionData.prescriptionData?.rightDistCYL || '',
        'previewRightDistAXIS': prescriptionData.prescriptionData?.rightDistAXIS || '',
        'previewRightDistVA': prescriptionData.prescriptionData?.rightDistVA || '',
        'previewLeftDistSPH': prescriptionData.prescriptionData?.leftDistSPH || '',
        'previewLeftDistCYL': prescriptionData.prescriptionData?.leftDistCYL || '',
        'previewLeftDistAXIS': prescriptionData.prescriptionData?.leftDistAXIS || '',
        'previewLeftDistVA': prescriptionData.prescriptionData?.leftDistVA || '',
        'previewRightAddSPH': prescriptionData.prescriptionData?.rightAddSPH || '',
        'previewRightAddCYL': prescriptionData.prescriptionData?.rightAddCYL || '',
        'previewRightAddAXIS': prescriptionData.prescriptionData?.rightAddAXIS || '',
        'previewRightAddVA': prescriptionData.prescriptionData?.rightAddVA || '',
        'previewLeftAddSPH': prescriptionData.prescriptionData?.leftAddSPH || '',
        'previewLeftAddCYL': prescriptionData.prescriptionData?.leftAddCYL || '',
        'previewLeftAddAXIS': prescriptionData.prescriptionData?.leftAddAXIS || '',
        'previewLeftAddVA': prescriptionData.prescriptionData?.leftAddVA || ''
    };
    
    Object.keys(prescriptionFields).forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.textContent = prescriptionFields[fieldId];
        }
    });
    
    // Clear any previous WhatsApp image URL
    whatsappImageUrl = null;
}

function loadPreviewFromForm() {
    const formData = getFormData();
    loadPreviewData(formData);
}

function goBackFromPreview() {
    // Go back to the form or prescriptions list based on context
    if (lastValidSection === 'form') {
        showPrescriptionForm();
    } else {
        showPrescriptions();
    }
}

// WhatsApp Sharing
async function shareOnWhatsApp() {
    if (!currentPrescriptionData) {
        alert('No prescription data available to share.');
        return;
    }

    try {
        // Show loading state
        const whatsappBtn = document.querySelector('#previewSection .btn-success');
        if (whatsappBtn) {
            whatsappBtn.disabled = true;
            whatsappBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        }

        // Generate or use cached WhatsApp image
        if (!whatsappImageUrl) {
            whatsappImageUrl = await generateWhatsAppImage();
        }

        if (whatsappImageUrl) {
            // Create WhatsApp message
            const message = createWhatsAppMessage();
            const encodedMessage = encodeURIComponent(message);
            const encodedImageUrl = encodeURIComponent(whatsappImageUrl);
            
            // Create WhatsApp share URL
            const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
            
            // Open WhatsApp in a new tab
            window.open(whatsappUrl, '_blank');
        } else {
            throw new Error('Failed to generate prescription image');
        }

    } catch (error) {
        console.error('Error sharing on WhatsApp:', error);
        alert('Error sharing prescription: ' + error.message);
    } finally {
        // Reset button state
        const whatsappBtn = document.querySelector('#previewSection .btn-success');
        if (whatsappBtn) {
            whatsappBtn.disabled = false;
            whatsappBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Share on WhatsApp';
        }
    }
}

function createWhatsAppMessage() {
    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    
    return `👁️ *Prescription Details*\n\n` +
           `*Patient Details:*\n` +
           `Name: ${currentPrescriptionData.patientName}\n` +
           `Age: ${currentPrescriptionData.age}\n` +
           `Gender: ${currentPrescriptionData.gender}\n` +
           `Mobile: ${currentPrescriptionData.mobile}\n\n` +
           `*Prescription:*\n` +
           `Vision Type: ${currentPrescriptionData.visionType}\n` +
           `Lens Type: ${currentPrescriptionData.lensType}\n` +
           `Frame Type: ${currentPrescriptionData.frameType}\n` +
           `Amount: ₹${currentPrescriptionData.amount?.toFixed(2) || '0.00'}\n` +
           `Payment Mode: ${currentPrescriptionData.paymentMode}\n\n` +
           `*Clinic Details:*\n` +
           `${userProfile.clinicName || 'Your Clinic'}\n` +
           `${userProfile.optometristName || 'Optometrist'}\n` +
           `${userProfile.address || 'Clinic Address'}\n` +
           `Contact: ${userProfile.contactNumber || 'N/A'}\n\n` +
           `*Thank you for your visit!*`;
}

async function generateWhatsAppImage() {
    const previewElement = document.getElementById('prescriptionPreview');
    
    if (!previewElement) {
        throw new Error('Preview element not found');
    }

    try {
        // Use html2canvas to capture the preview
        const canvas = await html2canvas(previewElement, {
            scale: 2, // Higher quality
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });

        // Convert canvas to blob
        return new Promise((resolve, reject) => {
            canvas.toBlob(async (blob) => {
                try {
                    // Upload to ImgBB
                    const imageUrl = await uploadToImgBB(blob);
                    resolve(imageUrl);
                } catch (error) {
                    reject(error);
                }
            }, 'image/png');
        });

    } catch (error) {
        console.error('Error generating image:', error);
        throw new Error('Failed to generate prescription image');
    }
}

async function uploadToImgBB(blob) {
    if (!IMGBB_API_KEY) {
        throw new Error('Image upload service not configured');
    }

    const formData = new FormData();
    formData.append('image', blob);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            return data.data.url;
        } else {
            throw new Error(data.error?.message || 'Image upload failed');
        }
    } catch (error) {
        console.error('ImgBB upload error:', error);
        throw new Error('Failed to upload image: ' + error.message);
    }
}

// PDF Generation
async function downloadPDF() {
    if (!currentPrescriptionData) {
        alert('No prescription data available to download.');
        return;
    }

    try {
        // Show loading state
        const pdfBtn = document.querySelector('#previewSection .btn-primary');
        if (pdfBtn) {
            pdfBtn.disabled = true;
            pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add content to PDF
        await addPrescriptionToPDF(doc);
        
        // Generate and download PDF
        const fileName = `prescription_${currentPrescriptionData.patientName}_${Date.now()}.pdf`;
        doc.save(fileName);
        
        showStatusMessage('PDF downloaded successfully!', 'success');

    } catch (error) {
        console.error('Error generating PDF:', error);
        showStatusMessage('Error generating PDF: ' + error.message, 'error');
    } finally {
        // Reset button state
        const pdfBtn = document.querySelector('#previewSection .btn-primary');
        if (pdfBtn) {
            pdfBtn.disabled = false;
            pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Download PDF';
        }
    }
}

async function addPrescriptionToPDF(doc) {
    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    
    // Set initial coordinates
    let yPosition = 20;
    
    // Add clinic header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(userProfile.clinicName || 'Your Clinic Name', 105, yPosition, { align: 'center' });
    
    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(userProfile.address || 'Clinic Address', 105, yPosition, { align: 'center' });
    
    yPosition += 5;
    doc.text(`Contact: ${userProfile.contactNumber || 'N/A'}`, 105, yPosition, { align: 'center' });
    
    yPosition += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PRESCRIPTION', 105, yPosition, { align: 'center' });
    
    // Add patient details
    yPosition += 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Patient Details:', 20, yPosition);
    
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${currentPrescriptionData.patientName}`, 20, yPosition);
    doc.text(`Age: ${currentPrescriptionData.age}`, 100, yPosition);
    doc.text(`Gender: ${currentPrescriptionData.gender}`, 150, yPosition);
    
    yPosition += 7;
    doc.text(`Mobile: ${currentPrescriptionData.mobile}`, 20, yPosition);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 100, yPosition);
    
    // Add prescription details
    yPosition += 15;
    doc.setFont('helvetica', 'bold');
    doc.text('Prescription Details:', 20, yPosition);
    
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Vision Type: ${currentPrescriptionData.visionType}`, 20, yPosition);
    doc.text(`Lens Type: ${currentPrescriptionData.lensType}`, 100, yPosition);
    
    yPosition += 7;
    doc.text(`Frame Type: ${currentPrescriptionData.frameType}`, 20, yPosition);
    doc.text(`Amount: ₹${currentPrescriptionData.amount?.toFixed(2) || '0.00'}`, 100, yPosition);
    
    yPosition += 7;
    doc.text(`Payment Mode: ${currentPrescriptionData.paymentMode}`, 20, yPosition);
    
    // Add prescription data table
    yPosition += 15;
    addPrescriptionTableToPDF(doc, yPosition);
    
    // Add footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.text('Generated by Lens Prescription App', 105, pageHeight - 10, { align: 'center' });
}

function addPrescriptionTableToPDF(doc, startY) {
    const prescriptionData = currentPrescriptionData.prescriptionData;
    if (!prescriptionData) return startY;
    
    let yPosition = startY;
    
    // Table headers
    const headers = ['', 'SPH', 'CYL', 'AXIS', 'VA'];
    const colWidths = [30, 30, 30, 30, 30];
    const xStart = 20;
    
    // Draw table headers
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    
    let xPosition = xStart;
    headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
    });
    
    yPosition += 5;
    
    // Draw horizontal line
    doc.line(xStart, yPosition, xStart + colWidths.reduce((a, b) => a + b, 0), yPosition);
    yPosition += 5;
    
    // Distance Vision data
    doc.setFont('helvetica', 'bold');
    doc.text('Distance Vision', xStart, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    const distanceRows = [
        ['Right', prescriptionData.rightDistSPH, prescriptionData.rightDistCYL, prescriptionData.rightDistAXIS, prescriptionData.rightDistVA],
        ['Left', prescriptionData.leftDistSPH, prescriptionData.leftDistCYL, prescriptionData.leftDistAXIS, prescriptionData.leftDistVA]
    ];
    
    distanceRows.forEach(row => {
        xPosition = xStart;
        row.forEach((cell, index) => {
            doc.text(cell || '', xPosition, yPosition);
            xPosition += colWidths[index];
        });
        yPosition += 5;
    });
    
    yPosition += 5;
    
    // Near Vision data
    doc.setFont('helvetica', 'bold');
    doc.text('Near Vision', xStart, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    const nearRows = [
        ['Right', prescriptionData.rightAddSPH, prescriptionData.rightAddCYL, prescriptionData.rightAddAXIS, prescriptionData.rightAddVA],
        ['Left', prescriptionData.leftAddSPH, prescriptionData.leftAddCYL, prescriptionData.leftAddAXIS, prescriptionData.leftAddVA]
    ];
    
    nearRows.forEach(row => {
        xPosition = xStart;
        row.forEach((cell, index) => {
            doc.text(cell || '', xPosition, yPosition);
            xPosition += colWidths[index];
        });
        yPosition += 5;
    });
    
    return yPosition;
}

// Form Validation and Exit Handling
function checkFormFilled() {
    const requiredFields = ['patientName', 'age', 'patientMobile'];
    let filled = true;
    
    requiredFields.forEach(field => {
        const element = document.getElementById(field);
        if (element && !element.value.trim()) {
            filled = false;
        }
    });
    
    isFormFilled = filled;
}

function handleBrowserBack(event) {
    if (isFormFilled) {
        // Show exit confirmation modal
        document.getElementById('exitConfirmationModal').style.display = 'block';
        // Prevent the actual navigation
        history.pushState(null, document.title, location.href);
        event.preventDefault();
        return false;
    }
}

function confirmExitAction() {
    // User confirmed exit, reset form and allow navigation
    resetForm();
    document.getElementById('exitConfirmationModal').style.display = 'none';
    // Go back in history
    history.back();
}

function cancelExitAction() {
    // User canceled exit, hide modal and stay on page
    document.getElementById('exitConfirmationModal').style.display = 'none';
}

function setupInputValidation() {
    // Mobile number validation (10 digits)
    const mobileInput = document.getElementById('patientMobile');
    if (mobileInput) {
        mobileInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 10) {
                value = value.substring(0, 10);
            }
            e.target.value = value;
        });
    }

    // Age validation (1-120)
    const ageInput = document.getElementById('age');
    if (ageInput) {
        ageInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value) {
                const age = parseInt(value);
                if (age > 120) {
                    value = '120';
                }
            }
            e.target.value = value;
        });
    }

    // Amount validation (positive numbers)
    const amountInput = document.getElementById('amount');
    if (amountInput) {
        amountInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^\d.]/g, '');
            // Ensure only one decimal point
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            e.target.value = value;
        });
    }
}

// Dashboard Stats
async function fetchDashboardStats() {
    const user = auth.currentUser;
    if (!user) return;

    const timePeriod = document.getElementById('statsTimePeriod').value;
    let startDate = new Date();
    
    switch (timePeriod) {
        case 'daily':
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'weekly':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case 'monthly':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case 'yearly':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
    }

    try {
        const prescriptionsSnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', startDate)
            .get();

        let totalPatients = 0;
        let totalRevenue = 0;
        const visionTypeCount = {};
        const lensTypeCount = {};

        prescriptionsSnapshot.forEach(doc => {
            const data = doc.data();
            totalPatients++;
            totalRevenue += data.amount || 0;
            
            // Count vision types
            if (data.visionType) {
                visionTypeCount[data.visionType] = (visionTypeCount[data.visionType] || 0) + 1;
            }
            
            // Count lens types
            if (data.lensType) {
                lensTypeCount[data.lensType] = (lensTypeCount[data.lensType] || 0) + 1;
            }
        });

        // Update dashboard cards
        updateDashboardCards(totalPatients, totalRevenue, visionTypeCount, lensTypeCount);
        
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
    }
}

function updateDashboardCards(totalPatients, totalRevenue, visionTypeCount, lensTypeCount) {
    // Update basic stats
    const totalPatientsElement = document.getElementById('totalPatients');
    const totalRevenueElement = document.getElementById('totalRevenue');
    
    if (totalPatientsElement) {
        totalPatientsElement.textContent = totalPatients;
    }
    
    if (totalRevenueElement) {
        totalRevenueElement.textContent = `₹${totalRevenue.toFixed(2)}`;
    }
    
    // Update vision type chart
    updateVisionTypeChart(visionTypeCount);
    
    // Update lens type chart
    updateLensTypeChart(lensTypeCount);
}

function updateVisionTypeChart(visionTypeCount) {
    const ctx = document.getElementById('visionTypeChart')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (window.visionTypeChartInstance) {
        window.visionTypeChartInstance.destroy();
    }
    
    const labels = Object.keys(visionTypeCount);
    const data = Object.values(visionTypeCount);
    
    window.visionTypeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Vision Type Distribution'
                }
            }
        }
    });
}

function updateLensTypeChart(lensTypeCount) {
    const ctx = document.getElementById('lensTypeChart')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (window.lensTypeChartInstance) {
        window.lensTypeChartInstance.destroy();
    }
    
    const labels = Object.keys(lensTypeCount);
    const data = Object.values(lensTypeCount);
    
    window.lensTypeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Prescriptions',
                data: data,
                backgroundColor: '#36A2EB',
                borderColor: '#36A2EB',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Lens Type Distribution'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Reports Management
async function fetchReportDataByRange() {
    const user = auth.currentUser;
    if (!user) return;

    const startDateInput = document.getElementById('reportDateStart').value;
    const endDateInput = document.getElementById('reportDateEnd').value;
    
    // Basic date validation
    if (startDateInput && endDateInput && new Date(startDateInput) > new Date(endDateInput)) {
        showStatusMessage('Start date cannot be after end date.', 'error');
        return;
    }

    const startDate = startDateInput ? new Date(startDateInput) : null;
    const endDate = endDateInput ? new Date(endDateInput) : null;
    
    // Set end time to end of day for inclusive filtering
    if (endDate) {
        endDate.setHours(23, 59, 59, 999);
    }
    
    let baseQuery = db.collection('prescriptions')
        .where('userId', '==', user.uid);

    if (startDate) {
        baseQuery = baseQuery.where('createdAt', '>=', startDate);
    }
    
    if (endDate) {
        baseQuery = baseQuery.where('createdAt', '<=', endDate);
    }

    try {
        const querySnapshot = await baseQuery.orderBy('createdAt', 'desc').get();

        const prescriptions = [];
        querySnapshot.forEach((doc) => {
            prescriptions.push({
                id: doc.id,
                ...doc.data()
            });
        });

        generateReport(prescriptions);
    } catch (error) {
        console.error('Error fetching report data:', error);
        showStatusMessage('Error fetching report data. Check console for details.', 'error');
    }
}

function generateReport(prescriptions) {
    const reportBody = document.getElementById('reportBody');
    if (!reportBody) return;
    
    reportBody.innerHTML = '';

    if (!prescriptions || prescriptions.length === 0) {
        reportBody.innerHTML = '<tr><td colspan="9" class="text-center">No prescriptions found for selected date range</td></tr>';
        return;
    }

    let totalRevenue = 0;
    
    prescriptions.forEach(prescription => {
        const row = reportBody.insertRow();
        
        const date = new Date(prescription.date).toLocaleDateString('en-US', { 
            year: 'numeric', month: 'short', day: 'numeric' 
        });
        
        const fields = [
            date,
            prescription.patientName,
            prescription.age,
            prescription.gender,
            prescription.mobile,
            prescription.visionType,
            prescription.lensType,
            prescription.frameType,
            `₹${prescription.amount?.toFixed(2) || '0.00'}`
        ];

        fields.forEach((field) => {
            const cell = row.insertCell();
            cell.textContent = field;
        });
        
        totalRevenue += prescription.amount || 0;
    });

    // Update report summary
    updateReportSummary(prescriptions.length, totalRevenue);
}

function updateReportSummary(totalPrescriptions, totalRevenue) {
    const summaryElement = document.getElementById('reportSummary');
    if (!summaryElement) return;
    
    summaryElement.innerHTML = `
        <div class="report-summary-card">
            <h4>Report Summary</h4>
            <div class="summary-stats">
                <div class="stat-item">
                    <span class="stat-label">Total Prescriptions:</span>
                    <span class="stat-value">${totalPrescriptions}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Revenue:</span>
                    <span class="stat-value">₹${totalRevenue.toFixed(2)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Average per Prescription:</span>
                    <span class="stat-value">₹${totalPrescriptions > 0 ? (totalRevenue / totalPrescriptions).toFixed(2) : '0.00'}</span>
                </div>
            </div>
        </div>
    `;
}

async function exportReportToPDF() {
    const reportBody = document.getElementById('reportBody');
    if (!reportBody || reportBody.children.length === 0) {
        alert('No report data to export.');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add report title
        const startDate = document.getElementById('reportDateStart').value;
        const endDate = document.getElementById('reportDateEnd').value;
        const reportTitle = `Prescription Report (${startDate} to ${endDate})`;
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(reportTitle, 105, 20, { align: 'center' });
        
        // Add report data
        await addReportTableToPDF(doc);
        
        // Generate and download PDF
        const fileName = `prescription_report_${Date.now()}.pdf`;
        doc.save(fileName);
        
        showStatusMessage('Report exported successfully!', 'success');

    } catch (error) {
        console.error('Error exporting report:', error);
        showStatusMessage('Error exporting report: ' + error.message, 'error');
    }
}

async function addReportTableToPDF(doc) {
    const rows = document.querySelectorAll('#reportBody tr');
    let yPosition = 40;
    
    // Table headers
    const headers = ['Date', 'Patient', 'Age', 'Gender', 'Mobile', 'Vision Type', 'Lens Type', 'Frame Type', 'Amount'];
    const colWidths = [25, 25, 15, 20, 30, 25, 25, 25, 20];
    
    // Draw table headers
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    
    let xPosition = 10;
    headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
    });
    
    yPosition += 10;
    
    // Draw table rows
    doc.setFont('helvetica', 'normal');
    
    rows.forEach(row => {
        if (yPosition > 270) { // Check if we need a new page
            doc.addPage();
            yPosition = 20;
        }
        
        const cells = row.getElementsByTagName('td');
        xPosition = 10;
        
        for (let i = 0; i < cells.length; i++) {
            doc.text(cells[i].textContent, xPosition, yPosition);
            xPosition += colWidths[i];
        }
        
        yPosition += 10;
    });
}

// Payment and Subscription Management
async function initializePaymentSystem() {
    try {
        // Load Razorpay key from GitHub Secrets
        await loadRazorpayKey();
        
        // Check subscription status
        await checkSubscriptionStatus();
        
        console.log('Payment system initialized successfully');
    } catch (error) {
        console.error('Error initializing payment system:', error);
    }
}

async function loadRazorpayKey() {
    try {
        // Use GitHub Secrets environment variable
        const response = await fetch('/LensPrescriptionApp/api/get-razorpay-key');
        const data = await response.json();
        
        if (data.key) {
            RAZORPAY_KEY_ID = data.key;
            console.log('Razorpay key loaded successfully');
        } else {
            throw new Error('Razorpay key not found in response');
        }
    } catch (error) {
        console.error('Error loading Razorpay key:', error);
        throw error;
    }
}

async function loadImgbbApiKey() {
    try {
        // Use GitHub Secrets environment variable
        const response = await fetch('/LensPrescriptionApp/api/get-imgbb-key');
        const data = await response.json();
        
        if (data.key) {
            IMGBB_API_KEY = data.key;
            console.log('ImgBB API key loaded successfully');
        } else {
            throw new Error('ImgBB API key not found in response');
        }
    } catch (error) {
        console.error('Error loading ImgBB API key:', error);
        // Continue without image upload functionality
    }
}

async function checkSubscriptionStatus() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        const subscriptionStatus = document.getElementById('subscriptionStatus');
        const upgradeBtn = document.getElementById('upgradeBtn');
        
        if (userData?.subscription?.status === 'active') {
            // User has active subscription
            if (subscriptionStatus) {
                subscriptionStatus.innerHTML = '<span class="badge badge-success">Premium</span>';
            }
            if (upgradeBtn) {
                upgradeBtn.style.display = 'none';
            }
        } else {
            // User is on free tier
            if (subscriptionStatus) {
                subscriptionStatus.innerHTML = '<span class="badge badge-secondary">Free</span>';
            }
            if (upgradeBtn) {
                upgradeBtn.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error checking subscription status:', error);
    }
}

function openUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function selectPlan(plan) {
    selectedPlan = plan;
    
    // Update UI to show selected plan
    document.querySelectorAll('.plan-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    const selectedOption = document.querySelector(`[data-plan="${plan}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    // Update payment amount
    const amount = plan === 'yearly' ? 2999 : 299; // ₹299/month or ₹2999/year
    document.getElementById('paymentAmount').textContent = `₹${amount}`;
}

async function proceedToPayment() {
    if (!selectedPlan) {
        alert('Please select a plan');
        return;
    }

    if (!RAZORPAY_KEY_ID) {
        alert('Payment system not available. Please try again later.');
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert('Please login to continue');
        return;
    }

    const amount = selectedPlan === 'yearly' ? 2999 : 299; // in rupees
    const planName = selectedPlan === 'yearly' ? 'Yearly Premium' : 'Monthly Premium';

    try {
        // Create order on your backend
        const orderResponse = await fetch('/LensPrescriptionApp/api/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amount * 100, // Convert to paise
                currency: 'INR',
                plan: selectedPlan
            })
        });

        const orderData = await orderResponse.json();

        if (!orderData.id) {
            throw new Error('Failed to create order');
        }

        // Razorpay options
        const options = {
            key: RAZORPAY_KEY_ID,
            amount: amount * 100,
            currency: 'INR',
            name: 'Lens Prescription App',
            description: planName,
            order_id: orderData.id,
            handler: async function(response) {
                // Payment successful
                await handlePaymentSuccess(response, user.uid, selectedPlan, amount);
            },
            prefill: {
                name: user.displayName || '',
                email: user.email || ''
            },
            theme: {
                color: '#4f46e5'
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.open();

    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed: ' + error.message);
    }
}

async function handlePaymentSuccess(paymentResponse, userId, plan, amount) {
    try {
        // Verify payment with your backend
        const verifyResponse = await fetch('/LensPrescriptionApp/api/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                paymentId: paymentResponse.razorpay_payment_id,
                orderId: paymentResponse.razorpay_order_id,
                signature: paymentResponse.razorpay_signature,
                plan: plan,
                amount: amount
            })
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.success) {
            // Update user subscription in Firestore
            const subscriptionData = {
                subscription: {
                    status: 'active',
                    plan: plan,
                    amount: amount,
                    paymentId: paymentResponse.razorpay_payment_id,
                    orderId: paymentResponse.razorpay_order_id,
                    startDate: new Date().toISOString(),
                    endDate: plan === 'yearly' 
                        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 1 month
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(userId).set(subscriptionData, { merge: true });

            // Update UI
            await checkSubscriptionStatus();
            closeUpgradeModal();
            
            showStatusMessage('Subscription activated successfully!', 'success');
            
            // Track conversion
            if (typeof gtag !== 'undefined') {
                gtag('event', 'purchase', {
                    transaction_id: paymentResponse.razorpay_payment_id,
                    value: amount,
                    currency: 'INR',
                    items: [{
                        item_id: plan,
                        item_name: plan === 'yearly' ? 'Yearly Premium' : 'Monthly Premium',
                        price: amount,
                        quantity: 1
                    }]
                });
            }
        } else {
            throw new Error('Payment verification failed');
        }
    } catch (error) {
        console.error('Error handling payment success:', error);
        alert('Payment verification failed: ' + error.message);
    }
}

async function checkPrescriptionLimit() {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        // If user has active subscription, no limit
        if (userData?.subscription?.status === 'active') {
            return true;
        }

        // Check free tier limit (10 prescriptions per month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const prescriptionsSnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', startOfMonth)
            .get();

        const currentMonthCount = prescriptionsSnapshot.size;
        const freeLimit = 10;

        if (currentMonthCount >= freeLimit) {
            showPrescriptionLimitModal();
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error checking prescription limit:', error);
        return true; // Allow submission if there's an error
    }
}

function showPrescriptionLimitModal() {
    const modal = document.getElementById('limitModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeLimitModal() {
    const modal = document.getElementById('limitModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function addUsageCounterToDashboard() {
    const dashboardSection = document.getElementById('dashboardSection');
    if (!dashboardSection) return;

    // Check if usage counter already exists
    if (document.getElementById('usageCounter')) return;

    const usageCounter = document.createElement('div');
    usageCounter.id = 'usageCounter';
    usageCounter.className = 'usage-counter';
    usageCounter.innerHTML = `
        <div class="usage-counter-card">
            <div class="usage-counter-header">
                <i class="fas fa-chart-line"></i>
                <span>Monthly Usage</span>
            </div>
            <div class="usage-counter-body">
                <div class="usage-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" id="usageProgressFill"></div>
                    </div>
                    <div class="usage-text" id="usageText">0/10 prescriptions used</div>
                </div>
                <div class="usage-upgrade">
                    <small>Upgrade to Premium for unlimited prescriptions</small>
                    <button class="btn btn-primary btn-sm" onclick="openUpgradeModal()">Upgrade Now</button>
                </div>
            </div>
        </div>
    `;

    // Insert after dashboard stats
    const dashboardStats = document.querySelector('.dashboard-stats');
    if (dashboardStats) {
        dashboardStats.parentNode.insertBefore(usageCounter, dashboardStats.nextSibling);
    }

    // Update usage counter
    updateUsageCounter();
}

async function updateUsageCounter() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        // If user has active subscription, hide usage counter
        if (userData?.subscription?.status === 'active') {
            const usageCounter = document.getElementById('usageCounter');
            if (usageCounter) {
                usageCounter.style.display = 'none';
            }
            return;
        }

        // Calculate current month usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const prescriptionsSnapshot = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', startOfMonth)
            .get();

        const currentUsage = prescriptionsSnapshot.size;
        const freeLimit = 10;
        const percentage = Math.min((currentUsage / freeLimit) * 100, 100);

        // Update UI
        const progressFill = document.getElementById('usageProgressFill');
        const usageText = document.getElementById('usageText');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
            progressFill.className = `progress-fill ${percentage >= 80 ? 'warning' : ''}`;
        }
        
        if (usageText) {
            usageText.textContent = `${currentUsage}/${freeLimit} prescriptions used`;
            usageText.className = `usage-text ${percentage >= 80 ? 'warning' : ''}`;
        }

    } catch (error) {
        console.error('Error updating usage counter:', error);
    }
}

async function updateSubscriptionStatus() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        const subscriptionStatus = document.getElementById('subscriptionStatus');
        
        if (userData?.subscription?.status === 'active') {
            if (subscriptionStatus) {
                subscriptionStatus.innerHTML = '<span class="badge badge-success">Premium</span>';
            }
        } else {
            if (subscriptionStatus) {
                subscriptionStatus.innerHTML = '<span class="badge badge-secondary">Free</span>';
            }
        }
    } catch (error) {
        console.error('Error updating subscription status:', error);
    }
}

// NEW FUNCTION: Update Premium status in navigation and profile
async function updatePremiumUI() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        const isPremium = userData?.subscription?.status === 'active';
        
        // Update profile page premium status
        const premiumStatusElement = document.getElementById('premiumStatus');
        if (premiumStatusElement) {
            if (isPremium) {
                premiumStatusElement.innerHTML = '<span class="badge badge-success">Premium Member</span>';
            } else {
                premiumStatusElement.innerHTML = '<span class="badge badge-secondary">Free Plan</span>';
            }
        }
        
        // Update navigation premium indicator (if any)
        const navPremiumIndicator = document.querySelector('.nav-premium-indicator');
        if (navPremiumIndicator) {
            navPremiumIndicator.style.display = isPremium ? 'inline' : 'none';
        }
        
    } catch (error) {
        console.error('Error updating premium UI:', error);
    }
}

// Timer Functions for Prescription Form
function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerSeconds = 0;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timerSeconds++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function resetTimer() {
    stopTimer();
    timerSeconds = 0;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    const timerDisplay = document.getElementById('formTimer');
    
    if (timerDisplay) {
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Auto-save form data
function setupAutoSave() {
    const form = document.getElementById('prescriptionForm');
    if (!form) return;
    
    const autoSaveKey = 'prescriptionFormDraft';
    let autoSaveTimeout;
    
    // Load saved draft
    const savedDraft = localStorage.getItem(autoSaveKey);
    if (savedDraft) {
        try {
            const draftData = JSON.parse(savedDraft);
            loadFormDraft(draftData);
            console.log('Loaded auto-saved draft');
        } catch (error) {
            console.error('Error loading auto-saved draft:', error);
        }
    }
    
    // Auto-save on input
    form.addEventListener('input', function() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            const formData = getFormData();
            localStorage.setItem(autoSaveKey, JSON.stringify(formData));
            console.log('Auto-saved form data');
        }, 1000);
    });
    
    // Clear draft on successful submission
    const originalSubmit = window.submitPrescription;
    window.submitPrescription = async function() {
        await originalSubmit();
        localStorage.removeItem(autoSaveKey);
        resetTimer();
    };
}

function loadFormDraft(draftData) {
    if (!draftData) return;
    
    // Helper function to safely set values
    const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element && value !== undefined && value !== null) {
            element.value = value;
        }
    };
    
    // Load basic patient data
    setValue('patientName', draftData.patientName);
    setValue('age', draftData.age);
    setValue('gender', draftData.gender);
    setValue('patientMobile', draftData.mobile);
    setValue('amount', draftData.amount);
    setValue('visionType', draftData.visionType);
    setValue('lensType', draftData.lensType);
    setValue('frameType', draftData.frameType);
    setValue('paymentMode', draftData.paymentMode);
    
    // Load prescription data
    if (draftData.prescriptionData) {
        const pd = draftData.prescriptionData;
        setValue('rightDistSPH', pd.rightDistSPH);
        setValue('rightDistCYL', pd.rightDistCYL);
        setValue('rightDistAXIS', pd.rightDistAXIS);
        setValue('rightDistVA', pd.rightDistVA);
        setValue('leftDistSPH', pd.leftDistSPH);
        setValue('leftDistCYL', pd.leftDistCYL);
        setValue('leftDistAXIS', pd.leftDistAXIS);
        setValue('leftDistVA', pd.leftDistVA);
        setValue('rightAddSPH', pd.rightAddSPH);
        setValue('rightAddCYL', pd.rightAddCYL);
        setValue('rightAddAXIS', pd.rightAddAXIS);
        setValue('rightAddVA', pd.rightAddVA);
        setValue('leftAddSPH', pd.leftAddSPH);
        setValue('leftAddCYL', pd.leftAddCYL);
        setValue('leftAddAXIS', pd.leftAddAXIS);
        setValue('leftAddVA', pd.leftAddVA);
    }
    
    // Update form filled state
    checkFormFilled();
}

// Enhanced form validation with real-time feedback
function setupEnhancedValidation() {
    const form = document.getElementById('prescriptionForm');
    if (!form) return;
    
    const inputs = form.querySelectorAll('input[required], select[required]');
    
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            clearFieldError(this);
        });
    });
}

function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';
    
    switch (field.id) {
        case 'patientName':
            isValid = value.length >= 2;
            errorMessage = 'Name must be at least 2 characters long';
            break;
            
        case 'age':
            isValid = value && !isNaN(value) && value >= 1 && value <= 120;
            errorMessage = 'Please enter a valid age (1-120)';
            break;
            
        case 'patientMobile':
            isValid = /^\d{10}$/.test(value);
            errorMessage = 'Please enter a valid 10-digit mobile number';
            break;
            
        case 'amount':
            isValid = value && !isNaN(value) && value >= 0;
            errorMessage = 'Please enter a valid amount';
            break;
            
        default:
            if (field.required) {
                isValid = value !== '';
                errorMessage = 'This field is required';
            }
    }
    
    if (!isValid) {
        showFieldError(field, errorMessage);
    } else {
        clearFieldError(field);
    }
    
    return isValid;
}

function showFieldError(field, message) {
    clearFieldError(field);
    
    field.classList.add('is-invalid');
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'invalid-feedback';
    errorDiv.textContent = message;
    
    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(field) {
    field.classList.remove('is-invalid');
    
    const existingError = field.parentNode.querySelector('.invalid-feedback');
    if (existingError) {
        existingError.remove();
    }
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl+S or Cmd+S to save (prevent default and show message)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            showStatusMessage('Use the Submit button to save prescriptions', 'info');
        }
        
        // Escape key to go back
        if (e.key === 'Escape') {
            const previewSection = document.getElementById('previewSection');
            if (previewSection && previewSection.classList.contains('active')) {
                goBackFromPreview();
            }
        }
    });
}

// Initialize enhanced features when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Setup enhanced features
    setupAutoSave();
    setupEnhancedValidation();
    setupKeyboardShortcuts();
    
    // Start timer when form section becomes active
    const formSection = document.getElementById('prescriptionFormSection');
    if (formSection) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'class') {
                    if (formSection.classList.contains('active')) {
                        startTimer();
                    } else {
                        stopTimer();
                    }
                }
            });
        });
        
        observer.observe(formSection, { attributes: true });
    }
});

// Logout function
function logout() {
    // Clear any local storage items
    localStorage.removeItem('prescriptionFormDraft');
    localStorage.removeItem('userProfile');
    
    // Sign out from Firebase
    auth.signOut().then(() => {
        console.log('User signed out successfully');
        // Redirect to auth page
        window.location.href = 'auth.html';
    }).catch((error) => {
        console.error('Error signing out:', error);
    });
}
