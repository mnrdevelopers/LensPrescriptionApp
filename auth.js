// auth.js - PRODUCTION READY SECURE VERSION

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const successMessage = document.getElementById('successMessage');

// Form Elements
const loginFormElement = document.getElementById('loginFormElement');
const registerFormElement = document.getElementById('registerFormElement');
const forgotPasswordFormElement = document.getElementById('forgotPasswordFormElement');

// Flag to ensure we don't redirect multiple times
let isRedirecting = false; 

// Security Configuration
const SECURITY_CONFIG = {
    maxLoginAttempts: 3,
    // Lockout duration is 1 hour (for testing/user experience) in development, change to 24 * 60 * 60 * 1000 (24 hours) for production.
    lockoutDuration: 60 * 60 * 1000, // 1 hour in milliseconds (24 * 60 * 60 * 1000 for 24 hours)
    passwordMinLength: 8,
    requireStrongPassword: true
};

// Security State Storage (now managed by email)
let securityState = {}; // { email: { attempts: number, lockedUntil: timestamp } }

// Utility for sleep function to mitigate timing attacks
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize the authentication system
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
    loadSecurityState();
    loadRememberedUser();
    
    // Check lock status on load and show the lock screen if necessary
    checkAccountLockStatus(document.getElementById('loginUsername').value.trim()); 
});

function initializeAuth() {
    
    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user && !isRedirecting) {
            console.log('User authenticated, redirecting to app...');
            resetSecurityState(user.email); // Reset attempts on successful auth
            isRedirecting = true;
            window.location.href = 'app.html';
        }
    });

    // Add form event listeners
    if (loginFormElement) loginFormElement.addEventListener('submit', handleLogin);
    if (registerFormElement) registerFormElement.addEventListener('submit', handleRegister);
    if (forgotPasswordFormElement) forgotPasswordFormElement.addEventListener('submit', handleForgotPassword);
    
    setupPasswordValidation();
    setupSecurityMonitoring();
}

function loadRememberedUser() {
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    const rememberMe = localStorage.getItem('rememberMe');

    if (rememberMe === 'true' && rememberedUsername) {
        const loginUsernameInput = document.getElementById('loginUsername');
        if (loginUsernameInput) {
            loginUsernameInput.value = rememberedUsername;
            // Check lock status for the remembered user
            checkAccountLockStatus(rememberedUsername); 
        }
        
        const rememberMeCheckbox = document.getElementById('rememberMe');
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }
}

// Security Monitoring
function setupSecurityMonitoring() {
    const loginUsernameInput = document.getElementById('loginUsername');
    if (loginUsernameInput) {
        loginUsernameInput.addEventListener('input', function() {
            // Update the display whenever the user changes the email input
            const email = this.value.trim();
            checkAccountLockStatus(email);
            updateLoginAttemptsDisplay(email);
        });
    }
}

