// auth.js - FIXED VERSION WITH SHAKE ANIMATION AND GOOGLE SIGN-IN

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
    setupEmailValidation();
    setupRealTimeValidation();
}

function setupEmailValidation() {
    // Email validation for all forms
    const emailInputs = [
        document.getElementById('loginUsername'),
        document.getElementById('registerEmail'),
        document.getElementById('forgotUsername')
    ];

    emailInputs.forEach(input => {
        if (input) {
            input.addEventListener('blur', validateEmail);
            input.addEventListener('input', clearFieldError);
        }
    });

    // Password field clearing
    const passwordInputs = [
        document.getElementById('loginPassword'),
        document.getElementById('registerPassword'),
        document.getElementById('registerConfirmPassword')
    ];

    passwordInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', clearFieldError);
        }
    });
}

function validateEmail(event) {
    const email = event.target.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (email && !emailRegex.test(email)) {
        showFieldError(event.target, 'Please enter a valid email address');
        return false;
    }
    
    clearFieldError(event);
    return true;
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
    
    const email = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;

    // Clear previous errors
    clearFormErrors();

    // Validate inputs
    if (!email || !password) {
        // Trigger shake effect on validation failure
        shakeForm(loginFormElement.closest('.form-container'));
        showError('Please fill in all fields');
        return;
    }

    // Validate email format
    if (!validateEmail({ target: document.getElementById('loginUsername') })) {
        shakeForm(loginFormElement.closest('.form-container'));
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

        // Save user data to localStorage
        localStorage.setItem('username', email);
        localStorage.setItem('userId', user.uid);
        
        console.log('Login successful, user data saved to localStorage');

    } catch (error) {
        console.error('Login error:', error);
        handleAuthError(error);
        shakeForm(loginFormElement.closest('.form-container')); // Trigger shake on auth failure
    } finally {
        setButtonLoading(loginButton, false, 'Login');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    console.log('Registration started...');
    
    // Get form values
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
    
    // Clear previous errors
    clearFormErrors();
    const passwordMatchError = document.getElementById('passwordMatchError');
    if (passwordMatchError) passwordMatchError.style.display = 'none';

    // Validate inputs
    if (!email || !password || !confirmPassword) {
        console.error('Validation failed: Missing required fields');
        shakeForm(registerFormElement.closest('.form-container'));
        showError('Please fill in all fields.');
        return;
    }

    // Validate email format
    if (!validateEmail({ target: document.getElementById('registerEmail') })) {
        shakeForm(registerFormElement.closest('.form-container'));
        return;
    }

    // Validate password match
    if (password !== confirmPassword) {
        console.error('Validation failed: Passwords do not match');
        if (passwordMatchError) {
            passwordMatchError.textContent = 'Passwords do not match';
            passwordMatchError.style.display = 'block';
            document.getElementById('registerConfirmPassword').classList.add('error');
        }
        shakeForm(registerFormElement.closest('.form-container'));
        showError('Passwords do not match.');
        return;
    }

    if (password.length < 6) {
        shakeForm(registerFormElement.closest('.form-container'));
        showError('Password must be at least 6 characters long');
        document.getElementById('registerPassword').classList.add('error');
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
        
        // Redirect after short delay
        setTimeout(() => {
            window.location.href = 'app.html';
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);
        handleAuthError(error);
        shakeForm(registerFormElement.closest('.form-container')); // Trigger shake on auth failure
    } finally {
        setButtonLoading(registerButton, false, 'Register');
    }
}

// --- NEW FUNCTION: Google Sign-In Handler ---
async function handleGoogleSignIn() {
    // Find the active form to determine which button is clicked and where to apply loading state
    const activeForm = document.querySelector('.form-container.active');
    const googleButton = activeForm ? activeForm.querySelector('.btn-google') : null;
    
    if (googleButton) {
        // Set loading state on the Google button
        const buttonTextSpan = googleButton.querySelector('.google-text');
        const originalText = buttonTextSpan ? buttonTextSpan.textContent : 'Sign in with Google';
        setButtonLoading(googleButton, true, originalText);
    }

    try {
        // 1. Create a Google Auth Provider instance
        const provider = new firebase.auth.GoogleAuthProvider();
        // Request a refresh token if the user signs in again
        provider.addScope('profile');
        provider.addScope('email');

        // 2. Sign in with Google Pop-up
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        const email = user.email;

        // Check if this is a new user (optional, but good practice to handle fresh registration)
        const isNewUser = result.additionalUserInfo?.isNewUser;

        if (isNewUser) {
             // Set a flag for profile setup
            localStorage.setItem('freshRegistration', 'true');
        }

        // 3. Save user data to localStorage
        localStorage.setItem('username', email);
        localStorage.setItem('userId', user.uid);

        console.log('Google Sign-In successful. Redirecting...');
        showSuccess('Sign in successful! Redirecting...');

        // Redirect after short delay
        setTimeout(() => {
            window.location.href = 'app.html';
        }, 1000);
        
    } catch (error) {
        console.error('Google Sign-In error:', error);
        handleAuthError(error);
        if (activeForm) {
            shakeForm(activeForm); // Trigger shake on failure
        }
    } finally {
        if (googleButton) {
            // Restore button text.
            const buttonTextSpan = googleButton.querySelector('.google-text');
            if (buttonTextSpan) {
                // Check if the current form is Register or Login to set the correct text back
                const isRegister = activeForm && activeForm.id === 'registerForm';
                const originalText = isRegister ? 'Sign up with Google' : 'Sign in with Google';
                setButtonLoading(googleButton, false, originalText);
                buttonTextSpan.textContent = originalText;
            }
        }
    }
}
// --- END NEW FUNCTION ---


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
                confirmPasswordInput.classList.remove('error', 'password-match-success');
                return;
            }

            if (password !== confirmPassword) {
                passwordMatchError.textContent = 'Passwords do not match';
                passwordMatchError.style.display = 'block';
                confirmPasswordInput.classList.add('error');
                confirmPasswordInput.classList.remove('password-match-success');
            } else {
                passwordMatchError.style.display = 'none';
                confirmPasswordInput.classList.remove('error');
                confirmPasswordInput.classList.add('password-match-success');
            }
        };

        passwordInput.addEventListener('input', validatePasswords);
        confirmPasswordInput.addEventListener('input', validatePasswords);
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('forgotUsername').value.trim();

    // Clear previous errors
    clearFormErrors();

    if (!email) {
        shakeForm(forgotPasswordFormElement.closest('.form-container'));
        showError('Please enter your email address');
        return;
    }

    // Validate email format
    if (!validateEmail({ target: document.getElementById('forgotUsername') })) {
        shakeForm(forgotPasswordFormElement.closest('.form-container'));
        return;
    }

    const resetButton = forgotPasswordFormElement.querySelector('button[type="submit"]');
    setButtonLoading(resetButton, true, 'Reset Password');

    try {
        // Use your Netlify domain for the reset page
        const actionCodeSettings = {
            url: 'https://your-app-name.netlify.app/reset-password.html',
            handleCodeInApp: true
        };
        
        await auth.sendPasswordResetEmail(email, actionCodeSettings);
        
        showSuccessMessage('Password reset email sent! Check your inbox for instructions.');
        document.getElementById('forgotUsername').value = '';
        
    } catch (error) {
        console.error('Password reset error:', error);
        handleAuthError(error);
        shakeForm(forgotPasswordFormElement.closest('.form-container')); // Trigger shake on failure
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
    
    // Update success text
    const successText = document.getElementById('successText');
    if (successText) {
        successText.textContent = message;
    }
    
    // Show success section
    if (successMessage) {
        successMessage.classList.remove('hidden');
        
        // Update the button text and behavior
        const successButton = successMessage.querySelector('.btn-primary');
        if (successButton) {
            successButton.textContent = 'Back to Login';
            successButton.onclick = showLogin;
        }
    }
    
    // Optional: Auto-redirect after 5 seconds
    setTimeout(() => {
        showLogin();
    }, 5000);
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
    
    // Handle the Google button's span text
    const buttonTextSpan = button.querySelector('.google-text');

    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        
        // Store original text for restoration
        if (button.tagName === 'BUTTON' && button.classList.contains('btn-primary')) {
            button.innerHTML = 'Processing...';
            button.dataset.originalText = originalText;
        } else if (buttonTextSpan) {
            button.dataset.originalText = buttonTextSpan.textContent;
            buttonTextSpan.textContent = 'Processing...';
        }

    } else {
        button.disabled = false;
        button.classList.remove('loading');
        
        if (button.tagName === 'BUTTON' && button.classList.contains('btn-primary')) {
            button.innerHTML = button.dataset.originalText || originalText;
            delete button.dataset.originalText;
        } else if (buttonTextSpan) {
             // Restore Google button text manually from dataset
            buttonTextSpan.textContent = button.dataset.originalText || originalText;
            delete button.dataset.originalText;
        }
    }
}

