// auth.js - ENHANCED SECURITY VERSION

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const successMessage = document.getElementById('successMessage');

// Form Elements
const loginFormElement = document.getElementById('loginFormElement');
const registerFormElement = document.getElementById('registerFormElement');
const forgotPasswordFormElement = document.getElementById('forgotPasswordFormElement');

// Security tracking
let isRedirecting = false;
let failedLoginAttempts = {};
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Password strength requirements
const PASSWORD_REQUIREMENTS = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
};

// Initialize the authentication system
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
    loadRememberedUser();
    loadFailedAttempts();
});

function initializeAuth() {
    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user && !isRedirecting) {
            console.log('User authenticated, redirecting to app...');
            // User is signed in, redirect to dashboard
            isRedirecting = true;
            window.location.href = 'app.html';
        }
    });

    // Add form event listeners
    if (loginFormElement) loginFormElement.addEventListener('submit', handleLogin);
    if (registerFormElement) registerFormElement.addEventListener('submit', handleRegister);
    if (forgotPasswordFormElement) forgotPasswordFormElement.addEventListener('submit', handleForgotPassword);

    // Setup password validation
    setupPasswordValidation();
    
    // Setup real-time password strength checking
    setupPasswordStrengthChecker();
}

function loadFailedAttempts() {
    const storedAttempts = localStorage.getItem('failedLoginAttempts');
    if (storedAttempts) {
        failedLoginAttempts = JSON.parse(storedAttempts);
        
        // Clean up expired lockouts
        const now = Date.now();
        Object.keys(failedLoginAttempts).forEach(email => {
            if (failedLoginAttempts[email].lockoutUntil && 
                failedLoginAttempts[email].lockoutUntil < now) {
                delete failedLoginAttempts[email];
            }
        });
        
        saveFailedAttempts();
    }
}

function saveFailedAttempts() {
    localStorage.setItem('failedLoginAttempts', JSON.stringify(failedLoginAttempts));
}

function isAccountLocked(email) {
    if (!failedLoginAttempts[email]) return false;
    
    const now = Date.now();
    if (failedLoginAttempts[email].lockoutUntil && 
        failedLoginAttempts[email].lockoutUntil > now) {
        return true;
    }
    
    // Reset attempts if lockout period has expired
    if (failedLoginAttempts[email].lockoutUntil && 
        failedLoginAttempts[email].lockoutUntil <= now) {
        delete failedLoginAttempts[email];
        saveFailedAttempts();
    }
    
    return false;
}

function getRemainingLockoutTime(email) {
    if (!failedLoginAttempts[email] || !failedLoginAttempts[email].lockoutUntil) return 0;
    
    const now = Date.now();
    const remaining = failedLoginAttempts[email].lockoutUntil - now;
    return Math.max(0, remaining);
}

