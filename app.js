// app.js - Consolidated from app.js and script.js

// Global state management
let appState = {
    prescriptionFilters: {
        search: '',
        dateFrom: '',
        dateTo: '',
        visionType: '',
        lensType: '',
        frameType: '',
        paymentMode: ''
    },
    reportFilters: {
        period: 'day',
        customFrom: '',
        customTo: ''
    }
};

// Global Variables
let currentPrescriptionData = null;
let whatsappImageUrl = null;
let isFormFilled = false;
let deferredPrompt;
// Flag to track if the user profile is complete
let isProfileComplete = false;
// Store the last valid section to return to after setup
let lastValidSection = 'dashboard'; 

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
        window.location.replace('auth.html');
    }
});

function initializeApp() {
    console.log('Initializing app...');
    const user = auth.currentUser;
    
    if (!user) {
        console.error('No user found during initialization');
        window.location.href = 'auth.html';
        return;
    }

    // Mark body as initialized
    document.body.classList.add('initialized');
    
    // Set current date first
    setCurrentDate();
    
    // Setup basic event listeners first
    setupEventListeners();
    
    // Then load user profile (this will handle navigation)
    loadUserProfile();
    
    // Setup PWA features
    setupPWA();
    
    console.log('App initialized successfully for user:', user.email);
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
    
    // Update preview back button
    updatePreviewBackButton();
    
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
    statusMessage.className = `status-message alert alert-${type}`;
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
    console.log('Navigation attempt:', sectionName, 'Profile complete:', isProfileComplete);
    
    if (isProfileComplete) {
        hideAllSections();
        navFunction();
        updateActiveNavLink(sectionName);
        lastValidSection = sectionName;
        // Update URL hash AFTER navigation is complete
        setTimeout(() => {
            window.location.hash = sectionName;
        }, 100);
    } else {
        console.log('Profile not complete, forcing setup');
        showProfileSetup(true);
        // Update hash for setup
        setTimeout(() => {
            window.location.hash = 'setup';
        }, 100);
    }
}

function showDashboard() {
    console.log('Showing dashboard, profile complete:', isProfileComplete);
    
    if (isProfileComplete) {
        hideAllSections();
        const dashboardSection = document.getElementById('dashboardSection');
        if (dashboardSection) {
            dashboardSection.classList.add('active');
            console.log('Dashboard section activated');
        }
        updateActiveNavLink('dashboard');
        lastValidSection = 'dashboard';
    } else {
        console.log('Profile not complete, redirecting to setup');
        showProfileSetup(true);
    }
}

function showPrescriptionForm() {
    navigateIfProfileComplete(() => {
        hideAllSections();
        const formSection = document.getElementById('prescriptionFormSection');
        if (formSection) formSection.classList.add('active');
        updateActiveNavLink('form');
        resetForm();
        
        lastValidSection = 'form';
    }, 'form');
}

function showPrescriptions() {
    navigateIfProfileComplete(() => {
        hideAllSections();
        const prescriptionsSection = document.getElementById('prescriptionsSection');
        if (prescriptionsSection) prescriptionsSection.classList.add('active');
        updateActiveNavLink('prescriptions');
        fetchPrescriptions();
        initializePrescriptionFilters();
    }, 'prescriptions');
}

function showReports() {
    navigateIfProfileComplete(() => {
        hideAllSections();
        const reportsSection = document.getElementById('reportsSection');
        if (reportsSection) reportsSection.classList.add('active');
        updateActiveNavLink('reports');
        initializeReportFilters();
        fetchDailyReport();
    }, 'reports');
}

