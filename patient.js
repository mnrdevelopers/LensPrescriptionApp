// patient.js - Patient Portal Engine (Modernized v2.0)
let currentPrescriptions = [];
let currentClinicProfile = {
    clinicName: 'Eye Care Optical Clinic',
    clinicAddress: 'Digital Prescription Center',
    optometristName: 'Specialist Optometrist',
    contactNumber: ''
};
let selectedPrescriptionIndex = 0;

document.addEventListener('DOMContentLoaded', function() {
    // Check Firebase initialization
    if (typeof firebase !== 'undefined') {
        const db = firebase.firestore();
        setupPatientSearch(db);
        
        // Auto-check URL parameters (e.g. ?mobile=9876543210)
        const urlParams = new URLSearchParams(window.location.search);
        const autoMobile = urlParams.get('mobile');
        if (autoMobile && autoMobile.length === 10) {
            const mobileInput = document.getElementById('mobileNumberInput');
            if (mobileInput) {
                mobileInput.value = autoMobile;
                fetchPrescriptionsByMobile(db, autoMobile);
            }
        }
    } else {
        showPortalMessage('Firebase could not be loaded. Please reload or check your connection.', 'alert-danger');
    }
});

/**
 * Setup mobile search form and input filters
 */
function setupPatientSearch(db) {
    const searchForm = document.getElementById('patientSearchForm');
    const mobileInput = document.getElementById('mobileNumberInput');

    if (mobileInput) {
        // Enforce 10 digits numeric only
        mobileInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const mobile = mobileInput ? mobileInput.value.trim() : '';
            
            if (mobile.length === 10 && /^\d{10}$/.test(mobile)) {
                fetchPrescriptionsByMobile(db, mobile);
            } else {
                showPortalMessage('Please enter a valid 10-digit mobile number.', 'alert-warning');
            }
        });
    }
}

/**
 * Query prescriptions from Firestore by patient mobile number
 */
async function fetchPrescriptionsByMobile(db, mobile) {
    const cardContainer = document.getElementById('prescriptionCardContainer');
    const historySection = document.getElementById('historySelectorSection');
    const searchBtn = document.getElementById('btnSearchSubmit');

    if (cardContainer) cardContainer.style.display = 'none';
    if (historySection) historySection.style.display = 'none';

    // Set button loading state
    if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Searching...</span>';
    }

    showPortalMessage('Looking up your prescription records...', 'alert-info');

    try {
        // Fetch matching prescriptions by mobile number
        const querySnapshot = await db.collection('prescriptions')
            .where('mobile', '==', mobile)
            .get();

        if (querySnapshot.empty) {
            showPortalMessage('No prescriptions found for mobile number +91 ' + mobile + '. Please verify the number or contact your optical clinic.', 'alert-warning');
            return;
        }

        // Map and sort prescriptions newest first
        currentPrescriptions = [];
        querySnapshot.forEach(doc => {
            currentPrescriptions.push({
                id: doc.id,
                ...doc.data()
            });
        });

        currentPrescriptions.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.date ? new Date(a.date).getTime() : 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.date ? new Date(b.date).getTime() : 0);
            return dateB - dateA;
        });

        // Priority 1: Check if clinic metadata is saved directly in the prescription document
        const firstRx = currentPrescriptions[0];
        const localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');

        let resolvedClinicName = firstRx.clinicName || firstRx.clinic || localProfile.clinicName || '';
        let resolvedClinicAddress = firstRx.clinicAddress || firstRx.address || localProfile.address || '';
        let resolvedOptometristName = firstRx.optometristName || firstRx.optometrist || localProfile.optometristName || '';
        let resolvedContactNumber = firstRx.contactNumber || firstRx.phone || firstRx.mobileClinic || localProfile.contactNumber || '';

        // Priority 2: Attempt to fetch from Firestore users doc if userId exists
        if ((!resolvedClinicName || !resolvedOptometristName) && firstRx.userId) {
            try {
                const userDoc = await db.collection('users').doc(firstRx.userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (!resolvedClinicName && userData.clinicName) resolvedClinicName = userData.clinicName;
                    if (!resolvedClinicAddress && (userData.address || userData.clinicAddress)) resolvedClinicAddress = userData.address || userData.clinicAddress;
                    if (!resolvedOptometristName && userData.optometristName) resolvedOptometristName = userData.optometristName;
                    if (!resolvedContactNumber && userData.contactNumber) resolvedContactNumber = userData.contactNumber;
                }
            } catch (err) {
                console.log('Optometrist profile fetch:', err.message);
            }
        }

        currentClinicProfile = {
            clinicName: resolvedClinicName || 'Eye Care Optical',
            clinicAddress: resolvedClinicAddress || 'Registered Optical Clinic',
            optometristName: resolvedOptometristName || 'Consultant Optometrist',
            contactNumber: resolvedContactNumber || ''
        };

        // Render history tabs if multiple prescriptions exist
        renderHistoryTabs();

        // Display the latest prescription by default
        selectedPrescriptionIndex = 0;
        displayPrescription(currentPrescriptions[0], currentClinicProfile);

        showPortalMessage(`Found ${currentPrescriptions.length} verified prescription record${currentPrescriptions.length > 1 ? 's' : ''}.`, 'alert-success');

    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        if (error.code === 'permission-denied') {
            showPortalMessage('Access restricted. Please contact support or your optometrist.', 'alert-danger');
        } else {
            showPortalMessage('Could not retrieve prescriptions. Please check your internet connection and try again.', 'alert-danger');
        }
    } finally {
        if (searchBtn) {
            searchBtn.disabled = false;
            searchBtn.innerHTML = '<i class="fas fa-search"></i> <span>Search</span>';
        }
    }
}

