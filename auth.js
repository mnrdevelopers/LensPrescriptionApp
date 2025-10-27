// auth.js - FIXED VERSION WITH PROPER VALIDATION

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
        showError('Please fill in all fields.');
        return;
    }

    // Validate email format
    if (!validateEmail({ target: document.getElementById('registerEmail') })) {
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
        // Specify the custom reset URL
        const actionCodeSettings = {
            url: window.location.origin + '/reset-password.html',
            handleCodeInApp: true
        };
        
        await auth.sendPasswordResetEmail(email, actionCodeSettings);
        
        // SUCCESS: Show success message and navigate
        showSuccessMessage('Password reset email sent! Check your inbox for instructions.');
        
        // Clear the form
        document.getElementById('forgotUsername').value = '';
        
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
    const existingErrors = document.querySelectorAll('.error-message');
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
    errorElement.className = 'error-message';
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
    const errorMessages = input.parentNode.querySelectorAll('.error-message');
    errorMessages.forEach(error => error.remove());
}

function clearFormErrors() {
    // Clear all error classes
    const errorInputs = document.querySelectorAll('.error');
    errorInputs.forEach(input => input.classList.remove('error'));
    
    // Clear all error messages
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(error => error.remove());
    
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
        // Add specific reset password errors
        case 'auth/missing-android-pkg-name':
        case 'auth/missing-ios-bundle-id':
            errorMessage = 'Reset configuration error.';
            suggestion = 'Please contact support.';
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
    successDiv.className = 'success-message';
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
    const existingSuccess = document.querySelectorAll('.success-message');
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
