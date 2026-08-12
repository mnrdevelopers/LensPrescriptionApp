// patient.js - Patient Portal Logic (Simplified for unauthenticated access)
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase
    if (typeof firebase !== 'undefined') {
        const db = firebase.firestore();
        setupPatientSearch(db);
    } else {
        showMessage('Firebase is not loaded. Please check firebase-config.js.', 'alert-danger');
    }
    
    // Apply anti-capture restrictions immediately
    applyAntiCaptureMeasures();
});

function setupPatientSearch(db) {
    const searchForm = document.getElementById('patientSearchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const mobile = document.getElementById('mobileNumberInput').value.trim();
            if (mobile.length === 10 && /^\d+$/.test(mobile)) {
                fetchPrescriptionByMobile(db, mobile);
            } else {
                showMessage('Please enter a valid 10-digit mobile number.', 'alert-warning');
            }
        });
    }
    
    // Add input validation for mobile number
    const mobileInput = document.getElementById('mobileNumberInput');
    if (mobileInput) {
        mobileInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
        });
    }
}

async function fetchPrescriptionByMobile(db, mobile) {
    const viewContainer = document.getElementById('prescriptionViewContainer');
    viewContainer.style.display = 'none';
    showMessage('Searching for your prescription...', 'alert-info');

    try {
        console.log('Querying prescriptions for mobile:', mobile);

        // Query the prescriptions collection (no authentication needed)
        const querySnapshot = await db.collection('prescriptions')
            .where('mobile', '==', mobile)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            showMessage('No prescription found for this mobile number. Please check the number or contact your optometrist.', 'alert-warning');
            return;
        }

        const doc = querySnapshot.docs[0];
        const latestRx = doc.data();
        console.log('Found prescription:', latestRx);
        
        // Fetch optometrist profile (this will fail without auth, so use defaults)
        let optometristProfile = { 
            clinicName: 'Our Eye Care Clinic', 
            optometristName: 'Your Optometrist'
        };
        
        displayPrescription(latestRx, optometristProfile);
        
    } catch (error) {
        console.error('Error fetching prescription:', error);
        
        if (error.code === 'permission-denied') {
            showMessage('Access denied. The security rules may need updating.', 'alert-danger');
        } else {
            showMessage('Network error. Please check your connection and try again.', 'alert-danger');
        }
    }
}


/**
 * Displays the prescription data in the secure view container.
 * @param {object} rxData The prescription data.
 * @param {object} profileData The optometrist profile data.
 */
function displayPrescription(rxData, profileData) {
    const viewContainer = document.getElementById('prescriptionViewContainer');
    const messageBox = document.getElementById('messageBox');
    
    // Clinic Info
    document.getElementById('clinicInfoDisplay').textContent = `Prescription from ${profileData.clinicName || 'Our Eye Care Clinic'}`;
    document.getElementById('optometristInfoDisplay').textContent = `Checked by ${profileData.optometristName || 'Your Optometrist'}`;

    // Patient/Visit Details
    document.getElementById('rxPatientName').textContent = rxData.patientName || 'Not Provided';
    document.getElementById('rxMobile').textContent = rxData.mobile || 'Not Provided';
    
    // Format Dates
    let dateIssued = 'Not Available';
    if (rxData.createdAt && rxData.createdAt.toDate) {
        dateIssued = rxData.createdAt.toDate().toLocaleDateString('en-IN');
    } else if (rxData.date) {
        dateIssued = new Date(rxData.date).toLocaleDateString('en-IN');
    } else if (rxData.timestamp && rxData.timestamp.toDate) {
        dateIssued = rxData.timestamp.toDate().toLocaleDateString('en-IN');
    }
    
    let nextCheckup = 'Not Specified';
    if (rxData.nextCheckupDate && rxData.nextCheckupDate.toDate) {
        nextCheckup = rxData.nextCheckupDate.toDate().toLocaleDateString('en-IN');
    } else if (rxData.nextCheckup) {
        nextCheckup = new Date(rxData.nextCheckup).toLocaleDateString('en-IN');
    }
    
    document.getElementById('rxDate').textContent = dateIssued;
    document.getElementById('rxNextCheckupDate').textContent = nextCheckup;
    
    // Prescription Data
    const presData = rxData.prescriptionData || {};
    
    // Right Eye Data
    document.getElementById('rxRightDistSPH').textContent = presData.rightDistSPH || '0.00';
    document.getElementById('rxRightDistCYL').textContent = presData.rightDistCYL || '0.00';
    document.getElementById('rxRightDistAXIS').textContent = presData.rightDistAXIS || '0';
    document.getElementById('rxRightAddSPH').textContent = presData.rightAddSPH || '0.00';
    
    // Left Eye Data
    document.getElementById('rxLeftDistSPH').textContent = presData.leftDistSPH || '0.00';
    document.getElementById('rxLeftDistCYL').textContent = presData.leftDistCYL || '0.00';
    document.getElementById('rxLeftDistAXIS').textContent = presData.leftDistAXIS || '0';
    document.getElementById('rxLeftAddSPH').textContent = presData.leftAddSPH || '0.00';
    
    // PD Data
    const pdFar = rxData.pdFar || rxData.pd || 'N/A';
    const pdNear = rxData.pdNear || 'N/A';
    document.getElementById('rxPDFarNear').textContent = `${pdFar} / ${pdNear}`;

    // Specifications
    document.getElementById('rxVisionType').textContent = rxData.visionType || 'Distance';
    document.getElementById('rxLensType').textContent = rxData.lensType || 'Standard';
    document.getElementById('rxFrameType').textContent = rxData.frameType || 'Full Rim';

    // Show success and display container
    messageBox.style.display = 'none';
    viewContainer.style.display = 'block';
    
    // Scroll to prescription view
    viewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    showMessage('Prescription loaded successfully. This is a secure view-only copy.', 'alert-success');
}

