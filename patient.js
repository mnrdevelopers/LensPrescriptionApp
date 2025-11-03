// patient.js - Patient Portal Logic
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase (assuming firebaseConfig is loaded via firebase-config.js)
    if (typeof firebase !== 'undefined') {
        // Services are already initialized in firebase-config.js
        const db = firebase.firestore();
        const auth = firebase.auth();
        setupPatientSearch(db, auth);
    } else {
        showMessage('Firebase is not loaded. Please check firebase-config.js.', 'alert-danger');
    }
    
    // Apply anti-capture restrictions immediately
    applyAntiCaptureMeasures();
});

function setupPatientSearch(db, auth) {
    const searchForm = document.getElementById('patientSearchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const mobile = document.getElementById('mobileNumberInput').value.trim();
            if (mobile.length === 10) {
                fetchPrescriptionByMobile(db, mobile);
            } else {
                showMessage('Please enter a valid 10-digit mobile number.', 'alert-warning');
            }
        });
    }
}

/**
 * Searches the 'prescriptions' collection for the latest prescription linked to the mobile number.
 * @param {firebase.firestore.Firestore} db 
 * @param {string} mobile 
 */
async function fetchPrescriptionByMobile(db, mobile) {
    const viewContainer = document.getElementById('prescriptionViewContainer');
    viewContainer.style.display = 'none';
    showMessage('Searching for your prescription...', 'alert-info');

    try {
        // Query the main prescriptions collection
        const querySnapshot = await db.collection('prescriptions')
            .where('mobile', '==', mobile)
            .orderBy('createdAt', 'desc') // Get the latest one first
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            showMessage('No prescription found for this mobile number. Please contact your optometrist.', 'alert-warning');
            return;
        }

        const latestRx = querySnapshot.docs[0].data();
        
        // Fetch the corresponding Optometrist/Clinic Profile
        const optometristUID = latestRx.userId;
        let optometristProfile = { clinicName: 'N/A', optometristName: 'N/A' };
        
        if (optometristUID) {
            const userDoc = await db.collection('users').doc(optometristUID).get();
            if (userDoc.exists) {
                optometristProfile = userDoc.data();
            }
        }
        
        displayPrescription(latestRx, optometristProfile);
        
    } catch (error) {
        console.error('Error fetching prescription:', error);
        showMessage('An error occurred during search. Please check your network.', 'alert-danger');
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
    document.getElementById('clinicInfoDisplay').textContent = `Prescription from ${profileData.clinicName || 'The Clinic'}`;
    document.getElementById('optometristInfoDisplay').textContent = `Checked by ${profileData.optometristName || 'The Optometrist'}`;

    // Patient/Visit Details
    document.getElementById('rxPatientName').textContent = rxData.patientName || 'N/A';
    document.getElementById('rxMobile').textContent = rxData.mobile || 'N/A';
    
    // Format Dates
    let dateIssued = 'N/A';
    if (rxData.createdAt && rxData.createdAt.toDate) {
        dateIssued = rxData.createdAt.toDate().toLocaleDateString();
    } else if (rxData.date) {
        dateIssued = new Date(rxData.date).toLocaleDateString();
    }
    
    let nextCheckup = 'N/A';
    if (rxData.nextCheckupDate && rxData.nextCheckupDate.toDate) {
        nextCheckup = rxData.nextCheckupDate.toDate().toLocaleDateString();
    }
    
    document.getElementById('rxDate').textContent = dateIssued;
    document.getElementById('rxNextCheckupDate').textContent = nextCheckup;
    
    // Prescription Data
    const presData = rxData.prescriptionData || {};
    
    const fields = [
        // OD
        { id: 'rxRightDistSPH', value: presData.rightDistSPH },
        { id: 'rxRightDistCYL', value: presData.rightDistCYL },
        { id: 'rxRightDistAXIS', value: presData.rightDistAXIS },
        { id: 'rxRightAddSPH', value: presData.rightAddSPH },
        // OS
        { id: 'rxLeftDistSPH', value: presData.leftDistSPH },
        { id: 'rxLeftDistCYL', value: presData.leftDistCYL },
        { id: 'rxLeftDistAXIS', value: presData.leftDistAXIS },
        { id: 'rxLeftAddSPH', value: presData.leftAddSPH }
    ];
    
    fields.forEach(f => {
        const el = document.getElementById(f.id);
        if (el) el.textContent = f.value || '';
    });
    
    // PD
    document.getElementById('rxPDFarNear').textContent = `${rxData.pdFar || 'N/A'} / ${rxData.pdNear || 'N/A'}`;

    // Specifications
    document.getElementById('rxVisionType').textContent = rxData.visionType || 'N/A';
    document.getElementById('rxLensType').textContent = rxData.lensType || 'N/A';
    document.getElementById('rxFrameType').textContent = rxData.frameType || 'N/A';

    messageBox.style.display = 'none';
    viewContainer.style.display = 'block';
    showMessage('Latest prescription loaded.', 'alert-success');
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
        
        // Hide prescription view when showing a new message
        if (type !== 'alert-success') {
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
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p')) {
            e.preventDefault();
            e.stopPropagation();
            showMessage('Download and print commands are disabled for security.', 'alert-warning');
            return false;
        }
    });
    
    // 3. Disable print screen attempt (less effective but useful)
    document.addEventListener('keyup', (e) => {
        if (e.key === 'PrintScreen' || e.key === 'p') {
            // Wait a moment then flash the screen or modify content (can be intrusive, simplified here)
            // For example, briefly change the body background to block colors
            console.warn("Print Screen detected. Security measures active.");
            // Optional visual feedback for user that action was blocked
        }
    });

    // 4. Disable Print Dialog via CSS Media Query (already handled by CSS, but JS helps)
    window.onbeforeprint = () => {
        // Logic to clear screen or show a blank message before printing
        const tempContent = document.body.innerHTML;
        document.body.innerHTML = '<h1>Printing is restricted for this secure document.</h1>';
        setTimeout(() => {
            document.body.innerHTML = tempContent;
        }, 10);
        return false; // Prevent opening the print dialog
    };
}