function formatLockoutTime(ms) {
    const minutes = Math.ceil(ms / (60 * 1000));
    if (minutes <= 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
        const hours = Math.ceil(minutes / 60);
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
}

function recordFailedLoginAttempt(email) {
    if (!failedLoginAttempts[email]) {
        failedLoginAttempts[email] = {
            count: 0,
            lastAttempt: null,
            lockoutUntil: null
        };
    }
    
    failedLoginAttempts[email].count++;
    failedLoginAttempts[email].lastAttempt = Date.now();
    
    // Check if we should lock the account
    if (failedLoginAttempts[email].count >= MAX_LOGIN_ATTEMPTS) {
        failedLoginAttempts[email].lockoutUntil = Date.now() + LOCKOUT_DURATION;
        showSecurityWarning(`Account temporarily locked due to multiple failed login attempts. Please try again in ${formatLockoutTime(LOCKOUT_DURATION)}.`);
    } else {
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - failedLoginAttempts[email].count;
        showSecurityWarning(`Invalid credentials. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining before account lockout.`);
    }
    
    saveFailedAttempts();
}

function resetFailedLoginAttempts(email) {
    if (failedLoginAttempts[email]) {
        delete failedLoginAttempts[email];
        saveFailedAttempts();
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

// Form Handlers
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginUsername').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;

    // Validate inputs
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }

    // Check if account is locked
    if (isAccountLocked(email)) {
        const remainingTime = getRemainingLockoutTime(email);
        showSecurityWarning(`Account temporarily locked. Please try again in ${formatLockoutTime(remainingTime)}.`);
        return;
    }

    const loginButton = loginFormElement.querySelector('button[type="submit"]');
    setButtonLoading(loginButton, true, 'Login');

    try {
        // Sign in with email/password
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Reset failed attempts on successful login
        resetFailedLoginAttempts(email);

        // Handle "Remember Me"
        if (rememberMe) {
            localStorage.setItem('rememberedUsername', email);
            localStorage.setItem('rememberMe', true);
        } else {
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberMe');
        }

        // Save user data to localStorage
        localStorage.setItem('username', email);
        localStorage.setItem('userId', user.uid);
        
        console.log('Login successful, user data saved to localStorage');

    } catch (error) {
        console.error('Login error:', error);
        
        // Record failed attempt
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            recordFailedLoginAttempt(email);
        }
        
        handleAuthError(error);
    } finally {
        setButtonLoading(loginButton, false, 'Login');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    console.log('Registration started...');
    
    // Get form values
    const email = document.getElementById('registerEmail').value.trim().toLowerCase();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
    
    // Clear previous errors
    clearFormErrors();
    const passwordMatchError = document.getElementById('passwordMatchError');
    if (passwordMatchError) passwordMatchError.style.display = 'none';

    // Validate inputs
    if (!email || !password || !confirmPassword) {
        console.error('Validation failed: Missing required fields');
        showError('Please fill in all fields.');
        return;
    }

    // Validate password strength
    const passwordStrength = checkPasswordStrength(password);
    if (!passwordStrength.isStrong) {
        showError(`Password does not meet security requirements: ${passwordStrength.feedback.join(', ')}`);
        return;
    }

    // Validate password match
    if (password !== confirmPassword) {
        console.error('Validation failed: Passwords do not match');
        if (passwordMatchError) {
            passwordMatchError.textContent = 'Passwords do not match';
            passwordMatchError.style.display = 'block';
        }
        showError('Passwords do not match.');
        return;
    }

    const registerButton = registerFormElement.querySelector('button[type="submit"]');
    setButtonLoading(registerButton, true, 'Register');

    try {
        console.log('Creating Firebase user...');
        
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        console.log('Firebase user created successfully:', user.uid);

        // Set a flag to notify app.js that this is a fresh registration, to force profile setup.
        localStorage.setItem('freshRegistration', 'true');
        
        // Save user data to localStorage
        localStorage.setItem('username', email);
        localStorage.setItem('userId', user.uid);

        console.log('Registration completed successfully');
        showSuccess('Registration successful! Redirecting to profile setup...');
        
        // The onAuthStateChanged will handle redirect

    } catch (error) {
        console.error('Registration error:', error);
        
        // More detailed error handling
        if (error.code === 'auth/email-already-in-use') {
            showError('This email is already registered. Please use a different email or login.');
        } else if (error.code === 'auth/weak-password') {
            showError('Password is too weak. Please use a stronger password.');
        } else if (error.code === 'auth/invalid-email') {
            showError('Invalid email address format.');
        } else {
            showError('Registration failed: ' + error.message);
        }
        
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
                return;
            }

            if (password !== confirmPassword) {
                passwordMatchError.textContent = 'Passwords do not match';
                passwordMatchError.style.display = 'block';
                confirmPasswordInput.style.borderColor = '#dc3545';
            } else {
                passwordMatchError.style.display = 'none';
                confirmPasswordInput.style.borderColor = '#28a745';
            }
        };

        passwordInput.addEventListener('input', validatePasswords);
        confirmPasswordInput.addEventListener('input', validatePasswords);
    }
}