function showProfileSetup(isForced) {
    hideAllSections();
    const setupSection = document.getElementById('profileSetupSection');
    if (setupSection) setupSection.classList.add('active');
    updateActiveNavLink('setup');
    
    // Disable navigation if forced
    const navButtons = document.querySelectorAll('.nav-link:not(.btn-logout)');
    navButtons.forEach(btn => btn.style.pointerEvents = isForced ? 'none' : 'auto');
    
    // Hide continue button if just editing
    const saveBtn = document.getElementById('saveSetupProfileBtn');
    if (saveBtn) {
        saveBtn.textContent = isForced ? 'Save Profile & Continue' : 'Save Changes';
    }

    // Populate current data for editing
    if (!isForced) {
        const clinicName = document.getElementById('clinicName')?.textContent;
        const optometristName = document.getElementById('optometristName')?.textContent;
        const address = document.getElementById('clinicAddress')?.textContent;
        const contactNumber = document.getElementById('contactNumber')?.textContent;
        
        document.getElementById('setupClinicName').value = clinicName || '';
        document.getElementById('setupOptometristName').value = optometristName || '';
        document.getElementById('setupAddress').value = address || '';
        document.getElementById('setupContactNumber').value = contactNumber || '';
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
    
    // Set preview hash (this won't interfere with navigation since it's transient)
    window.location.hash = 'preview';
    
    if (prescriptionData) {
        loadPreviewData(prescriptionData);
    } else {
        loadPreviewFromForm();
    }
}

// Update back button in preview to return to prescriptions
function updatePreviewBackButton() {
    const backButton = document.querySelector('.btn-back');
    if (backButton) {
        backButton.onclick = () => {
            window.location.hash = 'prescriptions';
        };
    }
}

// Hash change handler
function handleHashChange() {
    // Only handle hash changes if profile is complete
    if (!isProfileComplete) {
        return;
    }
    
    const hash = window.location.hash.replace('#', '').split('?')[0];
    console.log('Hash navigation to:', hash);
    
    // Prevent recursive calls
    const currentSection = document.querySelector('.page-section.active')?.id;
    if (currentSection && currentSection.includes(hash)) {
        return;
    }
    
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
            if (!hash) {
                showDashboard();
            }
    }
}

function hideAllSections() {
    const sections = document.querySelectorAll('.page-section');
    sections.forEach(section => {
        section.classList.remove('active');
        console.log(`Hiding section: ${section.id}`);
    });
}