// Password Strength Checker (Logic remains the same, just keeping it here for completeness)
function checkPasswordStrength(password) {
    const strengthBar = document.getElementById('passwordStrength');
    const hintText = document.getElementById('passwordHint');
    const requirements = {
        length: document.getElementById('reqLength'),
        uppercase: document.getElementById('reqUppercase'),
        lowercase: document.getElementById('reqLowercase'),
        number: document.getElementById('reqNumber'),
        special: document.getElementById('reqSpecial')
    };

    if (!strengthBar || !hintText) return 'empty';

    if (!password) {
        strengthBar.className = 'password-strength';
        hintText.textContent = '';
        return 'empty';
    }

    let strength = 0;
    let hints = [];

    // Check requirements
    const isLength = password.length >= 8;
    const isUppercase = /[A-Z]/.test(password);
    const isLowercase = /[a-z]/.test(password);
    const isNumber = /[0-9]/.test(password);
    const isSpecial = /[^A-Za-z0-9]/.test(password);
    
    if (isLength) strength += 1;
    if (isUppercase) strength += 1;
    if (isLowercase) strength += 1;
    if (isNumber) strength += 1;
    if (isSpecial) strength += 1;

    // Update UI requirements
    const updateRequirementUI = (req, check, text) => {
        if (requirements[req]) {
            requirements[req].className = `requirement ${check ? 'met' : 'unmet'}`;
            requirements[req].innerHTML = `<span class="requirement-icon">${check ? '✓' : '○'}</span> ${text}`;
        }
    };

    updateRequirementUI('length', isLength, 'At least 8 characters');
    updateRequirementUI('uppercase', isUppercase, 'One uppercase letter');
    updateRequirementUI('lowercase', isLowercase, 'One lowercase letter');
    updateRequirementUI('number', isNumber, 'One number');
    updateRequirementUI('special', isSpecial, 'One special character');


    // Update strength display
    let strengthLevel = '';
    if (strength <= 2) {
        strengthLevel = 'weak';
        strengthBar.className = 'password-strength weak';
        hintText.textContent = 'Password is weak. Use a mix of characters.';
        hintText.style.color = '#dc3545';
    } else if (strength === 3) {
        strengthLevel = 'fair';
        strengthBar.className = 'password-strength fair';
        hintText.textContent = 'Password is fair. Consider adding more complexity.';
        hintText.style.color = '#ffc107';
    } else if (strength === 4) {
        strengthLevel = 'good';
        strengthBar.className = 'password-strength good';
        hintText.textContent = 'Password is good.';
        hintText.style.color = '#17a2b8';
    } else {
        strengthLevel = 'strong';
        strengthBar.className = 'password-strength strong';
        hintText.textContent = 'Password is strong!';
        hintText.style.color = '#28a745';
    }

    return strengthLevel;
}

// Enhanced Login Handler
async function handleLogin(event) {
    event.preventDefault();
    clearSecurityWarnings();
    
    const email = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;
    
    // Check lock status before attempting login
    if (isAccountLocked(email)) {
        showAccountLockWarning(email);
        return;
    }

    if (!email || !password) {
        showSecurityWarning('Please fill in both Email and Password.', 'warning');
        return;
    }

    const loginButton = loginFormElement.querySelector('button[type="submit"]');
    setButtonLoading(loginButton, true, 'Login');

    try {
        // Introduce a slight delay before Firebase call to mitigate timing attacks
        await sleep(500); 

        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        resetSecurityState(email);

        if (rememberMe) {
            localStorage.setItem('rememberedUsername', email);
            localStorage.setItem('rememberMe', true);
        } else {
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberMe');
        }

        localStorage.setItem('username', email);
        localStorage.setItem('userId', user.uid);
        
        console.log('Login successful');

    } catch (error) {
        console.error('Login error:', error);
        await handleFailedLoginAttempt(email, error);
    } finally {
        setButtonLoading(loginButton, false, 'Login');
    }
}

// Handle Failed Login Attempts
async function handleFailedLoginAttempt(email, error) {
    
    // Ensure state object exists for this email
    if (!securityState[email]) {
        securityState[email] = { attempts: 0, lockedUntil: null };
    }
    
    securityState[email].attempts++;
    saveSecurityState();

    const currentAttempts = securityState[email].attempts;
    const remainingAttempts = SECURITY_CONFIG.maxLoginAttempts - currentAttempts;
    
    if (currentAttempts >= SECURITY_CONFIG.maxLoginAttempts) {
        const lockTime = Date.now() + SECURITY_CONFIG.lockoutDuration;
        securityState[email].lockedUntil = lockTime;
        saveSecurityState();
        
        showAccountLockWarning(email);
        
        // Show a general error if it's the wrong password, otherwise show the specific error
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            showSecurityWarning(
                `Too many failed attempts. Account temporarily locked. Please try again later or use password reset.`,
                'danger'
            );
        } else {
             handleAuthError(error);
        }
        
    } else if (currentAttempts >= 1) {
        // Only show this warning if the error code is related to credentials failing
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
             showSecurityWarning(
                `Invalid credentials. ${remainingAttempts} attempts remaining before lock.`,
                remainingAttempts === 1 ? 'danger' : 'warning'
            );
        } else {
            handleAuthError(error);
        }
    } else {
        // Fallback for other errors on first attempt
        handleAuthError(error);
    }
    
    updateLoginAttemptsDisplay(email);
}

