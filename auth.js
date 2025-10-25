// auth.js

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

// Initialize the authentication system
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
    loadRememberedUser();
});

function initializeAuth() {
    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user && !isRedirecting) {
            // User is signed in, redirect to dashboard
            isRedirecting = true;
            window.location.href = 'app.html';
        }
    });

    // Add form event listeners
    if (loginFormElement) loginFormElement.addEventListener('submit', handleLogin);
    if (registerFormElement) registerFormElement.addEventListener('submit', handleRegister);
    if (forgotPasswordFormElement) forgotPasswordFormElement.addEventListener('submit', handleForgotPassword);
}

function loadRememberedUser() {
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    const rememberMe = localStorage.getItem('rememberMe');

    if (rememberMe === 'true' && rememberedUsername) {
        // Renamed 'loginUsername' to reflect that it is an Email
        const loginUsernameInput = document.getElementById('loginUsername');
        if (loginUsernameInput) loginUsernameInput.value = rememberedUsername;
        
        const rememberMeCheckbox = document.getElementById('rememberMe');
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }
}

// Form Handlers
async function handleLogin(event) {
    event.preventDefault();
    
    // Note: 'username' is actually the Email Address for Firebase Auth
    const email = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;

    // Validate inputs
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }

    const loginButton = loginFormElement.querySelector('button[type="submit"]');
    setButtonLoading(loginButton, true, 'Login');

    try {
        // Sign in with email/password
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Handle "Remember Me"
        if (rememberMe) {
            localStorage.setItem('rememberedUsername', email);
            localStorage.setItem('rememberMe', true);
        } else {
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberMe');
        }

        // Save user data (This is now redundant as onAuthStateChanged handles redirect, but kept for local storage)
        localStorage.setItem('username', email); // Storing email as "username"
        localStorage.setItem('userId', user.uid);
        
        // Let the onAuthStateChanged handler redirect

    } catch (error) {
        console.error('Login error:', error);
        handleAuthError(error);
    } finally {
        setButtonLoading(loginButton, false, 'Login');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    // Note: 'username' is actually the Email Address for Firebase Auth
    const email = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const clinicName = document.getElementById('clinicName').value.trim();
    const optometristName = document.getElementById('optometristName').value.trim();
    const address = document.getElementById('address').value.trim();
    const contactNumber = document.getElementById('contactNumber').value.trim();

    // Validate inputs
    if (!email || !password || !clinicName || !optometristName || !address || !contactNumber) {
        showError('Please fill in all fields');
        return;
    }

    if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }

    const registerButton = registerFormElement.querySelector('button[type="submit"]');
    setButtonLoading(registerButton, true, 'Register');

    try {
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // FIX: Save user details to Firestore immediately after successful registration
        // This ensures the profile exists when app.js tries to load it.
        await db.collection('users').doc(user.uid).set({
            email: email, // Changed from username to email
            clinicName: clinicName,
            optometristName: optometristName,
            address: address,
            contactNumber: contactNumber,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Save user data to localStorage
        localStorage.setItem('username', email); // Storing email as "username"
        localStorage.setItem('userId', user.uid);

        showSuccess('Registration successful! Redirecting...');
        
        // Let the onAuthStateChanged handler redirect

    } catch (error) {
        console.error('Registration error:', error);
        handleAuthError(error);
    } finally {
        setButtonLoading(registerButton, false, 'Register');
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('forgotUsername').value.trim();

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

/**
 * Sets the loading state of a button.
 * @param {HTMLElement} button - The button element.
 * @param {boolean} isLoading - Whether to set the loading state.
 * @param {string} originalText - The original text of the button.
 */
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
    // Replaced alert() with a console log for better UX and compliance
    console.error('Authentication Error:', message);
}

function clearFormErrors() {
    const errors = document.querySelectorAll('.error');
    errors.forEach(error => error.classList.remove('error'));
    
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(error => error.remove());
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
            errorMessage = 'Invalid email or password.';
            break;
        case 'auth/email-already-in-use':
            errorMessage = 'An account with this email already exists.';
            break;
        case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please use at least 6 characters.';
            break;
        case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many unsuccessful attempts. Please try again later.';
            break;
    }
    
    // Display error message (using console and fallback)
    showError(errorMessage);
    
    // In a production app, you would update an element on the screen here
}

function showSuccess(message) {
    // Replaced alert() with a console log
    console.log('Success:', message);
}

// Export functions for global access
window.showLogin = showLogin;
window.showRegister = showRegister;
window.showForgotPassword = showForgotPassword;
window.togglePassword = togglePassword;
window.showError = showError;
