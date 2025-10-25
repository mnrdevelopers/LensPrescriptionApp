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

// Initialize the authentication system
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
    loadRememberedUser();
});

function initializeAuth() {
    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in, redirect to dashboard
            window.location.href = 'dashboard.html';
        }
    });

    // Add form event listeners
    loginFormElement.addEventListener('submit', handleLogin);
    registerFormElement.addEventListener('submit', handleRegister);
    forgotPasswordFormElement.addEventListener('submit', handleForgotPassword);
}

function loadRememberedUser() {
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    const rememberMe = localStorage.getItem('rememberMe');

    if (rememberMe === 'true' && rememberedUsername) {
        document.getElementById('loginUsername').value = rememberedUsername;
        document.getElementById('rememberMe').checked = true;
    }
}

// Form Handlers
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;

    // Validate inputs
    if (!username || !password) {
        showError('Please fill in all fields');
        return;
    }

    const loginButton = loginFormElement.querySelector('button[type="submit"]');
    setButtonLoading(loginButton, true);

    try {
        // Sign in with email/password (using username as email)
        const userCredential = await auth.signInWithEmailAndPassword(username, password);
        const user = userCredential.user;

        // Handle "Remember Me"
        if (rememberMe) {
            localStorage.setItem('rememberedUsername', username);
            localStorage.setItem('rememberMe', true);
        } else {
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberMe');
        }

        // Save user data
        localStorage.setItem('username', username);
        localStorage.setItem('userId', user.uid);

        // Redirect to dashboard
        window.location.href = 'dashboard.html';

    } catch (error) {
        console.error('Login error:', error);
        handleAuthError(error);
    } finally {
        setButtonLoading(loginButton, false);
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const clinicName = document.getElementById('clinicName').value.trim();
    const optometristName = document.getElementById('optometristName').value.trim();
    const address = document.getElementById('address').value.trim();
    const contactNumber = document.getElementById('contactNumber').value.trim();

    // Validate inputs
    if (!username || !password || !clinicName || !optometristName || !address || !contactNumber) {
        showError('Please fill in all fields');
        return;
    }

    if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }

    const registerButton = registerFormElement.querySelector('button[type="submit"]');
    setButtonLoading(registerButton, true);

    try {
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(username, password);
        const user = userCredential.user;

        // Save user details to Firestore
        await db.collection('users').doc(user.uid).set({
            username: username,
            clinicName: clinicName,
            optometristName: optometristName,
            address: address,
            contactNumber: contactNumber,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Save user data to localStorage
        localStorage.setItem('username', username);
        localStorage.setItem('userId', user.uid);

        showSuccess('Registration successful! Redirecting...');
        
        // Redirect after short delay
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);
        handleAuthError(error);
    } finally {
        setButtonLoading(registerButton, false);
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    
    const username = document.getElementById('forgotUsername').value.trim();

    if (!username) {
        showError('Please enter your username');
        return;
    }

    const resetButton = forgotPasswordFormElement.querySelector('button[type="submit"]');
    setButtonLoading(resetButton, true);

    try {
        await auth.sendPasswordResetEmail(username);
        showSuccessMessage('Password reset email sent! Check your inbox.');
    } catch (error) {
        console.error('Password reset error:', error);
        handleAuthError(error);
    } finally {
        setButtonLoading(resetButton, false);
    }
}

// UI Management Functions
function showLogin() {
    hideAllForms();
    loginForm.classList.add('active');
    clearFormErrors();
}

function showRegister() {
    hideAllForms();
    registerForm.classList.add('active');
    clearFormErrors();
}

function showForgotPassword() {
    hideAllForms();
    forgotPasswordForm.classList.add('active');
    clearFormErrors();
}

function hideAllForms() {
    loginForm.classList.remove('active');
    registerForm.classList.remove('active');
    forgotPasswordForm.classList.remove('active');
    successMessage.classList.add('hidden');
}

function showSuccessMessage(message) {
    hideAllForms();
    document.getElementById('successText').textContent = message;
    successMessage.classList.remove('hidden');
}

// Utility Functions
function togglePassword(inputId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = passwordInput.parentElement.querySelector('.toggle-password');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        toggleButton.textContent = '👁️';
    }
}

function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        button.innerHTML = 'Processing...';
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.innerHTML = button === loginFormElement.querySelector('button') ? 'Login' : 
                          button === registerFormElement.querySelector('button') ? 'Register' : 'Reset Password';
    }
}

function showError(message) {
    // Simple error display - you can enhance this with better UI
    alert('Error: ' + message);
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
            errorMessage = 'No account found with this username.';
            break;
        case 'auth/wrong-password':
            errorMessage = 'Incorrect password.';
            break;
        case 'auth/email-already-in-use':
            errorMessage = 'An account with this username already exists.';
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
    
    showError(errorMessage);
}

function showSuccess(message) {
    // Simple success display - you can enhance this with better UI
    alert('Success: ' + message);
}

// Export functions for global access
window.showLogin = showLogin;
window.showRegister = showRegister;
window.showForgotPassword = showForgotPassword;
window.togglePassword = togglePassword;