/**
 * Render history tabs for multiple visits
 */
function renderHistoryTabs() {
    const historySection = document.getElementById('historySelectorSection');
    const tabsContainer = document.getElementById('historyTabsContainer');
    const countLabel = document.getElementById('historyCountLabel');

    if (!historySection || !tabsContainer) return;

    if (currentPrescriptions.length <= 1) {
        historySection.style.display = 'none';
        return;
    }

    historySection.style.display = 'block';
    if (countLabel) countLabel.textContent = `${currentPrescriptions.length} Visits Found`;

    tabsContainer.innerHTML = currentPrescriptions.map((rx, index) => {
        let visitDate = 'Visit ' + (currentPrescriptions.length - index);
        if (rx.createdAt?.toDate) {
            visitDate = rx.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } else if (rx.date) {
            visitDate = new Date(rx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        }

        const isLatest = index === 0;
        const isActive = index === selectedPrescriptionIndex;

        return `
            <button type="button" 
                    onclick="selectPrescriptionVisit(${index})" 
                    class="history-tab-btn ${isActive ? 'active' : ''}">
                <i class="fas fa-calendar-alt"></i> ${visitDate}
                ${isLatest ? '<span class="tab-badge">Latest</span>' : ''}
            </button>
        `;
    }).join('');
}

/**
 * Switch selected prescription visit
 */
function selectPrescriptionVisit(index) {
    if (index >= 0 && index < currentPrescriptions.length) {
        selectedPrescriptionIndex = index;
        renderHistoryTabs();
        displayPrescription(currentPrescriptions[index], currentClinicProfile);
    }
}

/**
 * Populate and display prescription data on the modern card
 */
function displayPrescription(rxData, profileData) {
    const cardContainer = document.getElementById('prescriptionCardContainer');
    if (!cardContainer || !rxData) return;

    // Clinic / Optometrist details: prioritize rxData, then profileData, then userProfile in localStorage
    const localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const clinicName = rxData.clinicName || profileData.clinicName || localProfile.clinicName || 'Eye Care Optical';
    const clinicAddress = rxData.clinicAddress || rxData.address || profileData.clinicAddress || localProfile.address || 'Registered Optical Clinic';
    const optometristName = rxData.optometristName || profileData.optometristName || localProfile.optometristName || 'Consultant Optometrist';
    const clinicPhone = rxData.contactNumber || profileData.contactNumber || localProfile.contactNumber || '';

    document.getElementById('clinicNameDisplay').innerHTML = `${clinicName} <i class="fas fa-check-circle verified-badge" title="Verified Digital Record"></i>`;
    document.getElementById('clinicAddressDisplay').textContent = clinicAddress;
    document.getElementById('optometristNameDisplay').innerHTML = `<i class="fas fa-user-md"></i> Optometrist: <strong>${optometristName}</strong>`;

    // Patient info
    document.getElementById('rxPatientNameDisplay').textContent = rxData.patientName || 'Valued Patient';
    document.getElementById('rxAgeGenderDisplay').textContent = `${rxData.age || '--'} Yrs / ${rxData.gender || 'Not specified'}`;
    document.getElementById('rxMobileDisplay').textContent = rxData.mobile ? `+91 ${rxData.mobile}` : '--';

    // Format Date Issued
    let dateIssued = 'Recent';
    let rawDateObj = new Date();
    if (rxData.createdAt?.toDate) {
        rawDateObj = rxData.createdAt.toDate();
        dateIssued = rawDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } else if (rxData.date) {
        rawDateObj = new Date(rxData.date);
        dateIssued = rawDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    document.getElementById('rxDateDisplay').textContent = dateIssued;

    // Prescription Eye Data
    const presData = rxData.prescriptionData || {};

    // OD (Right Eye)
    document.getElementById('rxRightDistSPH').textContent = formatPower(presData.rightDistSPH);
    document.getElementById('rxRightDistCYL').textContent = formatPower(presData.rightDistCYL);
    document.getElementById('rxRightDistAXIS').textContent = presData.rightDistAXIS ? `${presData.rightDistAXIS}°` : '--';
    document.getElementById('rxRightDistVA').textContent = presData.rightDistVA || '6/6';

    const rightAddRow = document.getElementById('rxRightAddRow');
    if (presData.rightAddSPH && presData.rightAddSPH.trim() !== '') {
        document.getElementById('rxRightAddSPH').textContent = formatPower(presData.rightAddSPH);
        if (rightAddRow) rightAddRow.style.display = '';
    } else {
        if (rightAddRow) rightAddRow.style.display = 'none';
    }

    // OS (Left Eye)
    document.getElementById('rxLeftDistSPH').textContent = formatPower(presData.leftDistSPH);
    document.getElementById('rxLeftDistCYL').textContent = formatPower(presData.leftDistCYL);
    document.getElementById('rxLeftDistAXIS').textContent = presData.leftDistAXIS ? `${presData.leftDistAXIS}°` : '--';
    document.getElementById('rxLeftDistVA').textContent = presData.leftDistVA || '6/6';

    const leftAddRow = document.getElementById('rxLeftAddRow');
    if (presData.leftAddSPH && presData.leftAddSPH.trim() !== '') {
        document.getElementById('rxLeftAddSPH').textContent = formatPower(presData.leftAddSPH);
        if (leftAddRow) leftAddRow.style.display = '';
    } else {
        if (leftAddRow) leftAddRow.style.display = 'none';
    }

    // Recommended Specifications
    document.getElementById('rxVisionTypeDisplay').textContent = rxData.visionType || 'Single Vision';
    document.getElementById('rxLensTypeDisplay').textContent = rxData.lensType || 'Standard Polycarbonate';
    document.getElementById('rxFrameTypeDisplay').textContent = rxData.frameType || 'Full Rim (Acetate)';

    // Next Checkup & Google Calendar Link
    let nextCheckupText = '1 Year from visit';
    let checkupDateObj = new Date(rawDateObj);
    checkupDateObj.setFullYear(checkupDateObj.getFullYear() + 1);

    if (rxData.nextCheckupDate?.toDate) {
        checkupDateObj = rxData.nextCheckupDate.toDate();
        nextCheckupText = checkupDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } else if (rxData.nextCheckup) {
        checkupDateObj = new Date(rxData.nextCheckup);
        nextCheckupText = checkupDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } else {
        nextCheckupText = checkupDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    document.getElementById('rxNextCheckupDateDisplay').textContent = `Scheduled on: ${nextCheckupText}`;

    // Google Calendar reminder link
    const calBtn = document.getElementById('btnAddToCalendar');
    if (calBtn && checkupDateObj && !isNaN(checkupDateObj)) {
        const startISO = checkupDateObj.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const endObj = new Date(checkupDateObj.getTime() + 60 * 60 * 1000);
        const endISO = endObj.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const calTitle = encodeURIComponent(`Eye Prescription Checkup - ${clinicName}`);
        const calDetails = encodeURIComponent(`Annual routine eye checkup reminder issued by ${clinicName}. Patient: ${rxData.patientName || ''}`);
        calBtn.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${startISO}/${endISO}&details=${calDetails}`;
    }

    // Clinic Contact Quick Actions
    const callBtn = document.getElementById('btnCallClinic');
    const waClinicBtn = document.getElementById('btnWhatsAppClinic');

    if (clinicPhone) {
        const cleanPhone = clinicPhone.replace(/\D/g, '');
        if (callBtn) {
            callBtn.href = `tel:${cleanPhone}`;
            callBtn.style.display = 'inline-flex';
        }
        if (waClinicBtn) {
            const waText = encodeURIComponent(`Hello ${clinicName}, I am ${rxData.patientName || 'a patient'} checking my digital prescription.`);
            waClinicBtn.href = `https://wa.me/91${cleanPhone.slice(-10)}?text=${waText}`;
            waClinicBtn.style.display = 'inline-flex';
        }
    } else {
        if (callBtn) callBtn.style.display = 'none';
        if (waClinicBtn) waClinicBtn.style.display = 'none';
    }

    // Reveal container smoothly
    cardContainer.style.display = 'block';
    cardContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Format optical power values
 */
function formatPower(val) {
    if (val === undefined || val === null || val === '') return '0.00';
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (num > 0) return `+${num.toFixed(2)}`;
    return num.toFixed(2);
}

/**
 * Download high-resolution PNG image of the prescription
 */
async function downloadPrescriptionImage() {
    const card = document.getElementById('digitalPrescriptionCard');
    if (!card) return;

    showPortalMessage('Preparing high-resolution prescription image...', 'alert-info');

    try {
        const canvas = await html2canvas(card, {
            scale: 2.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        });

        const imageURL = canvas.toDataURL('image/png');
        const patientName = document.getElementById('rxPatientNameDisplay')?.textContent || 'Patient';
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `Prescription_${patientName.replace(/\s+/g, '_')}_${dateStr}.png`;

        const downloadLink = document.createElement('a');
        downloadLink.href = imageURL;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        showPortalMessage('Prescription image downloaded successfully!', 'alert-success');
    } catch (err) {
        console.error('Download error:', err);
        showPortalMessage('Could not generate image. You can use the Print / PDF button instead.', 'alert-warning');
    }
}

/**
 * Print prescription or save as PDF
 */
function printPrescription() {
    window.print();
}

/**
 * Share prescription summary on WhatsApp
 */
function shareOnWhatsApp() {
    const patientName = document.getElementById('rxPatientNameDisplay')?.textContent || 'Patient';
    const clinicName = document.getElementById('clinicNameDisplay')?.textContent?.trim() || 'Eye Clinic';
    const date = document.getElementById('rxDateDisplay')?.textContent || '';
    const rSPH = document.getElementById('rxRightDistSPH')?.textContent || '0.00';
    const rCYL = document.getElementById('rxRightDistCYL')?.textContent || '0.00';
    const rAXIS = document.getElementById('rxRightDistAXIS')?.textContent || '--';
    const rVA = document.getElementById('rxRightDistVA')?.textContent || '6/6';
    const lSPH = document.getElementById('rxLeftDistSPH')?.textContent || '0.00';
    const lCYL = document.getElementById('rxLeftDistCYL')?.textContent || '0.00';
    const lAXIS = document.getElementById('rxLeftDistAXIS')?.textContent || '--';
    const lVA = document.getElementById('rxLeftDistVA')?.textContent || '6/6';

    const msg = 
`📋 *Eye Prescription Details*
👤 *Patient:* ${patientName}
🏥 *Clinic:* ${clinicName}
📅 *Date:* ${date}

👁️ *Right Eye (OD):*
SPH: ${rSPH} | CYL: ${rCYL} | AXIS: ${rAXIS} | V/A: ${rVA}

👁️ *Left Eye (OS):*
SPH: ${lSPH} | CYL: ${lCYL} | AXIS: ${lAXIS} | V/A: ${lVA}

🔗 *View Online:* ${window.location.origin}/patient.html`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
}

/**
 * Portal notification helper
 */
function showPortalMessage(msg, type = 'alert-info') {
    const alertBox = document.getElementById('messageBox');
    const textEl = document.getElementById('messageText');
    const iconEl = document.getElementById('messageIcon');

    if (!alertBox || !textEl) return;

    textEl.textContent = msg;
    alertBox.className = `portal-alert ${type}`;

    if (iconEl) {
        if (type === 'alert-success') iconEl.className = 'fas fa-check-circle';
        else if (type === 'alert-warning') iconEl.className = 'fas fa-exclamation-triangle';
        else if (type === 'alert-danger') iconEl.className = 'fas fa-times-circle';
        else iconEl.className = 'fas fa-info-circle';
    }

    alertBox.style.display = 'flex';

    if (type === 'alert-success') {
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 5000);
    }
}