function updateActiveNavLink(activeSection) {
    const navLinks = document.querySelectorAll('.nav-link-custom');
    navLinks.forEach(link => {
        link.classList.remove('active');
        
        // Get the target section from href or onclick
        const href = link.getAttribute('href');
        const onclick = link.getAttribute('onclick');
        
        let targetSection = '';
        
        if (href) {
            targetSection = href.replace('#', '');
        } else if (onclick) {
            // Extract section from onclick function calls
            if (onclick.includes('showDashboard()')) targetSection = 'dashboard';
            else if (onclick.includes('showPrescriptionForm()')) targetSection = 'form';
            else if (onclick.includes('showPrescriptions()')) targetSection = 'prescriptions';
            else if (onclick.includes('showReports()')) targetSection = 'reports';
            else if (onclick.includes('showProfileSetup(false)')) targetSection = 'setup';
        }
        
        if (targetSection === activeSection) {
            link.classList.add('active');
        }
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
            
            const isDataValid = userData.clinicName && userData.optometristName;
            
           if (isDataValid) {
    isProfileComplete = true;
    updateProfileUI(userData);
    localStorage.setItem('userProfile', JSON.stringify(userData));
    
    console.log('Profile loaded successfully, initializing navigation...');
    
    // Set up hash change listener AFTER profile is loaded
    window.addEventListener('hashchange', handleHashChange);
    
    // Handle initial navigation with better timing
    setTimeout(() => {
        const hash = window.location.hash.replace('#', '').split('?')[0];
        console.log('Initial navigation to hash:', hash);
        
        if (hash && hash !== 'setup' && hash !== '') {
            // Use direct function calls instead of hash change to avoid loops
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
                default:
                    showDashboard();
            }
        } else {
            // Default to dashboard
            showDashboard();
        }
    }, 300);
    
    return;
}
            
            console.warn('User profile found but incomplete. Forcing setup.');
            isProfileComplete = false;
            window.location.hash = 'setup';
            showProfileSetup(true);

        } else {
            console.log('No user profile found in Firestore. Forcing setup.');
            isProfileComplete = false;
            window.location.hash = 'setup';
            showProfileSetup(true);
        }
    } catch (error) {
        console.error('Error loading user profile from Firestore:', error);
        const localProfile = localStorage.getItem('userProfile');
        if (localProfile) {
            console.log('Firestore failed, using localStorage backup.');
            userData = JSON.parse(localProfile);
            isProfileComplete = userData.clinicName && userData.optometristName;
            updateProfileUI(userData);
            if (isProfileComplete) {
                window.addEventListener('hashchange', handleHashChange);
                setTimeout(() => {
                    if (window.location.hash && window.location.hash !== '#setup') {
                        handleHashChange();
                    } else {
                        window.location.hash = 'dashboard';
                        showDashboard();
                    }
                }, 100);
            } else {
                window.location.hash = 'setup';
                showProfileSetup(true);
            }
        } else {
            console.error('No backup profile available, forcing setup.');
            isProfileComplete = false;
            window.location.hash = 'setup';
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
        email: user.email
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
        
        // Re-enable navigation
        const navButtons = document.querySelectorAll('.nav-link:not(.btn-logout)');
        navButtons.forEach(btn => btn.style.pointerEvents = 'auto');

        // **FIX: Determine where to navigate after saving**
        // Check if we came from the prescription form (edit profile scenario)
        const cameFromPrescriptionForm = document.getElementById('prescriptionFormSection')?.classList.contains('active') || 
                                        history.state?.page === 'form';
        
        if (cameFromPrescriptionForm) {
            // If editing profile from prescription form, go back to form
            showPrescriptionForm();
        } else if (lastValidSection === 'dashboard' || !lastValidSection) {
            // Default to dashboard
            showDashboard();
        } else {
            // For other cases, use browser back
            window.history.back();
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

function initializePrescriptionFilters() {
    // Try to get filters from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const filters = {
        search: urlParams.get('search') || '',
        dateFrom: urlParams.get('from') || '',
        dateTo: urlParams.get('to') || '',
        visionType: urlParams.get('vision') || '',
        lensType: urlParams.get('lens') || '',
        frameType: urlParams.get('frame') || '',
        paymentMode: urlParams.get('payment') || ''
    };
    
    // Set filter values
    document.getElementById('searchInput').value = filters.search;
    document.getElementById('filterDateFrom').value = filters.dateFrom;
    document.getElementById('filterDateTo').value = filters.dateTo;
    document.getElementById('filterVisionType').value = filters.visionType;
    document.getElementById('filterLensType').value = filters.lensType;
    document.getElementById('filterFrameType').value = filters.frameType;
    document.getElementById('filterPaymentMode').value = filters.paymentMode;
    
    // Save to app state
    appState.prescriptionFilters = filters;
}

function applyPrescriptionFilters() {
    const filters = {
        search: document.getElementById('searchInput').value.toLowerCase(),
        dateFrom: document.getElementById('filterDateFrom').value,
        dateTo: document.getElementById('filterDateTo').value,
        visionType: document.getElementById('filterVisionType').value,
        lensType: document.getElementById('filterLensType').value,
        frameType: document.getElementById('filterFrameType').value,
        paymentMode: document.getElementById('filterPaymentMode').value
    };
    
    // Save filters to app state
    appState.prescriptionFilters = filters;
    
    // Update URL with filter parameters
    updatePrescriptionsURL(filters);
    
    // Apply filters
    filterPrescriptions();
}

function updatePrescriptionsURL(filters) {
    const urlParams = new URLSearchParams();
    
    if (filters.search) urlParams.set('search', filters.search);
    if (filters.dateFrom) urlParams.set('from', filters.dateFrom);
    if (filters.dateTo) urlParams.set('to', filters.dateTo);
    if (filters.visionType) urlParams.set('vision', filters.visionType);
    if (filters.lensType) urlParams.set('lens', filters.lensType);
    if (filters.frameType) urlParams.set('frame', filters.frameType);
    if (filters.paymentMode) urlParams.set('payment', filters.paymentMode);
    
    const queryString = urlParams.toString();
    const newURL = queryString ? `app.html#prescriptions?${queryString}` : 'app.html#prescriptions';
    
    // Update URL without reloading
    window.history.replaceState(null, '', newURL);
}

function clearPrescriptionFilters() {
    // Reset filter inputs
    document.getElementById('searchInput').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterVisionType').value = '';
    document.getElementById('filterLensType').value = '';
    document.getElementById('filterFrameType').value = '';
    document.getElementById('filterPaymentMode').value = '';
    
    // Clear state
    appState.prescriptionFilters = {
        search: '',
        dateFrom: '',
        dateTo: '',
        visionType: '',
        lensType: '',
        frameType: '',
        paymentMode: ''
    };
    
    // Clear URL parameters
    window.history.replaceState(null, '', 'app.html#prescriptions');
    
    // Refresh prescriptions
    fetchPrescriptions();
}

// Enhanced Report Filtering System with URL parameters
function initializeReportFilters() {
    // Try to get filters from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const filters = {
        period: urlParams.get('period') || 'day',
        customFrom: urlParams.get('from') || '',
        customTo: urlParams.get('to') || ''
    };
    
    document.getElementById('reportPeriod').value = filters.period;
    document.getElementById('customDateFrom').value = filters.customFrom;
    document.getElementById('customDateTo').value = filters.customTo;
    
    // Save to app state
    appState.reportFilters = filters;
    
    // Show/hide custom date range based on period
    toggleCustomDateRange();
}

function applyReportFilters() {
    const period = document.getElementById('reportPeriod').value;
    const customFrom = document.getElementById('customDateFrom').value;
    const customTo = document.getElementById('customDateTo').value;
    
    appState.reportFilters = {
        period,
        customFrom,
        customTo
    };
    
    // Update URL with filter parameters
    updateReportsURL(period, customFrom, customTo);
    
    // Fetch report based on selected period
    switch (period) {
        case 'day':
            fetchDailyReport();
            break;
        case 'week':
            fetchWeeklyReport();
            break;
        case 'month':
            fetchMonthlyReport();
            break;
        case 'custom':
            fetchCustomReport(customFrom, customTo);
            break;
    }
}

function updateReportsURL(period, customFrom, customTo) {
    const urlParams = new URLSearchParams();
    urlParams.set('period', period);
    
    if (period === 'custom') {
        if (customFrom) urlParams.set('from', customFrom);
        if (customTo) urlParams.set('to', customTo);
    }
    
    const queryString = urlParams.toString();
    const newURL = `app.html#reports?${queryString}`;
    
    // Update URL without reloading
    window.history.replaceState(null, '', newURL);
}

function toggleCustomDateRange() {
    const period = document.getElementById('reportPeriod').value;
    const customDateRange = document.getElementById('customDateRange');
    
    if (period === 'custom') {
        customDateRange.style.display = 'grid';
    } else {
        customDateRange.style.display = 'none';
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
    showProfileSetup(false); // Go to profile setup/edit screen
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

// Simplified PDF Generation that works with CSS
function generatePDF() {
    showStatusMessage('Generating PDF...', 'info');
    
    // Use the existing preview element for PDF generation
    const element = document.getElementById('prescriptionPreview');
    
    if (!element) {
        showStatusMessage('Prescription preview not found', 'error');
        return;
    }

    // Create a clone to avoid affecting the display
    const elementClone = element.cloneNode(true);
    
    // Apply PDF-specific styles
    elementClone.style.width = '58mm';
    elementClone.style.margin = '0 auto';
    elementClone.style.padding = '3mm';
    elementClone.style.background = 'white';
    elementClone.style.fontFamily = 'Courier New, monospace';
    elementClone.style.fontSize = '9px';
    elementClone.style.lineHeight = '1.1';
    elementClone.style.color = 'black';
    
    // Hide the clone
    elementClone.style.position = 'fixed';
    elementClone.style.left = '-9999px';
    elementClone.style.top = '0';
    document.body.appendChild(elementClone);

    const patientName = document.getElementById('previewPatientName')?.textContent || 'Patient';
    const shortDate = new Date().toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });

    const opt = {
        margin: [2, 2, 2, 2],
        filename: `Prescription_${patientName}_${shortDate.replace(/\//g, '-')}.pdf`,
        image: { 
            type: 'jpeg', 
            quality: 0.98 
        },
        html2canvas: { 
            scale: 3,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            width: 165,
            windowWidth: 165
        },
        jsPDF: { 
            unit: 'mm', 
            format: [58, 400],
            orientation: 'portrait',
            compress: true
        }
    };

    html2pdf()
        .set(opt)
        .from(elementClone)
        .save()
        .then(() => {
            document.body.removeChild(elementClone);
            showStatusMessage('PDF downloaded successfully!', 'success');
        })
        .catch((error) => {
            document.body.removeChild(elementClone);
            console.error('PDF generation error:', error);
            showStatusMessage('PDF generation failed: ' + error.message, 'error');
        });
}

// Dedicated Thermal Print Function for 58mm Printer
function printPreview() {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    
    if (!printWindow) {
        // Fallback to direct print if popup blocked
        window.print();
        return;
    }

    // Get all the data for thermal print
    const clinicName = document.getElementById('previewClinicName')?.textContent || 'Your Clinic';
    const clinicAddress = document.getElementById('previewClinicAddress')?.textContent || 'Clinic Address';
    const optometristName = document.getElementById('previewOptometristName')?.textContent || 'Optometrist Name';
    const contactNumber = document.getElementById('previewContactNumber')?.textContent || 'Contact Number';
    
    // Get short date with time
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

    // Get prescription data
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
                /* 58mm Thermal Printer Specific Styles */
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: 'Courier New', monospace;
                }
                
                body {
                    width: 58mm;
                    margin: 0 auto;
                    padding: 3mm;
                    background: white;
                    color: black;
                    font-size: 9px;
                    line-height: 1.1;
                }
                
                /* Clinic Header */
                .clinic-header {
                    text-align: center;
                    margin-bottom: 4px;
                    padding-bottom: 3px;
                    border-bottom: 1px solid #000;
                }
                
                .clinic-name {
                    font-size: 11px;
                    font-weight: bold;
                    margin-bottom: 1px;
                    text-transform: uppercase;
                }
                
                .clinic-address {
                    font-size: 8px;
                    margin-bottom: 1px;
                }
                
                .clinic-contact {
                    font-size: 8px;
                    font-weight: bold;
                }
                
                /* Name and Date - UPDATED */
                .header-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                    font-size: 8px;
                }
                
                .name-section {
                    font-weight: bold;
                }
                
                .date-section {
                    text-align: right;
                    font-weight: bold;
                }
                
                /* Prescription Title */
                .prescription-title {
                    text-align: center;
                    font-size: 10px;
                    font-weight: bold;
                    margin: 4px 0;
                    text-decoration: underline;
                }
                
                /* Patient Information */
                .patient-info {
                    margin-bottom: 4px;
                    padding: 3px;
                    border: 1px solid #000;
                }
                
                .patient-row {
                    display: flex;
                    margin-bottom: 1px;
                }
                
                .patient-label {
                    font-weight: bold;
                    width: 25mm;
                }
                
                .patient-value {
                    flex: 1;
                }
                
                /* Prescription Tables */
                .prescription-section {
                    margin: 4px 0;
                }
                
                .eye-title {
                    text-align: center;
                    background: #e0e0e0;
                    padding: 2px;
                    font-weight: bold;
                    font-size: 9px;
                    border: 1px solid #000;
                    border-bottom: none;
                }
                
                .prescription-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 3px;
                    font-size: 7px;
                }
                
                .prescription-table th {
                    background: #f0f0f0;
                    border: 1px solid #000;
                    padding: 2px 1px;
                    text-align: center;
                    font-weight: bold;
                }
                
                .prescription-table td {
                    border: 1px solid #000;
                    padding: 2px 1px;
                    text-align: center;
                }
                
                .section-heading {
                    background: #e8e8e8 !important;
                    font-weight: bold;
                }
                
                /* Options Section */
                .options-section {
                    margin: 4px 0;
                    border: 1px solid #000;
                }
                
                .options-title {
                    background: #e0e0e0;
                    padding: 2px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 9px;
                }
                
                .options-content {
                    padding: 3px;
                }
                
                .option-row {
                    display: flex;
                    margin-bottom: 1px;
                }
                
                .option-label {
                    font-weight: bold;
                    width: 20mm;
                }
                
                .option-value {
                    flex: 1;
                }
                
                /* Amount Section */
                .amount-section {
                    border: 1px solid #000;
                    margin: 4px 0;
                }
                
                .amount-row {
                    display: flex;
                    padding: 2px 3px;
                }
                
                .amount-label {
                    font-weight: bold;
                    width: 25mm;
                }
                
                .amount-value {
                    flex: 1;
                    font-weight: bold;
                    font-size: 10px;
                }
                
                /* Footer */
                .footer {
                    margin-top: 6px;
                    padding-top: 3px;
                    border-top: 1px solid #000;
                    text-align: center;
                    font-size: 7px;
                }
                
                .thank-you {
                    margin-bottom: 2px;
                    font-style: italic;
                }
                
                .signature {
                    margin-top: 8px;
                    text-align: right;
                }
                
                .signature-line {
                    border-top: 1px solid #000;
                    width: 30mm;
                    margin-left: auto;
                    padding-top: 1px;
                    text-align: center;
                    font-size: 7px;
                }
                
                /* Print Specific */
                @media print {
                    body {
                        margin: 0;
                        padding: 2mm;
                        width: 58mm;
                    }
                    
                    @page {
                        margin: 0;
                        padding: 0;
                        size: 58mm auto;
                    }
                    
                    .no-print {
                        display: none !important;
                    }
                }
                
                /* On-screen preview styling */
                .print-controls {
                    text-align: center;
                    margin-top: 10px;
                    padding: 10px;
                    background: #f5f5f5;
                    border-radius: 5px;
                }
                
                .print-btn {
                    padding: 8px 16px;
                    margin: 0 5px;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                }
                
                .print-primary {
                    background: #007bff;
                    color: white;
                }
                
                .print-secondary {
                    background: #6c757d;
                    color: white;
                }
            </style>
        </head>
        <body>
            <!-- Clinic Header -->
            <div class="clinic-header">
                <div class="clinic-name">${clinicName}</div>
                <div class="clinic-address">${clinicAddress}</div>
                <div class="clinic-contact">📞 ${contactNumber}</div>
            </div>
            
            <!-- Name and Date - UPDATED -->
            <div class="header-info">
                <div class="name-section"><strong>${optometristName}</strong></div>
                <div class="date-section"><strong>${currentDateTime}</strong></div>
            </div>
            
            <!-- Prescription Title -->
            <div class="prescription-title">EYE PRESCRIPTION</div>
            
            <!-- Patient Information -->
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
            
            <!-- Right Eye Prescription -->
            <div class="prescription-section">
                <div class="eye-title">RIGHT EYE (OD)</div>
                <table class="prescription-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>SPH</th>
                            <th>CYL</th>
                            <th>AXIS</th>
                            <th>V/A</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="section-heading">DIST</td>
                            <td>${prescriptionData.rightDist.SPH}</td>
                            <td>${prescriptionData.rightDist.CYL}</td>
                            <td>${prescriptionData.rightDist.AXIS}</td>
                            <td>${prescriptionData.rightDist.VA}</td>
                        </tr>
                        <tr>
                            <td class="section-heading">ADD</td>
                            <td>${prescriptionData.rightAdd.SPH}</td>
                            <td>${prescriptionData.rightAdd.CYL}</td>
                            <td>${prescriptionData.rightAdd.AXIS}</td>
                            <td>${prescriptionData.rightAdd.VA}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <!-- Left Eye Prescription -->
            <div class="prescription-section">
                <div class="eye-title">LEFT EYE (OS)</div>
                <table class="prescription-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>SPH</th>
                            <th>CYL</th>
                            <th>AXIS</th>
                            <th>V/A</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="section-heading">DIST</td>
                            <td>${prescriptionData.leftDist.SPH}</td>
                            <td>${prescriptionData.leftDist.CYL}</td>
                            <td>${prescriptionData.leftDist.AXIS}</td>
                            <td>${prescriptionData.leftDist.VA}</td>
                        </tr>
                        <tr>
                            <td class="section-heading">ADD</td>
                            <td>${prescriptionData.leftAdd.SPH}</td>
                            <td>${prescriptionData.leftAdd.CYL}</td>
                            <td>${prescriptionData.leftAdd.AXIS}</td>
                            <td>${prescriptionData.leftAdd.VA}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <!-- Recommended Options -->
            <div class="options-section">
                <div class="options-title">RECOMMENDED OPTIONS</div>
                <div class="options-content">
                    <div class="option-row">
                        <div class="option-label">Vision Type:</div>
                        <div class="option-value">${visionType}</div>
                    </div>
                    <div class="option-row">
                        <div class="option-label">Lens Type:</div>
                        <div class="option-value">${lensType}</div>
                    </div>
                    <div class="option-row">
                        <div class="option-label">Frame Type:</div>
                        <div class="option-value">${frameType}</div>
                    </div>
                    <div class="option-row">
                        <div class="option-label">Payment Mode:</div>
                        <div class="option-value">${paymentMode}</div>
                    </div>
                </div>
            </div>
            
            <!-- Amount -->
            <div class="amount-section">
                <div class="amount-row">
                    <div class="amount-label">TOTAL AMOUNT:</div>
                    <div class="amount-value">₹ ${amount}</div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <div class="thank-you">
                    Thank you for choosing ${clinicName}
                </div>
                <div>For queries: ${contactNumber}</div>
                
                <div class="signature">
                    <div class="signature-line">
                        Authorized Signature<br>
                        <strong>${optometristName}</strong>
                    </div>
                </div>
            </div>
            
            <!-- Print Controls (Visible on screen only) -->
            <div class="no-print print-controls">
                <button class="print-btn print-primary" onclick="window.print()">
                    🖨️ Print Now
                </button>
                <button class="print-btn print-secondary" onclick="window.close()">
                    ❌ Close
                </button>
            </div>

            <script>
                // Auto-print after short delay
                setTimeout(function() {
                    window.print();
                }, 500);
                
                // Auto-close after printing
                window.onafterprint = function() {
                    setTimeout(function() {
                        window.close();
                    }, 1000);
                };
                
                // Fallback close
                setTimeout(function() {
                    if (!window.closed) {
                        window.close();
                    }
                }, 10000);
            </script>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHTML);
    printWindow.document.close();
}

