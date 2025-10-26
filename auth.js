// auth.js - ENHANCED WITH PROPER USER VALIDATION

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
    maxLoginAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes in milliseconds
    passwordMinLength: 8,
    requireStrongPassword: true
};

// Security State
let loginAttempts = 0;
let accountLockedUntil = null;
let currentUserEmail = null;

// Initialize the authentication system
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
    loadRememberedUser();
});

function initializeAuth() {
    loadSecurityState();
    checkAccountLockStatus();
    
    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user && !isRedirecting) {
            console.log('User authenticated, redirecting to app...');
            resetSecurityState();
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
    setupRealTimeValidation();
}

function setupRealTimeValidation() {
    // Real-time email validation for login
    const loginEmailInput = document.getElementById('loginUsername');
    if (loginEmailInput) {
        loginEmailInput.addEventListener('blur', function() {
            validateEmailFormat(this.value, 'login');
        });
    }

    // Real-time email validation for register
    const registerEmailInput = document.getElementById('registerEmail');
    if (registerEmailInput) {
        registerEmailInput.addEventListener('blur', function() {
            validateEmailFormat(this.value, 'register');
            checkEmailAvailability(this.value);
        });
    }
}

function validateEmailFormat(email, formType) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) return true;
    
    if (!emailRegex.test(email)) {
        showFieldError(`${formType === 'login' ? 'loginUsername' : 'registerEmail'}`, 'Please enter a valid email address');
        return false;
    } else {
        clearFieldError(`${formType === 'login' ? 'loginUsername' : 'registerEmail'}`);
        return true;
    }
}

async function checkEmailAvailability(email) {
    if (!email || !validateEmailFormat(email, 'register')) return;

    try {
        // Check if email already exists by attempting to fetch sign-in methods
        const methods = await auth.fetchSignInMethodsForEmail(email);
        if (methods && methods.length > 0) {
            showFieldError('registerEmail', 'An account with this email already exists');
            return false;
        } else {
            clearFieldError('registerEmail');
            return true;
        }
    } catch (error) {
        console.log('Email availability check:', error);
        return true; // Assume available if check fails
    }
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    // Remove existing error
    clearFieldError(fieldId);

    // Add error styling
    field.classList.add('input-with-error');
    
    // Create error message element
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error-message';
    errorElement.textContent = message;
    errorElement.style.cssText = `
        color: #dc3545;
        font-size: 12px;
        margin-top: 5px;
        display: block;
    `;
    
    field.parentNode.appendChild(errorElement);
}

function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.remove('input-with-error');
    
    const existingError = field.parentNode.querySelector('.field-error-message');
    if (existingError) {
        existingError.remove();
    }
}

function loadRememberedUser() {
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    const rememberMe = localStorage.getItem('rememberMe');

    if (rememberMe === 'true' && rememberedUsername) {
        const loginUsernameInput = document.getElementById('loginUsername');
        if (loginUsernameInput) loginUsernameInput.value = rememberedUsername;
        
        const rememberMeCheckbox = document.getElementById('rememberMe');
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }
}

// Security Monitoring
function setupSecurityMonitoring() {
    const loginPasswordInput = document.getElementById('loginPassword');
    if (loginPasswordInput) {
        loginPasswordInput.addEventListener('input', function() {
            updateLoginAttemptsDisplay();
        });
    }
}