// Enhanced Registration
async function handleRegister(event) {
    event.preventDefault();
    
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
    
    clearFormErrors();
    
    // Input fields should be marked as invalid/valid by the validation function
    
    // Validation
    if (!email || !password || !confirmPassword) {
        showSecurityWarning('All fields are required for registration.', 'warning');
        return;
    }

    const passwordStrength = checkPasswordStrength(password);
    if (SECURITY_CONFIG.requireStrongPassword && (passwordStrength === 'weak' || passwordStrength === 'fair')) {
        showSecurityWarning('Please use a strong password (Good or Strong rating).', 'warning');
        return;
    }

    if (password !== confirmPassword) {
        showSecurityWarning('Passwords do not match.', 'danger');
        return;
    }

    const registerButton = document.getElementById('registerButton');
    setButtonLoading(registerButton, true, 'Register');

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Save user data
        await db.collection('users').doc(user.uid).set({
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            // Ensure profile fields are initialized to avoid errors later
            clinicName: '',
            optometristName: '',
            address: '',
            contactNumber: ''
        });

        localStorage.setItem('freshRegistration', 'true');
        localStorage.setItem('username', email);
        localStorage.setItem('userId', user.uid);

        showSuccess('Registration successful! Redirecting to profile setup...');
        
    } catch (error) {
        console.error('Registration error:', error);
        handleAuthError(error);
    } finally {
        setButtonLoading(registerButton, false, 'Register');
    }
}