// --- MODIFIED: Triggers shake animation on the container ---
function shakeForm(containerElement) {
    if (!containerElement) return;
    // Add the shake class to the entire auth-container element
    const authContainer = document.querySelector('.auth-container');
    if (!authContainer) return;

    authContainer.classList.add('shake-animation');
    
    // Remove the class after the animation finishes (0.5s duration in CSS)
    setTimeout(() => {
        authContainer.classList.remove('shake-animation');
    }, 500);
}

function showError(message) {
    // Get the auth-container to insert the error message
    const authContainer = document.querySelector('.auth-container');
    if (!authContainer) return;

    // Create a temporary error display
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background: #f8d7da;
        color: #721c24;
        padding: 12px;
        border-radius: 8px;
        margin: 15px 30px; /* Use padding from .form-container */
        text-align: center;
        border: 1px solid #f5c6cb;
        font-size: 14px;
        font-weight: bold;
        position: absolute;
        top: 100px;
        left: 0;
        right: 0;
        z-index: 10;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    `;
    errorDiv.textContent = message;
    
    // Remove any existing temporary error messages
    const existingErrors = document.querySelectorAll('.error-message.temporary-error');
    existingErrors.forEach(error => error.remove());
    
    errorDiv.classList.add('temporary-error');
    
    // Insert the error message inside the main auth container
    authContainer.insertBefore(errorDiv, authContainer.querySelector('.form-container.active'));
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

function showFieldError(inputElement, message) {
    // Clear any existing error for this field
    clearFieldError({ target: inputElement });
    
    // Add error class to input
    inputElement.classList.add('error');
    
    // Create error message element
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.style.cssText = `
        color: #dc3545;
        font-size: 12px;
        margin-top: 5px;
        display: block;
    `;
    errorElement.textContent = message;
    
    // Insert after the input's immediate parent (which is often .form-group or .password-container)
    const container = inputElement.closest('.form-group') || inputElement.parentNode;
    container.appendChild(errorElement);
}

function clearFieldError(event) {
    const input = event.target;
    input.classList.remove('error');
    
    // Remove any error messages for this field by looking at the parent container
    const container = input.closest('.form-group') || input.parentNode;
    const errorMessages = container.querySelectorAll('.error-message');
    errorMessages.forEach(error => {
        // Only remove error messages that are NOT the passwordMatchError static element
        if (error.id !== 'passwordMatchError') {
             error.remove();
        }
    });
}

function clearFormErrors() {
    // Clear all input error classes
    const errorInputs = document.querySelectorAll('.error');
    errorInputs.forEach(input => input.classList.remove('error'));
    
    // Clear all temporary error messages (the one inserted by showError)
    const tempErrors = document.querySelectorAll('.temporary-error');
    tempErrors.forEach(error => error.remove());

    // Clear all field-specific dynamic error messages
    const fieldErrors = document.querySelectorAll('.form-group .error-message');
    fieldErrors.forEach(error => {
        if (error.id !== 'passwordMatchError') {
            error.remove();
        }
    });
    
    // Clear password match error specifically
    const passwordMatchError = document.getElementById('passwordMatchError');
    if (passwordMatchError) {
        passwordMatchError.style.display = 'none';
    }
    
    // Reset border colors for confirm password
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.classList.remove('error', 'password-match-success');
    }
}

function handleAuthError(error) {
    let errorMessage = 'An error occurred. Please try again.';
    let suggestion = '';
    
    switch (error.code) {
        case 'auth/invalid-email':
            errorMessage = 'Invalid email address format.';
            break;
        case 'auth/user-disabled':
            errorMessage = 'This account has been disabled.';
            break;
        case 'auth/user-not-found':
            errorMessage = 'No account found with this email address.';
            suggestion = 'Please check your email or create a new account.';
            break;
        case 'auth/wrong-password':
            errorMessage = 'Incorrect password.';
            suggestion = 'Please check your password and try again.';
            break;
        case 'auth/email-already-in-use':
            errorMessage = 'An account with this email already exists.';
            suggestion = 'Please login or use a different email address.';
            break;
        case 'auth/weak-password':
            errorMessage = 'Password is too weak.';
            suggestion = 'Please use at least 6 characters.';
            break;
        case 'auth/network-request-failed':
            errorMessage = 'Network error.';
            suggestion = 'Please check your internet connection.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many unsuccessful attempts.';
            suggestion = 'Please try again later.';
            break;
        case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled.';
            suggestion = 'Please contact support.';
            break;
        case 'auth/popup-blocked':
            errorMessage = 'Popup blocked by browser.';
            suggestion = 'Please allow popups for this site and try again.';
            break;
        case 'auth/popup-closed-by-user':
            errorMessage = 'Sign-in window closed.';
            suggestion = 'Please try signing in again.';
            break;
        default:
            errorMessage = error.message || 'An unexpected error occurred.';
    }
    
    // Show the main error
    showError(errorMessage);
    
    // If there's a suggestion, show it after a delay
    if (suggestion) {
        setTimeout(() => {
            // Check if we're still on the same form
            const activeForm = document.querySelector('.form-container.active');
            if (activeForm && !document.querySelector('.suggestion-message')) {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.className = 'suggestion-message';
                suggestionDiv.style.cssText = `
                    background: #d1ecf1;
                    color: #0c5460;
                    padding: 10px;
                    border-radius: 5px;
                    margin: 10px 0;
                    text-align: center;
                    border: 1px solid #bee5eb;
                    font-size: 13px;
                `;
                suggestionDiv.textContent = suggestion;
                activeForm.insertBefore(suggestionDiv, activeForm.querySelector('.form-links'));
                
                // Auto-remove after 8 seconds
                setTimeout(() => {
                    if (suggestionDiv.parentNode) {
                        suggestionDiv.remove();
                    }
                }, 8000);
            }
        }, 500);
    }
}

function setupRealTimeValidation() {
    const emailInputs = [
        document.getElementById('loginUsername'),
        document.getElementById('registerEmail'),
        document.getElementById('forgotUsername')
    ];

    emailInputs.forEach(input => {
        if (input) {
            input.addEventListener('blur', function() {
                if (this.value.trim()) {
                    validateEmail({ target: this });
                }
            });
            
            input.addEventListener('input', function() {
                // Remove error state when user starts typing
                if (this.classList.contains('error')) {
                    clearFieldError({ target: this });
                }
            });
        }
    });
}

function showSuccess(message) {
    // Get the auth-container to insert the success message
    const authContainer = document.querySelector('.auth-container');
    if (!authContainer) return;

    // Create a temporary success display
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style.cssText = `
        background: #d4edda;
        color: #155724;
        padding: 12px;
        border-radius: 8px;
        margin: 15px 30px; /* Use padding from .form-container */
        text-align: center;
        border: 1px solid #c3e6cb;
        font-size: 14px;
        font-weight: bold;
        position: absolute;
        top: 100px;
        left: 0;
        right: 0;
        z-index: 10;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    `;
    successDiv.textContent = message;
    
    // Remove any existing success messages
    const existingSuccess = document.querySelectorAll('.success-message.temporary-success');
    existingSuccess.forEach(msg => msg.remove());
    
    successDiv.classList.add('temporary-success');
    
    // Insert the success message inside the main auth container
    authContainer.insertBefore(successDiv, authContainer.querySelector('.form-container.active'));
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 3000);
}

// Export functions for global access
window.showLogin = showLogin;
window.showRegister = showRegister;
window.showForgotPassword = showForgotPassword;
window.togglePassword = togglePassword;
window.handleGoogleSignIn = handleGoogleSignIn; // Export new handler