function setupPasswordStrengthChecker() {
    const passwordInput = document.getElementById('registerPassword');
    const strengthIndicator = document.getElementById('passwordStrengthIndicator');
    
    if (!passwordInput || !strengthIndicator) return;
    
    passwordInput.addEventListener('input', function() {
        const password = this.value;
        const strength = checkPasswordStrength(password);
        
        // Update strength indicator
        strengthIndicator.innerHTML = '';
        
        if (password.length === 0) {
            strengthIndicator.style.display = 'none';
            return;
        }
        
        strengthIndicator.style.display = 'block';
        
        // Create strength bar
        const strengthBar = document.createElement('div');
        strengthBar.className = 'strength-bar';
        
        const strengthLevel = document.createElement('div');
        strengthLevel.className = `strength-level ${strength.score < 2 ? 'weak' : strength.score < 4 ? 'medium' : 'strong'}`;
        strengthLevel.style.width = `${(strength.score / 4) * 100}%`;
        
        strengthBar.appendChild(strengthLevel);
        strengthIndicator.appendChild(strengthBar);
        
        // Create feedback list
        const feedbackList = document.createElement('ul');
        feedbackList.className = 'strength-feedback';
        
        strength.feedback.forEach(item => {
            const listItem = document.createElement('li');
            listItem.textContent = item;
            listItem.className = strength.requirements[item] ? 'met' : 'unmet';
            feedbackList.appendChild(listItem);
        });
        
        strengthIndicator.appendChild(feedbackList);
    });
}

function checkPasswordStrength(password) {
    const requirements = {
        length: password.length >= PASSWORD_REQUIREMENTS.minLength,
        uppercase: PASSWORD_REQUIREMENTS.requireUppercase ? /[A-Z]/.test(password) : true,
        lowercase: PASSWORD_REQUIREMENTS.requireLowercase ? /[a-z]/.test(password) : true,
        numbers: PASSWORD_REQUIREMENTS.requireNumbers ? /[0-9]/.test(password) : true,
        specialChars: PASSWORD_REQUIREMENTS.requireSpecialChars ? /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) : true
    };
    
    let score = 0;
    const feedback = [];
    
    // Calculate score
    if (requirements.length) score++;
    if (requirements.uppercase) score++;
    if (requirements.lowercase) score++;
    if (requirements.numbers) score++;
    if (requirements.specialChars) score++;
    
    // Generate feedback
    if (!requirements.length) {
        feedback.push(`At least ${PASSWORD_REQUIREMENTS.minLength} characters`);
    }
    if (!requirements.uppercase) {
        feedback.push('At least one uppercase letter');
    }
    if (!requirements.lowercase) {
        feedback.push('At least one lowercase letter');
    }
    if (!requirements.numbers) {
        feedback.push('At least one number');
    }
    if (!requirements.specialChars) {
        feedback.push('At least one special character');
    }
    
    return {
        isStrong: score >= 4, // Require at least 4 out of 5 requirements
        score: score,
        requirements: requirements,
        feedback: feedback
    };
}

async function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('forgotUsername').value.trim().toLowerCase();

    if (!email) {
        showError('Please enter your email address');
        return;
    }

    const resetButton = forgotPasswordFormElement.querySelector('button[type="submit"]');
    setButtonLoading(resetButton, true, 'Reset Password');

    try {
        await auth.sendPasswordResetEmail(email);
        showSuccessMessage('Password reset email sent! Check your inbox.');
    } catch (error) {
        console.error('Password reset error:', error);
        handleAuthError(error);
    } finally {
        setButtonLoading(resetButton, false, 'Reset Password');
    }
}

// UI Management Functions
function showLogin() {
    hideAllForms();
    if (loginForm) loginForm.classList.add('active');
    clearFormErrors();
}

function showRegister() {
    hideAllForms();
    if (registerForm) registerForm.classList.add('active');
    clearFormErrors();
}

function showForgotPassword() {
    hideAllForms();
    if (forgotPasswordForm) forgotPasswordForm.classList.add('active');
    clearFormErrors();
}

function hideAllForms() {
    if (loginForm) loginForm.classList.remove('active');
    if (registerForm) registerForm.classList.remove('active');
    if (forgotPasswordForm) forgotPasswordForm.classList.remove('active');
    if (successMessage) successMessage.classList.add('hidden');
}

function showSuccessMessage(message) {
    hideAllForms();
    const successText = document.getElementById('successText');
    if (successText) successText.textContent = message;
    if (successMessage) successMessage.classList.remove('hidden');
}

// Utility Functions
function togglePassword(inputId) {
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput) return;

    const toggleButton = passwordInput.parentElement.querySelector('.toggle-password');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (toggleButton) toggleButton.textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        if (toggleButton) toggleButton.textContent = '👁️';
    }
}