async function sendWhatsApp() {
    const mobile = document.getElementById('previewMobile')?.textContent;
    if (!mobile) {
        showStatusMessage('No mobile number available for WhatsApp', 'error');
        return;
    }

    try {
        const element = document.getElementById('prescriptionPreview');
        if (!element) {
            showStatusMessage('Prescription preview not found', 'error');
            return;
        }

        // Show loading state
        showStatusMessage('Preparing prescription for WhatsApp...', 'info');

        // Method 1: Try to use existing image URL first
        if (whatsappImageUrl) {
            await sendWhatsAppMessage(mobile, whatsappImageUrl);
            return;
        }

        // Method 2: Generate canvas and try multiple upload methods
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff'
        });

        const imageData = canvas.toDataURL('image/png');
        
        // Try multiple upload methods with fallbacks
        try {
            // Method 2A: Try ImgBB first
            whatsappImageUrl = await uploadImageToImgBB(imageData);
        } catch (imgbbError) {
            console.warn('ImgBB upload failed, trying alternative methods:', imgbbError);
            
            try {
                // Method 2B: Try converting to blob and creating object URL
                whatsappImageUrl = await convertToBlobUrl(imageData);
            } catch (blobError) {
                console.warn('Blob URL method failed:', blobError);
                
                // Method 2C: Final fallback - use data URL directly (may not work in all browsers)
                whatsappImageUrl = imageData;
            }
        }

        await sendWhatsAppMessage(mobile, whatsappImageUrl);
        
    } catch (error) {
        console.error('Error sending WhatsApp:', error);
        showStatusMessage('Failed to send WhatsApp: ' + error.message, 'error');
    }
}

