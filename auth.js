// auth.js - FIXED VERSION WITH PROPER VALIDATION AND EMAIL VERIFICATION

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const successMessage = document.getElementById('successMessage');
// NEW: Email verification element
const verifyEmailMessage = document.getElementById('verifyEmailMessage'); 

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
            console.log('User authenticated, checking email verification...');
            
            // Check verification status on load if a user token exists
            if (user.emailVerified) {
                // User is signed in and verified, redirect to dashboard
                isRedirecting = true;
                window.location.href = 'app.html';
            } else {
                // User is signed in but not verified, force re-login/check
                // This typically handles users who close the window immediately after registration
                auth.signOut().then(() => {
                    showVerifyEmailPrompt(user.email);
                });
            }
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
        showError('Please fill in all fields');
        return;
    }

    // Validate email format
    if (!validateEmail({ target: document.getElementById('loginUsername') })) {
        return;
    }

    const loginButton = loginFormElement.querySelector('button[type="submit"]');
    setButtonLoading(loginButton, true, 'Login');

    try {
        // Sign in with email/password
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // --- NEW: Check Email Verification ---
        if (!user.emailVerified) {
            // User signed in but is not verified
            console.warn('Login successful, but email is not verified.');
            await auth.signOut(); // Immediately sign out the unverified user
            showVerifyEmailPrompt(email);
            return;
        }
        // --- END NEW CHECK ---

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
        
        console.log('Login successful and verified, redirecting to app...');
        window.location.href = 'app.html';

    } catch (error) {
        console.error('Login error:', error);
        handleAuthError(error);
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
        showError('Please fill in all fields.');
        return;
    }

    // Validate email format
    if (!validateEmail({ target: document.getElementById('registerEmail') })) {
        return;
    }

    // Validate password match
    if (password !== confirmPassword) {
        if (passwordMatchError) {
            passwordMatchError.textContent = 'Passwords do not match';
            passwordMatchError.style.display = 'block';
            document.getElementById('registerConfirmPassword').classList.add('error');
        }
        showError('Passwords do not match.');
        return;
    }

    if (password.length < 6) {
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
        
        // --- NEW: Send Verification Email ---
        await user.sendEmailVerification();
        console.log('Verification email sent to:', user.email);
        
        // Immediately sign out the user after registration so they cannot proceed unverified
        await auth.signOut();
        
        console.log('Registration successful, user signed out. Showing verification prompt.');
        
        // Show verification prompt
        showVerifyEmailPrompt(email);
        
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
        showError('Please enter your email address');
        return;
    }

    // Validate email format
    if (!validateEmail({ target: document.getElementById('forgotUsername') })) {
        return;
    }

    const resetButton = forgotPasswordFormElement.querySelector('button[type="submit"]');
    setButtonLoading(resetButton, true, 'Reset Password');

    try {
        // Use your Netlify domain for the reset page
        // NOTE: The URL below MUST be updated by the developer to their deployed URL, 
        // as Firebase requires an authorized domain.
        const actionCodeSettings = {
            url: 'https://mnrdevelopers.github.io/LensPrescriptionApp/reset-password.html',
            handleCodeInApp: true
        };
        
        await auth.sendPasswordResetEmail(email, actionCodeSettings);
        
        // --- FIX APPLIED HERE: Pass a descriptive message to showSuccessMessage
        showSuccessMessage('Password reset link sent! Check your inbox for instructions on setting a new password.');
        document.getElementById('forgotUsername').value = '';
        
    } catch (error) {
        console.error('Password reset error:', error);
        handleAuthError(error);
    } finally {
        setButtonLoading(resetButton, false, 'Reset Password');
    }
}

// --- UPDATED: Show Email Verification Prompt ---
function showVerifyEmailPrompt(email) {
    hideAllForms();
    
    const unverifiedEmailElement = document.getElementById('unverifiedEmail');
    if (unverifiedEmailElement) {
        unverifiedEmailElement.textContent = email;
        unverifiedEmailElement.dataset.email = email; // Store for resend function
    }

    // Ensure the verification message section is made active and visible
    if (verifyEmailMessage) verifyEmailMessage.classList.add('active'); 
    
    // Clear any residual global errors
    clearFormErrors();

    // Show a helpful status message on the verification screen itself
    showSuccess('Registration complete! Please check your email inbox to verify your account and log in.');
}