// Password Strength Checker
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
    if (password.length >= 8) {
        strength += 1;
        if (requirements.length) {
            requirements.length.className = 'requirement met';
            requirements.length.innerHTML = '<span class="requirement-icon">✓</span> At least 8 characters';
        }
    } else {
        if (requirements.length) {
            requirements.length.className = 'requirement unmet';
            requirements.length.innerHTML = '<span class="requirement-icon">○</span> At least 8 characters';
        }
        hints.push('Use at least 8 characters');
    }

    if (/[A-Z]/.test(password)) {
        strength += 1;
        if (requirements.uppercase) {
            requirements.uppercase.className = 'requirement met';
            requirements.uppercase.innerHTML = '<span class="requirement-icon">✓</span> One uppercase letter';
        }
    } else {
        if (requirements.uppercase) {
            requirements.uppercase.className = 'requirement unmet';
            requirements.uppercase.innerHTML = '<span class="requirement-icon">○</span> One uppercase letter';
        }
        hints.push('Add an uppercase letter (A-Z)');
    }

    if (/[a-z]/.test(password)) {
        strength += 1;
        if (requirements.lowercase) {
            requirements.lowercase.className = 'requirement met';
            requirements.lowercase.innerHTML = '<span class="requirement-icon">✓</span> One lowercase letter';
        }
    } else {
        if (requirements.lowercase) {
            requirements.lowercase.className = 'requirement unmet';
            requirements.lowercase.innerHTML = '<span class="requirement-icon">○</span> One lowercase letter';
        }
        hints.push('Add a lowercase letter (a-z)');
    }

    if (/[0-9]/.test(password)) {
        strength += 1;
        if (requirements.number) {
            requirements.number.className = 'requirement met';
            requirements.number.innerHTML = '<span class="requirement-icon">✓</span> One number';
        }
    } else {
        if (requirements.number) {
            requirements.number.className = 'requirement unmet';
            requirements.number.innerHTML = '<span class="requirement-icon">○</span> One number';
        }
        hints.push('Include a number (0-9)');
    }

    if (/[^A-Za-z0-9]/.test(password)) {
        strength += 1;
        if (requirements.special) {
            requirements.special.className = 'requirement met';
            requirements.special.innerHTML = '<span class="requirement-icon">✓</span> One special character';
        }
    } else {
        if (requirements.special) {
            requirements.special.className = 'requirement unmet';
            requirements.special.innerHTML = '<span class="requirement-icon">○</span> One special character';
        }
        hints.push('Add a special character (!@#$% etc.)');
    }

    // Update strength display
    let strengthLevel = '';
    if (strength <= 2) {
        strengthLevel = 'weak';
        strengthBar.className = 'password-strength weak';
        hintText.textContent = 'Password is weak. ' + (hints[0] || '');
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

// Enhanced Login Handler with proper user validation
async function handleLogin(event) {
    event.preventDefault();
    
    if (isAccountLocked()) {
        showAccountLockWarning();
        return;
    }

    const email = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;

    // Clear previous errors
    clearFormErrors();

    // Validation
    if (!email || !password) {
        showSecurityWarning('Please fill in all fields', 'warning');
        if (!email) showFieldError('loginUsername', 'Email is required');
        if (!password) showFieldError('loginPassword', 'Password is required');
        return;
    }

    // Validate email format
    if (!validateEmailFormat(email, 'login')) {
        return;
    }

    currentUserEmail = email;
    const loginButton = loginFormElement.querySelector('button[type="submit"]');
    setButtonLoading(loginButton, true, 'Login');

    try {
        // First, check if user exists
        const signInMethods = await auth.fetchSignInMethodsForEmail(email);
        
        if (signInMethods.length === 0) {
            // User doesn't exist
            loginAttempts++;
            saveSecurityState();
            showSecurityWarning('No account found with this email address. Please check your email or register for a new account.', 'warning');
            showFieldError('loginUsername', 'Account not found');
            updateLoginAttemptsDisplay();
            return;
        }

        // User exists, attempt login
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Successful login
        resetSecurityState();

        if (rememberMe) {
            localStorage.setItem('rememberedUsername', email);
            localStorage.setItem('rememberMe', 'true');
        } else {
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberMe');
        }

        localStorage.setItem('username', email);
        localStorage.setItem('userId', user.uid);
        
        console.log('Login successful - redirecting to app');

    } catch (error) {
        console.error('Login error:', error);
        await handleFailedLoginAttempt(error, email);
    } finally {
        setButtonLoading(loginButton, false, 'Login');
    }
}

// Enhanced failed login handler
async function handleFailedLoginAttempt(error, email) {
    loginAttempts++;
    saveSecurityState();

    const remainingAttempts = SECURITY_CONFIG.maxLoginAttempts - loginAttempts;
    
    // Clear previous errors
    clearFieldError('loginUsername');
    clearFieldError('loginPassword');

    if (loginAttempts >= SECURITY_CONFIG.maxLoginAttempts) {
        accountLockedUntil = Date.now() + SECURITY_CONFIG.lockoutDuration;
        saveSecurityState();
        
        showAccountLockWarning();
        showSecurityWarning(
            `Account temporarily locked due to too many failed attempts. Please try again in 30 minutes or reset your password.`,
            'danger'
        );
        
        // Send email notification about lockout
        await sendLockoutNotification(email);
    } else {
        // Show specific error messages
        switch (error.code) {
            case 'auth/wrong-password':
                showFieldError('loginPassword', 'Incorrect password');
                showSecurityWarning(
                    `Incorrect password. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
                    remainingAttempts <= 2 ? 'danger' : 'warning'
                );
                break;
                
            case 'auth/user-disabled':
                showSecurityWarning('This account has been disabled. Please contact support.', 'danger');
                break;
                
            case 'auth/invalid-credential':
            case 'auth/invalid-email':
                showFieldError('loginUsername', 'Invalid email address');
                showSecurityWarning('Please check your email address and try again.', 'warning');
                break;
                
            case 'auth/too-many-requests':
                showSecurityWarning('Too many login attempts. Please try again later.', 'danger');
                break;
                
            default:
                showSecurityWarning('Login failed. Please check your credentials and try again.', 'warning');
        }
    }
    
    updateLoginAttemptsDisplay();
}

async function sendLockoutNotification(email) {
    try {
        // In a real application, you would send this to your backend
        console.log(`Account lockout notification for: ${email}`);
        // await db.collection('securityLogs').add({
        //     email: email,
        //     type: 'account_lockout',
        //     timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        //     attempts: loginAttempts
        // });
    } catch (error) {
        console.error('Failed to log lockout:', error);
    }
}

// Enhanced Registration with proper validation
async function handleRegister(event) {
    event.preventDefault();
    
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
    
    // Clear previous errors
    clearFormErrors();
    const passwordMatchError = document.getElementById('passwordMatchError');
    if (passwordMatchError) passwordMatchError.style.display = 'none';

    // Validation
    let hasErrors = false;

    if (!email) {
        showFieldError('registerEmail', 'Email is required');
        hasErrors = true;
    } else if (!validateEmailFormat(email, 'register')) {
        hasErrors = true;
    }

    if (!password) {
        showFieldError('registerPassword', 'Password is required');
        hasErrors = true;
    }

    if (!confirmPassword) {
        showFieldError('registerConfirmPassword', 'Please confirm your password');
        hasErrors = true;
    }

    if (hasErrors) {
        showSecurityWarning('Please fix the errors above', 'warning');
        return;
    }

    // Check password strength
    const passwordStrength = checkPasswordStrength(password);
    if (SECURITY_CONFIG.requireStrongPassword && passwordStrength === 'weak') {
        showSecurityWarning('Please use a stronger password. Your password should include uppercase letters, numbers, and special characters.', 'warning');
        return;
    }

    // Check password match
    if (password !== confirmPassword) {
        if (passwordMatchError) {
            passwordMatchError.textContent = 'Passwords do not match';
            passwordMatchError.style.display = 'block';
        }
        showFieldError('registerConfirmPassword', 'Passwords do not match');
        showSecurityWarning('Passwords do not match. Please check and try again.', 'warning');
        return;
    }

    // Check email availability
    const isEmailAvailable = await checkEmailAvailability(email);
    if (!isEmailAvailable) {
        showSecurityWarning('An account with this email already exists. Please use a different email or try logging in.', 'warning');
        return;
    }

    const registerButton = document.getElementById('registerButton');
    setButtonLoading(registerButton, true, 'Creating Account...');

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Save user data
        await db.collection('users').doc(user.uid).set({
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            profileCompleted: false
        });

        localStorage.setItem('freshRegistration', 'true');
        localStorage.setItem('username', email);
        localStorage.setItem('userId', user.uid);

        showSuccess('Registration successful! Setting up your account...');
        
        // Redirect after short delay
        setTimeout(() => {
            window.location.href = 'app.html';
        }, 2000);
        
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

    if (passwordInput && confirmPasswordInput && passwordMatchError) {
        const validatePasswords = () => {
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (confirmPassword === '') {
                passwordMatchError.style.display = 'none';
                clearFieldError('registerConfirmPassword');
                return;
            }

            if (password !== confirmPassword) {
                passwordMatchError.textContent = 'Passwords do not match';
                passwordMatchError.style.display = 'block';
                confirmPasswordInput.style.borderColor = '#dc3545';
                showFieldError('registerConfirmPassword', 'Passwords do not match');
            } else {
                passwordMatchError.style.display = 'none';
                confirmPasswordInput.style.borderColor = '#28a745';
                clearFieldError('registerConfirmPassword');
            }
        };

        passwordInput.addEventListener('input', validatePasswords);
        confirmPasswordInput.addEventListener('input', validatePasswords);
    }
}

// Enhanced Forgot Password with user validation
async function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('forgotUsername').value.trim();

    // Clear previous errors
    clearFormErrors();

    if (!email) {
        showFieldError('forgotUsername', 'Email is required');
        showSecurityWarning('Please enter your email address', 'warning');
        return;
    }

    if (!validateEmailFormat(email, 'forgot')) {
        return;
    }

    const resetButton = forgotPasswordFormElement.querySelector('button[type="submit"]');
    setButtonLoading(resetButton, true, 'Checking...');

    try {
        // Check if user exists before sending reset email
        const signInMethods = await auth.fetchSignInMethodsForEmail(email);
        
        if (signInMethods.length === 0) {
            showFieldError('forgotUsername', 'No account found with this email');
            showSecurityWarning('No account found with this email address. Please check your email or register for a new account.', 'warning');
            return;
        }

        // User exists, send reset email
        await auth.sendPasswordResetEmail(email);
        
        showSuccessMessage('Password reset email sent! Check your inbox for instructions to reset your password.');
        
    } catch (error) {
        console.error('Password reset error:', error);
        
        if (error.code === 'auth/too-many-requests') {
            showSecurityWarning('Too many reset attempts. Please try again in a few minutes.', 'danger');
        } else if (error.code === 'auth/user-not-found') {
            showFieldError('forgotUsername', 'No account found with this email');
            showSecurityWarning('No account found with this email address.', 'warning');
        } else {
            handleAuthError(error);
        }
    } finally {
        setButtonLoading(resetButton, false, 'Reset Password');
    }
}

// Security State Management
function saveSecurityState() {
    const securityState = {
        loginAttempts: loginAttempts,
        accountLockedUntil: accountLockedUntil,
        currentUserEmail: currentUserEmail
    };
    localStorage.setItem('securityState', JSON.stringify(securityState));
}

function loadSecurityState() {
    const savedState = localStorage.getItem('securityState');
    if (savedState) {
        const state = JSON.parse(savedState);
        loginAttempts = state.loginAttempts || 0;
        accountLockedUntil = state.accountLockedUntil || null;
        currentUserEmail = state.currentUserEmail || null;
    }
}

function resetSecurityState() {
    loginAttempts = 0;
    accountLockedUntil = null;
    currentUserEmail = null;
    saveSecurityState();
    updateLoginAttemptsDisplay();
}

function isAccountLocked() {
    return accountLockedUntil && Date.now() < accountLockedUntil;
}

function checkAccountLockStatus() {
    if (isAccountLocked()) {
        showAccountLockWarning();
    }
}

// UI Functions
function showSecurityWarning(message, type = 'warning') {
    const warningDiv = document.createElement('div');
    warningDiv.className = `security-warning ${type}`;
    warningDiv.innerHTML = `
        <span class="warning-icon">${type === 'danger' ? '⚠️' : type === 'info' ? 'ℹ️' : '⚠️'}</span>
        <span>${message}</span>
    `;
    
    const existingWarnings = document.querySelectorAll('.security-warning');
    existingWarnings.forEach(warning => warning.remove());
    
    const activeForm = document.querySelector('.form-container.active');
    if (activeForm) {
        activeForm.insertBefore(warningDiv, activeForm.querySelector('form'));
        
        if (type !== 'danger') {
            setTimeout(() => {
                if (warningDiv.parentNode) {
                    warningDiv.remove();
                }
            }, 5000);
        }
    }
}

function showAccountLockWarning() {
    if (!accountLockedUntil) return;
    
    const timeLeft = accountLockedUntil - Date.now();
    const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
    
    const lockDiv = document.createElement('div');
    lockDiv.className = 'account-lock-warning';
    lockDiv.innerHTML = `
        <h4>🔒 Account Temporarily Locked</h4>
        <p>Too many failed login attempts. For security reasons, your account has been locked.</p>
        <div class="account-lock-timer">Time remaining: ${minutesLeft} minutes</div>
        <p style="margin-top: 10px;">
            <a href="#" onclick="showForgotPassword()" style="color: #007bff; text-decoration: underline;">
                Reset your password to unlock immediately
            </a>
        </p>
    `;
    
    const existingWarnings = document.querySelectorAll('.account-lock-warning, .security-warning');
    existingWarnings.forEach(warning => warning.remove());
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.insertBefore(lockDiv, loginForm.querySelector('form'));
    }
}

function updateLoginAttemptsDisplay() {
    const attemptsCounter = document.getElementById('loginAttemptsCounter');
    if (!attemptsCounter) return;

    if (loginAttempts > 0) {
        const remainingAttempts = SECURITY_CONFIG.maxLoginAttempts - loginAttempts;
        if (remainingAttempts > 0) {
            attemptsCounter.innerHTML = `<span class="attempts-warning">${loginAttempts} failed attempt${loginAttempts !== 1 ? 's' : ''}. ${remainingAttempts} remaining.</span>`;
        } else {
            attemptsCounter.innerHTML = `<span class="attempts-warning">Account locked due to too many failed attempts.</span>`;
        }
    } else {
        attemptsCounter.innerHTML = '';
    }
}

function showSuccess(message) {
    const successText = document.getElementById('successText');
    if (successText) successText.textContent = message;
    
    hideAllForms();
    successMessage.classList.remove('hidden');
    successMessage.style.display = 'block';
}

function showSuccessMessage(message) {
    const successText = document.getElementById('successText');
    if (successText) successText.textContent = message;
    
    hideAllForms();
    successMessage.classList.remove('hidden');
    successMessage.style.display = 'block';
}

function hideAllForms() {
    document.querySelectorAll('.form-container').forEach(form => {
        form.classList.remove('active');
        form.style.display = 'none';
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
    // Clear field errors
    document.querySelectorAll('.field-error-message').forEach(error => {
        error.remove();
    });
    
    document.querySelectorAll('.input-with-error').forEach(input => {
        input.classList.remove('input-with-error');
    });
    
    // Clear password match error
    const passwordMatchError = document.getElementById('passwordMatchError');
    if (passwordMatchError) {
        passwordMatchError.style.display = 'none';
    }
    
    // Clear security warnings
    document.querySelectorAll('.security-warning').forEach(warning => {
        if (!warning.closest('.account-lock-warning')) {
            warning.remove();
        }
    });
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
            errorMessage = 'Too many attempts. Please try again later.';
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
    loginForm.style.display = 'block';
    clearFormErrors();
    updateLoginAttemptsDisplay();
}

function showRegister() {
    hideAllForms();
    registerForm.classList.add('active');
    registerForm.style.display = 'block';
    clearFormErrors();
}

function showForgotPassword() {
    hideAllForms();
    forgotPasswordForm.classList.add('active');
    forgotPasswordForm.style.display = 'block';
    clearFormErrors();
}

// Utility Functions
function togglePassword(fieldId) {
    const passwordField = document.getElementById(fieldId);
    const toggleButton = passwordField.parentElement.querySelector('.toggle-password');
    
    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        if (toggleButton) toggleButton.textContent = '🙈';
    } else {
        passwordField.type = 'password';
        if (toggleButton) toggleButton.textContent = '👁️';
    }
}

// Export functions for global access
window.showLogin = showLogin;
window.showRegister = showRegister;
window.showForgotPassword = showForgotPassword;
window.togglePassword = togglePassword;
window.checkPasswordStrength = checkPasswordStrength;