/**
 * Utility function to display messages.
 * @param {string} message 
 * @param {string} type 
 */
function showMessage(message, type) {
    const messageBox = document.getElementById('messageBox');
    if (messageBox) {
        messageBox.textContent = message;
        messageBox.className = `message-box alert ${type}`;
        messageBox.style.display = 'block';
        
        // Auto-hide success messages after 5 seconds
        if (type === 'alert-success') {
            setTimeout(() => {
                messageBox.style.display = 'none';
            }, 5000);
        }
        
        // Hide prescription view when showing error/warning messages
        if (type !== 'alert-success' && type !== 'alert-info') {
            document.getElementById('prescriptionViewContainer').style.display = 'none';
        }
    }
}

/**
 * Implements anti-capture measures (right-click, print, download keys).
 */
function applyAntiCaptureMeasures() {
    const viewContainer = document.getElementById('prescriptionViewContainer');
    
    // 1. Disable right-click (context menu) on the container
    if (viewContainer) {
        viewContainer.oncontextmenu = (e) => {
            e.preventDefault();
            showMessage('Right-click is disabled for security.', 'alert-warning');
            return false;
        };
    }

    // 2. Disable saving/printing key combinations globally
    document.addEventListener('keydown', (e) => {
        // Ctrl+S, Cmd+S (Save Page)
        // Ctrl+P, Cmd+P (Print Page)
        // Ctrl+Shift+I, F12 (Developer Tools)
        if ((e.ctrlKey || e.metaKey) && 
            (e.key === 's' || e.key === 'p' || e.key === 'i' || e.key === 'I')) {
            e.preventDefault();
            e.stopPropagation();
            showMessage('This action is disabled for security.', 'alert-warning');
            return false;
        }
        
        // F12 key for developer tools
        if (e.key === 'F12') {
            e.preventDefault();
            showMessage('Developer tools are disabled on this page.', 'alert-warning');
            return false;
        }
    });
    
    // 3. Disable print screen attempt detection
    document.addEventListener('keyup', (e) => {
        if (e.key === 'PrintScreen') {
            showMessage('Screen capture detected. This is a secure view-only document.', 'alert-warning');
        }
    });

    // 4. Disable Print Dialog
    window.onbeforeprint = (e) => {
        // Prevent printing by showing alternative content
        const bodyContent = document.body.innerHTML;
        document.body.innerHTML = `
            <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
                <h1 style="color: #dc3545;">🛑 Printing Restricted</h1>
                <p>Printing of prescriptions is disabled for security and data privacy.</p>
                <p>Please contact your optometrist for an official printed copy.</p>
                <button onclick="window.location.reload()" style="padding: 10px 20px; margin-top: 20px;">
                    Return to Prescription View
                </button>
            </div>
        `;
        
        setTimeout(() => {
            document.body.innerHTML = bodyContent;
        }, 1);
        
        return false;
    };

    // 5. Prevent text selection on prescription container
    if (viewContainer) {
        viewContainer.style.userSelect = 'none';
        viewContainer.style.webkitUserSelect = 'none';
        viewContainer.style.mozUserSelect = 'none';
        viewContainer.style.msUserSelect = 'none';
    }
}

// Add global function to handle page refresh
window.refreshPage = function() {
    window.location.reload();
};