async function convertToBlobUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        try {
            const blob = dataURLToBlob(dataUrl);
            const blobUrl = URL.createObjectURL(blob);
            resolve(blobUrl);
        } catch (error) {
            reject(error);
        }
    });
}

function dataURLToBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
}

async function sendWhatsAppMessage(mobile, imageUrl) {
    const clinicName = document.getElementById('previewClinicName')?.textContent || 'Your Clinic';
    const patientName = document.getElementById('previewPatientName')?.textContent || '';
    
    let message = `Hello${patientName ? ' ' + patientName : ''}! Here is your digital prescription from ${clinicName}.`;
    
    // If it's a data URL, we need to handle it differently
    if (imageUrl.startsWith('data:')) {
        message += '\n\nPrescription details:\n';
        
        // Add basic prescription info as text
        const details = [
            `Patient: ${patientName}`,
            `Age: ${document.getElementById('previewAge')?.textContent || ''}`,
            `Vision Type: ${document.getElementById('previewVisionType')?.textContent || ''}`,
            `Amount: ₹${document.getElementById('previewAmount')?.textContent || ''}`
        ];
        
        message += details.join('\n');
        message += '\n\nPlease visit the clinic for the complete prescription.';
    } else {
        message += ` ${imageUrl}`;
    }
    
    // Clean mobile number (remove any non-digit characters)
    const cleanMobile = mobile.replace(/\D/g, '');
    
    // Create WhatsApp URL
    const whatsappURL = `https://wa.me/${cleanMobile}?text=${encodeURIComponent(message)}`;
    
    // Open in new tab
    window.open(whatsappURL, '_blank');
    
    showStatusMessage('WhatsApp opened with prescription!', 'success');
}