function setButtonLoading(button, isLoading, originalText) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        button.innerHTML = 'Processing...';
        button.dataset.originalText = originalText;
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.innerHTML = button.dataset.originalText || originalText;
        delete button.dataset.originalText;
    }
}

function showError(message) {
    // Create a temporary error display
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background: #f8d7da;
        color: #721c24;
        padding: 10px;
        border-radius: 5px;
        margin: 10px 0;
        text-align: center;
        border: 1px solid #f5c6cb;
    `;
    errorDiv.textContent = message;
    
    // Remove any existing error messages
    const existingErrors = document.querySelectorAll('.error-message');
    existingErrors.forEach(error => error.remove());
    
    // Insert the error message at the top of the active form
    const activeForm = document.querySelector('.form-container.active');
    if (activeForm) {
        activeForm.insertBefore(errorDiv, activeForm.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    } else {
        console.error('Authentication Error:', message);
    }
}

function showSecurityWarning(message) {
    // Create a security warning display
    const warningDiv = document.createElement('div');
    warningDiv.className = 'security-warning';
    warningDiv.style.cssText = `
        background: #fff3cd;
        color: #856404;
        padding: 12px;
        border-radius: 5px;
        margin: 10px 0;
        text-align: center;
        border: 1px solid #ffeaa7;
        font-weight: bold;
    `;
    warningDiv.textContent = message;
    
    // Remove any existing security warnings
    const existingWarnings = document.querySelectorAll('.security-warning');
    existingWarnings.forEach(warning => warning.remove());
    
    // Insert the warning at the top of the active form
    const activeForm = document.querySelector('.form-container.active');
    if (activeForm) {
        activeForm.insertBefore(warningDiv, activeForm.firstChild);
        
        // Auto-remove after 8 seconds (longer for security messages)
        setTimeout(() => {
            if (warningDiv.parentNode) {
                warningDiv.remove();
            }
        }, 8000);
    } else {
        console.warn('Security Warning:', message);
    }
}

function clearFormErrors() {
    const errors = document.querySelectorAll('.error');
    errors.forEach(error => error.classList.remove('error'));
    
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(error => error.remove());
    
    const securityWarnings = document.querySelectorAll('.security-warning');
    securityWarnings.forEach(warning => warning.remove());
    
    // Clear password match error specifically
    const passwordMatchError = document.getElementById('passwordMatchError');
    if (passwordMatchError) {
        passwordMatchError.style.display = 'none';
    }
    
    // Reset border colors
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.style.borderColor = '';
    }
    
    // Hide password strength indicator
    const strengthIndicator = document.getElementById('passwordStrengthIndicator');
    if (strengthIndicator) {
        strengthIndicator.style.display = 'none';
    }
}

function handleAuthError(error) {
    let errorMessage = 'An error occurred. Please try again.';
    
    switch (error.code) {
        case 'auth/invalid-email':
            errorMessage = 'Invalid email address format.';
            break;
        case 'auth/user-disabled':
            errorMessage = 'This account has been disabled.';
            break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            // We handle these cases separately with security warnings
            return;
        case 'auth/email-already-in-use':
            errorMessage = 'An account with this email already exists.';
            break;
        case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please use a stronger password.';
            break;
        case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many unsuccessful attempts. Please try again later.';
            break;
    }
    
    showError(errorMessage);
}

function showSuccess(message) {
    // Create a temporary success display
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style.cssText = `
        background: #d4edda;
        color: #155724;
        padding: 10px;
        border-radius: 5px;
        margin: 10px 0;
        text-align: center;
        border: 1px solid #c3e6cb;
    `;
    successDiv.textContent = message;
    
    // Remove any existing success messages
    const existingSuccess = document.querySelectorAll('.success-message');
    existingSuccess.forEach(msg => msg.remove());
    
    // Insert the success message at the top of the active form
    const activeForm = document.querySelector('.form-container.active');
    if (activeForm) {
        activeForm.insertBefore(successDiv, activeForm.firstChild);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
    } else {
        console.log('Success:', message);
    }
}

// Export functions for global access
window.showLogin = showLogin;
window.showRegister = showRegister;
window.showForgotPassword = showForgotPassword;
window.togglePassword = togglePassword;