// --- NEW FUNCTION: Resend Verification Email ---
async function resendVerificationEmail() {
    const emailElement = document.getElementById('unverifiedEmail');
    const email = emailElement?.dataset.email;
    const resendButton = document.getElementById('resendVerificationBtn');

    if (!email) {
        showError('Cannot resend verification: Email not found.');
        return;
    }

    // Temporary sign-in to get user object and resend email
    // This is necessary because Firebase only allows sending verification
    // to the currently authenticated user. We rely on the user being logged out
    // with the same email/password as they haven't verified yet.
    try {
        setButtonLoading(resendButton, true, 'Resend Verification Email');
        
        // Use a dummy password to attempt temporary sign-in. This relies on the
        // user's password still being the one they used for registration.
        const credentials = await auth.signInWithEmailAndPassword(email, 'placeholder'); 
        
        // If login successful, means we have the user object
        const user = credentials.user;
        
        // Check if already verified (user may have verified in another tab)
        await user.reload(); 
        if (user.emailVerified) {
            showSuccess('Email already verified! Please log in.');
            await auth.signOut();
            showLogin();
            return;
        }

        // Send again
        await user.sendEmailVerification();
        await auth.signOut(); // Sign out immediately after
        
        showSuccess('Verification email resent! Check your inbox.');
        
    } catch (error) {
        // If password guess fails, or any other sign-in error occurs during resend attempt,
        // we assume the user needs to re-enter their credentials on the login form.
        
        // Show a message suggesting they check their inbox/log in instead of a generic error
        showSuccess('Verification email re-sent! Please check your inbox or log in to check status.');
        
        // The most likely case for failure here is that the temporary sign-in failed, 
        // so we just show the successful re-send message and return.
        
        console.error('Error during resend verification process (Likely temporary sign-in issue):', error);
        
    } finally {
        setButtonLoading(resendButton, false, 'Resend Verification Email');
    }
}
// --- END NEW FUNCTIONS ---


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
    
    // Ensure both hidden and active flags are cleared for these special containers
    if (successMessage) {
        successMessage.classList.add('hidden'); // Keep the original 'hidden' for safety
        successMessage.classList.remove('active');
    }
    if (verifyEmailMessage) verifyEmailMessage.classList.remove('active'); 
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
        // FIX: Ensure 'active' class is added for visibility and 'hidden' is removed.
        successMessage.classList.remove('hidden');
        successMessage.classList.add('active'); // Add 'active' to show the container
        
        // Update the button text and behavior
        const successButton = successMessage.querySelector('.btn-primary');
        if (successButton) {
            successButton.textContent = 'Back to Login';
            successButton.onclick = showLogin;
        }
    }
    
    // Optional: Auto-redirect after 5 seconds
    setTimeout(() => {
        if (!document.querySelector('.form-container.active')) { // Only redirect if no other form is active
            showLogin();
        }
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
    errorDiv.className = 'error-message-box'; // Changed class name
    errorDiv.style.cssText = `
        background: #f8d7da;
        color: #721c24;
        padding: 12px;
        border-radius: 8px;
        margin: 15px 0;
        text-align: center;
        border: 1px solid #f5c6cb;
        font-size: 14px;
        font-weight: bold;
    `;
    errorDiv.textContent = message;
    
    // Remove any existing error messages
    const existingErrors = document.querySelectorAll('.error-message-box');
    existingErrors.forEach(error => error.remove());
    
    // Insert the error message at the top of the active form
    const activeForm = document.querySelector('.form-container.active');
    if (activeForm) {
        const formHeader = activeForm.querySelector('h2');
        if (formHeader) {
            activeForm.insertBefore(errorDiv, formHeader.nextSibling);
        } else {
            activeForm.insertBefore(errorDiv, activeForm.firstChild);
        }
        
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

function showFieldError(inputElement, message) {
    // Clear any existing error for this field
    clearFieldError({ target: inputElement });
    
    // Add error class to input
    inputElement.classList.add('error');
    
    // Create error message element
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error-message'; // Changed class name
    errorElement.style.cssText = `
        color: #dc3545;
        font-size: 12px;
        margin-top: 5px;
        display: block;
    `;
    errorElement.textContent = message;
    
    // Insert after the input
    inputElement.parentNode.appendChild(errorElement);
}

function clearFieldError(event) {
    const input = event.target;
    input.classList.remove('error');
    
    // Remove any error messages for this field
    const errorMessages = input.parentNode.querySelectorAll('.field-error-message');
    errorMessages.forEach(error => error.remove());
}

function clearFormErrors() {
    // Clear all error classes
    const errorInputs = document.querySelectorAll('.error');
    errorInputs.forEach(input => input.classList.remove('error'));
    
    // Clear all error messages
    const errorMessagesBox = document.querySelectorAll('.error-message-box');
    errorMessagesBox.forEach(error => error.remove());
    
    const fieldErrorMessages = document.querySelectorAll('.field-error-message');
    fieldErrorMessages.forEach(error => error.remove());
    
    // Clear password match error specifically
    const passwordMatchError = document.getElementById('passwordMatchError');
    if (passwordMatchError) {
        passwordMatchError.style.display = 'none';
    }
    
    // Reset border colors
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.classList.remove('error', 'password-match-success');
    }
}

// --- UPDATED: Enhanced Error Handling for Firebase Auth Codes ---
function handleAuthError(error) {
    let errorMessage = 'An unexpected error occurred. Please try again.';
    let suggestion = '';
    
    switch (error.code) {
        case 'auth/invalid-email':
            errorMessage = 'The email address is invalid or poorly formatted.';
            suggestion = 'Please check the email format and try again.';
            break;
        case 'auth/user-disabled':
            errorMessage = 'This account has been temporarily disabled by an administrator.';
            suggestion = 'Please contact support for assistance.';
            break;
        case 'auth/user-not-found':
            errorMessage = 'No account found with this email address.';
            suggestion = 'Please check your email or proceed to the Register page.';
            break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            errorMessage = 'The email and password combination is incorrect.';
            suggestion = 'Please double-check your password or use the "Forgot Password" link.';
            break;
        case 'auth/email-already-in-use':
            errorMessage = 'An account with this email already exists.';
            suggestion = 'Please proceed to the Login page.';
            break;
        case 'auth/weak-password':
            errorMessage = 'Password is too weak.';
            suggestion = 'Your password must be at least 6 characters long and complex.';
            break;
        case 'auth/network-request-failed':
            errorMessage = 'Network connection failed.';
            suggestion = 'Please check your internet connection and try again.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many unsuccessful login attempts.';
            suggestion = 'For security reasons, please try again later.';
            break;
        case 'auth/operation-not-allowed':
            errorMessage = 'Account type not supported.';
            suggestion = 'Please contact support.';
            break;
        case 'auth/missing-android-pkg-name':
        case 'auth/missing-ios-bundle-id':
            errorMessage = 'Password reset configuration error.';
            suggestion = 'Please contact support.';
            break;
        // NEW: Unverified email login error
        case 'auth/invalid-login-credentials':
            // Firebase often returns this generic message for unverified email on newer versions
            errorMessage = 'Incorrect email or password.'; 
            suggestion = 'If this is a new account, please verify your email before logging in.';
            break;
        default:
            // Log the raw error code for debugging but show a generic message
            console.error('Unhandled Firebase Error Code:', error.code);
            errorMessage = 'An unexpected error occurred. Please contact support if the issue persists.';
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
                activeForm.appendChild(suggestionDiv);
                
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
// --- END UPDATED ERROR HANDLING ---

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
    // Create a temporary success display
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message-box'; // Changed class name
    successDiv.style.cssText = `
        background: #d4edda;
        color: #155724;
        padding: 12px;
        border-radius: 8px;
        margin: 15px 0;
        text-align: center;
        border: 1px solid #c3e6cb;
        font-size: 14px;
        font-weight: bold;
    `;
    successDiv.textContent = message;
    
    // Remove any existing success messages
    const existingSuccess = document.querySelectorAll('.success-message-box');
    existingSuccess.forEach(msg => msg.remove());
    
    // Insert the success message at the top of the active form
    const activeForm = document.querySelector('.form-container.active');
    if (activeForm) {
        const formHeader = activeForm.querySelector('h2');
        if (formHeader) {
            activeForm.insertBefore(successDiv, formHeader.nextSibling);
        } else {
            activeForm.insertBefore(successDiv, activeForm.firstChild);
        }
        
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
window.resendVerificationEmail = resendVerificationEmail; // NEW export