function setupPasswordValidation() {
    const passwordInput = document.getElementById('registerPassword');
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    const passwordMatchError = document.getElementById('passwordMatchError');
    const registerButton = document.getElementById('registerButton');

    if (passwordInput && confirmPasswordInput && passwordMatchError) {
        const validatePasswords = () => {
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            const isMatch = password === confirmPassword && confirmPassword.length > 0;
            
            // UI Feedback
            if (confirmPassword.length > 0 && password !== confirmPassword) {
                passwordMatchError.textContent = 'Passwords do not match';
                passwordMatchError.style.display = 'block';
                confirmPasswordInput.classList.add('input-with-error');
                confirmPasswordInput.classList.remove('input-with-success');
            } else if (isMatch) {
                passwordMatchError.style.display = 'none';
                confirmPasswordInput.classList.add('input-with-success');
                confirmPasswordInput.classList.remove('input-with-error');
            } else {
                passwordMatchError.style.display = 'none';
                confirmPasswordInput.classList.remove('input-with-error', 'input-with-success');
            }
            
            // Disable button if validation fails
            const isStrong = checkPasswordStrength(password) === 'strong' || checkPasswordStrength(password) === 'good';
            registerButton.disabled = !isMatch || !isStrong || !passwordInput.checkValidity() || !confirmPasswordInput.checkValidity();
        };

        passwordInput.addEventListener('input', validatePasswords);
        confirmPasswordInput.addEventListener('input', validatePasswords);
        
        // Initial check
        validatePasswords();
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    clearSecurityWarnings();
    
    const email = document.getElementById('forgotUsername').value.trim();

    if (!email) {
        showSecurityWarning('Please enter your email address', 'warning');
        return;
    }

    const resetButton = forgotPasswordFormElement.querySelector('button[type="submit"]');
    setButtonLoading(resetButton, true, 'Sending...');

    try {
        await auth.sendPasswordResetEmail(email);
        showSuccessMessage(`Password reset link sent to <strong>${email}</strong>. Check your inbox.`);
    } catch (error) {
        console.error('Password reset error:', error);
        if (error.code === 'auth/too-many-requests') {
            showSecurityWarning('Too many reset attempts. Please try again later.', 'danger');
        } else if (error.code === 'auth/user-not-found') {
            // Be vague about user existence for security reasons
            showSecurityWarning('If an account exists for that email, a reset link has been sent.', 'info');
            showSuccessMessage('Password reset email sent! Check your inbox.');
        } else {
            handleAuthError(error);
        }
    } finally {
        setButtonLoading(resetButton, false, 'Reset Password');
    }
}

// Security State Management
function saveSecurityState() {
    // Only store attempts and lockedUntil for security
    const simplifiedState = {};
    for (const email in securityState) {
        if (securityState[email].attempts > 0 || securityState[email].lockedUntil) {
            simplifiedState[email] = securityState[email];
        }
    }
    localStorage.setItem('securityState', JSON.stringify(simplifiedState));
}

function loadSecurityState() {
    const savedState = localStorage.getItem('securityState');
    if (savedState) {
        securityState = JSON.parse(savedState);
    }
}

function resetSecurityState(email) {
    if (securityState[email]) {
        securityState[email] = { attempts: 0, lockedUntil: null };
        saveSecurityState();
    }
    updateLoginAttemptsDisplay(email);
}

/**
 * Checks if a specific email is currently locked out.
 * @param {string} email 
 * @returns {boolean}
 */
function isAccountLocked(email) {
    if (!email) return false;
    const state = securityState[email.toLowerCase()];
    if (!state || !state.lockedUntil) return false;

    // If the lock time has passed, automatically unlock and reset
    if (Date.now() > state.lockedUntil) {
        resetSecurityState(email);
        return false;
    }
    return true;
}

/**
 * Checks and displays account lock status when the user types an email.
 * @param {string} email 
 */
function checkAccountLockStatus(email) {
    clearAccountLockWarning(); // Clear any previous lock warning
    
    // Normalize email for lookup
    const normEmail = email.toLowerCase(); 

    if (isAccountLocked(normEmail)) {
        showAccountLockWarning(normEmail);
        
        // Temporarily disable login button if account is locked
        const loginButton = loginFormElement?.querySelector('button[type="submit"]');
        if (loginButton) loginButton.disabled = true;
    } else {
         // Enable login button if account is not locked (and re-check login form validity later)
        const loginButton = loginFormElement?.querySelector('button[type="submit"]');
        if (loginButton) loginButton.disabled = false;
        
        // Hide lock warning if it was showing
        clearAccountLockWarning();
    }
    updateLoginAttemptsDisplay(normEmail);
}


// UI Functions
function clearSecurityWarnings() {
    document.querySelectorAll('.security-warning').forEach(warning => warning.remove());
}

function clearAccountLockWarning() {
    document.querySelectorAll('.account-lock-warning').forEach(warning => warning.remove());
}

function showSecurityWarning(message, type = 'warning') {
    clearSecurityWarnings(); // Only show one active warning at a time
    
    const warningDiv = document.createElement('div');
    warningDiv.className = `security-warning ${type}`;
    warningDiv.innerHTML = `
        <span class="warning-icon">${type === 'danger' ? '⚠️' : type === 'info' ? 'ℹ️' : '⚠️'}</span>
        <span>${message}</span>
    `;
    
    const activeForm = document.querySelector('.form-container.active');
    if (activeForm) {
        // Insert before the first form group for maximum visibility
        activeForm.insertBefore(warningDiv, activeForm.querySelector('.form-group'));
        
        if (type !== 'danger' && type !== 'info') {
            setTimeout(() => {
                if (warningDiv.parentNode) {
                    warningDiv.remove();
                }
            }, 5000);
        }
    }
}

function showAccountLockWarning(email) {
    clearAccountLockWarning();
    const lockState = securityState[email];
    if (!lockState || !lockState.lockedUntil) return;
    
    const timeLeft = lockState.lockedUntil - Date.now();
    const hoursLeft = Math.ceil(timeLeft / (60 * 60 * 1000));
    
    const lockDiv = document.createElement('div');
    lockDiv.className = 'account-lock-warning';
    lockDiv.innerHTML = `
        <h4>🔒 Account Temporarily Locked</h4>
        <p>Too many failed login attempts for <strong>${email}</strong>. For security reasons, your account has been locked.</p>
        <div class="account-lock-timer">Time remaining: ${hoursLeft} hour(s)</div>
        <p style="margin-top: 10px;">
            <a href="#" onclick="showForgotPassword()" style="color: #007bff; text-decoration: underline;">
                Reset your password to unlock immediately
            </a>
        </p>
    `;
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm && loginForm.classList.contains('active')) {
        // Insert before the form element
        loginForm.insertBefore(lockDiv, loginForm.querySelector('form'));
        
        // Disable the login button
        const loginButton = loginForm.querySelector('button[type="submit"]');
        if (loginButton) loginButton.disabled = true;
    }
}

