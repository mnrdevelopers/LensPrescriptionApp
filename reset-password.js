// reset-password.js - Custom Password Reset Handler

document.addEventListener('DOMContentLoaded', function() {
    initializeResetPassword();
});

function initializeResetPassword() {
    // Get the action code from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const actionCode = urlParams.get('oobCode');
    const continueUrl = urlParams.get('continueUrl');
    
    if (!actionCode) {
        showError('Invalid or expired reset link. Please request a new password reset.');
        return;
    }

    // Set up form submission
    const resetForm = document.getElementById('resetPasswordFormElement');
    if (resetForm) {
        resetForm.addEventListener('submit', function(event) {
            event.preventDefault();
            handlePasswordReset(actionCode);
        });
    }

    // Set up password validation
    setupPasswordValidation();
}

function setupPasswordValidation() {
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmNewPassword');
    const passwordMatchError = document.getElementById('passwordMatchError');

    if (newPasswordInput && confirmPasswordInput && passwordMatchError) {
        const validatePasswords = () => {
            const password = newPasswordInput.value;
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

        newPasswordInput.addEventListener('input', validatePasswords);
        confirmPasswordInput.addEventListener('input', validatePasswords);
    }
}

async function handlePasswordReset(actionCode) {
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmNewPassword').value.trim();

    // Clear previous errors
    clearFormErrors();

    // Validate inputs
    if (!newPassword || !confirmPassword) {
        showError('Please fill in all fields');
        return;
    }

    if (newPassword.length < 6) {
        showError('Password must be at least 6 characters long');
        document.getElementById('newPassword').classList.add('error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showError('Passwords do not match');
        document.getElementById('confirmNewPassword').classList.add('error');
        return;
    }

    const resetButton = document.querySelector('#resetPasswordFormElement button[type="submit"]');
    setButtonLoading(resetButton, true, 'Reset Password');

    try {
        // Confirm the password reset code and update password
        await auth.confirmPasswordReset(actionCode, newPassword);
        
        // Show success message
        showSuccessMessage();
        
    } catch (error) {
        console.error('Password reset error:', error);
        handleResetError(error);
    } finally {
        setButtonLoading(resetButton, false, 'Reset Password');
    }
}

function handleResetError(error) {
    let errorMessage = 'An error occurred. Please try again.';
    
    switch (error.code) {
        case 'auth/expired-action-code':
            errorMessage = 'The reset link has expired. Please request a new password reset.';
            break;
        case 'auth/invalid-action-code':
            errorMessage = 'The reset link is invalid. Please request a new password reset.';
            break;
        case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please use a stronger password.';
            break;
        case 'auth/user-disabled':
            errorMessage = 'This account has been disabled.';
            break;
        case 'auth/user-not-found':
            errorMessage = 'No account found with this email.';
            break;
    }
    
    showError(errorMessage);
}

function showSuccessMessage() {
    const resetForm = document.getElementById('resetPasswordForm');
    const successMessage = document.getElementById('successMessage');
    
    if (resetForm && successMessage) {
        resetForm.classList.remove('active');
        successMessage.classList.remove('hidden');
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
    
    // Insert the error message at the top of the form
    const resetForm = document.getElementById('resetPasswordForm');
    if (resetForm) {
        const formHeader = resetForm.querySelector('h2');
        if (formHeader) {
            resetForm.insertBefore(errorDiv, formHeader.nextSibling);
        } else {
            resetForm.insertBefore(errorDiv, resetForm.firstChild);
        }
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
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
    const confirmPasswordInput = document.getElementById('confirmNewPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.classList.remove('error', 'password-match-success');
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

// Make functions globally available
window.togglePassword = togglePassword;