async function uploadImageToImgBB(base64Image) {
    const apiKey = "bbfde58b1da5fc9ee9d7d6a591852f71";
    
    // Convert base64 to blob for better compatibility
    const blob = dataURLToBlob(base64Image);
    const formData = new FormData();
    formData.append("image", blob);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
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
    } catch (error) {
        console.error('ImgBB upload error:', error);
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
    
    if (currentState === 'setup' && !isProfileComplete) {
        // Prevent navigating away from the setup page if the profile is not complete
        history.pushState({ page: 'setup' }, 'Profile Setup', 'app.html#setup');
        alert('Please save your profile details to continue.');
        return;
    }
    
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
window.saveSetupProfile = saveSetupProfile;
window.showProfileSetup = showProfileSetup;
window.submitPrescription = submitPrescription;
window.filterPrescriptions = filterPrescriptions;
window.applyPrescriptionFilters = applyPrescriptionFilters;
window.clearPrescriptionFilters = clearPrescriptionFilters;
window.applyReportFilters = applyReportFilters;
window.toggleCustomDateRange = toggleCustomDateRange;
window.generatePDF = generatePDF;
window.printPreview = printPreview;
window.sendWhatsApp = sendWhatsApp;
window.fetchDailyReport = fetchDailyReport;
window.fetchWeeklyReport = fetchWeeklyReport;
window.fetchMonthlyReport = fetchMonthlyReport;
window.logoutUser = logoutUser;
window.installPWA = installPWA;
window.resetStats = resetStats;

// Add this function to debug Firestore data
async function debugFirestoreData() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        console.log('Firestore User Document:', userDoc.exists ? userDoc.data() : 'No document found');
        
        const prescriptions = await db.collection('prescriptions')
            .where('userId', '==', user.uid)
            .get();
        console.log('Firestore Prescriptions:', prescriptions.docs.map(doc => doc.data()));
    } catch (error) {
        console.error('Debug Firestore Error:', error);
    }
}