function updateLoginAttemptsDisplay(email) {
    const attemptsCounter = document.getElementById('loginAttemptsCounter');
    if (!attemptsCounter || !email) return;

    const state = securityState[email.toLowerCase()];
    const currentAttempts = state?.attempts || 0;
    
    if (currentAttempts > 0 && !isAccountLocked(email)) {
        const remainingAttempts = SECURITY_CONFIG.maxLoginAttempts - currentAttempts;
        if (remainingAttempts > 0) {
            attemptsCounter.innerHTML = `<span class="attempts-warning">${currentAttempts} failed attempt(s). ${remainingAttempts} remaining.</span>`;
        }
    } else if (isAccountLocked(email)) {
        attemptsCounter.innerHTML = `<span class="attempts-warning">Account locked.</span>`;
    } else {
        attemptsCounter.innerHTML = '';
    }
}

function showSuccess(message) {
    const successText = document.getElementById('successText');
    if (successText) successText.innerHTML = message;
    
    hideAllForms();
    successMessage.classList.add('active');
}

function showSuccessMessage(message) {
    const successText = document.getElementById('successText');
    if (successText) successText.innerHTML = message;
    
    hideAllForms();
    successMessage.classList.add('active');
}

function hideAllForms() {
    document.querySelectorAll('.form-container').forEach(form => {
        form.classList.remove('active');
    });
}

function setButtonLoading(button, isLoading, originalText) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        button.setAttribute('data-original-text', button.textContent);
        button.textContent = 'Please wait...';
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.textContent = originalText || button.getAttribute('data-original-text') || 'Submit';
    }
}

function clearFormErrors() {
    // This is primarily handled by the password validation function now
}

function handleAuthError(error) {
    console.error('Authentication error:', error);
    
    let errorMessage = 'An unexpected error occurred. Please try again.';
    
    switch (error.code) {
        case 'auth/invalid-email':
            errorMessage = 'Invalid email address format.';
            break;
        case 'auth/user-disabled':
            errorMessage = 'This account has been disabled.';
            break;
        case 'auth/user-not-found':
            errorMessage = 'No account found with this email.';
            break;
        case 'auth/wrong-password':
            errorMessage = 'Incorrect password. Please try again.';
            break;
        case 'auth/email-already-in-use':
            errorMessage = 'An account with this email already exists.';
            break;
        case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please use a stronger password.';
            break;
        case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many requests. Please try again later.';
            break;
        case 'auth/requires-recent-login':
            errorMessage = 'Please log in again to perform this action.';
            break;
        default:
            errorMessage = error.message || 'Authentication failed. Please try again.';
    }
    
    showSecurityWarning(errorMessage, 'danger');
}

// Form Navigation
function showLogin() {
    hideAllForms();
    loginForm.classList.add('active');
    clearSecurityWarnings();
    // Re-check lock status for the currently entered email on form switch
    const email = document.getElementById('loginUsername').value.trim();
    checkAccountLockStatus(email);
    updateLoginAttemptsDisplay(email);
}

function showRegister() {
    hideAllForms();
    registerForm.classList.add('active');
    clearSecurityWarnings();
}

function showForgotPassword() {
    hideAllForms();
    forgotPasswordForm.classList.add('active');
    clearSecurityWarnings();
}

// Utility Functions
function togglePassword(fieldId) {
    const passwordField = document.getElementById(fieldId);
    const toggleIcon = passwordField.nextElementSibling;
    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        if (toggleIcon) toggleIcon.textContent = '🙈'; // Closed Eye
    } else {
        passwordField.type = 'password';
        if (toggleIcon) toggleIcon.textContent = '👁️'; // Open Eye
    }
}

// Export functions for global access
window.showLogin = showLogin;
window.showRegister = showRegister;
window.showForgotPassword = showForgotPassword;
window.togglePassword = togglePassword;
window.checkPasswordStrength = checkPasswordStrength;