setTimeout(debugFirestoreData, 3000);

// Offline Data Management
function savePrescriptionOffline(prescriptionData) {
    const offlinePrescriptions = JSON.parse(localStorage.getItem('offlinePrescriptions') || '[]');
    prescriptionData.offlineId = Date.now().toString();
    prescriptionData.synced = false;
    offlinePrescriptions.push(prescriptionData);
    localStorage.setItem('offlinePrescriptions', JSON.stringify(offlinePrescriptions));
    
    console.log('Prescription saved offline:', prescriptionData.offlineId);
}

async function syncOfflinePrescriptions() {
    if (!navigator.onLine) return;
    
    const offlinePrescriptions = JSON.parse(localStorage.getItem('offlinePrescriptions') || '[]');
    const syncedPrescriptions = [];
    
    for (const prescription of offlinePrescriptions) {
        if (!prescription.synced) {
            try {
                await submitPrescriptionToFirestore(prescription);
                prescription.synced = true;
                syncedPrescriptions.push(prescription);
            } catch (error) {
                console.error('Failed to sync prescription:', error);
            }
        }
    }
    
    // Update localStorage with sync status
    localStorage.setItem('offlinePrescriptions', JSON.stringify(offlinePrescriptions));
    console.log(`Synced ${syncedPrescriptions.length} prescriptions`);
}

// Temporary debug override - remove after testing
setTimeout(() => {
    console.log('=== FORCING DASHBOARD DISPLAY ===');
    const activeSection = document.querySelector('.page-section.active');
    if (!activeSection) {
        console.log('No active section found, forcing dashboard');
        showDashboard();
    }
}, 2000);
