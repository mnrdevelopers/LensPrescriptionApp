// auth.js - ENHANCED SECURITY VERSION

// Security Configuration
const SECURITY_CONFIG = {
    maxLoginAttempts: 3,
    lockoutDuration: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    passwordMinLength: 8,
    requireStrongPassword: true
};

// Security State
let loginAttempts = 0;
let accountLockedUntil = null;
let currentUserEmail = null;

// Initialize enhanced security system
function initializeAuth() {
    loadSecurityState();
    checkAccountLockStatus();
    
    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user && !isRedirecting) {
            console.log('User authenticated, redirecting to app...');
            resetSecurityState(); // Reset attempts on successful login
            isRedirecting = true;
            window.location.href = 'app.html';
        }
    });

    // Add form event listeners
    if (loginFormElement) loginFormElement.addEventListener('submit', handleLogin);
    if (registerFormElement) registerFormElement.addEventListener('submit', handleRegister);
    if (forgotPasswordFormElement) forgotPasswordFormElement.addEventListener('submit', handleForgotPassword);
    
    // New recovery form listener
    const accountRecoveryFormElement = document.getElementById('accountRecoveryFormElement');
    if (accountRecoveryFormElement) {
        accountRecoveryFormElement.addEventListener('submit', handleAccountRecovery);
    }

    setupPasswordValidation();
    setupSecurityMonitoring();
}

// Security Monitoring
function setupSecurityMonitoring() {
    // Monitor login attempts
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

    if (!password) {
        strengthBar.className = 'password-strength';
        hintText.textContent = '';
        return 'empty';
    }

    let strength = 0;
    let hints = [];

    // Check length
    if (password.length >= 8) {
        strength += 1;
        requirements.length.className = 'requirement met';
        requirements.length.innerHTML = '<span class="requirement-icon">✓</span> At least 8 characters';
    } else {
        requirements.length.className = 'requirement unmet';
        requirements.length.innerHTML = '<span class="requirement-icon">○</span> At least 8 characters';
        hints.push('Use at least 8 characters');
    }

    // Check uppercase
    if (/[A-Z]/.test(password)) {
        strength += 1;
        requirements.uppercase.className = 'requirement met';
        requirements.uppercase.innerHTML = '<span class="requirement-icon">✓</span> One uppercase letter';
    } else {
        requirements.uppercase.className = 'requirement unmet';
        requirements.uppercase.innerHTML = '<span class="requirement-icon">○</span> One uppercase letter';
        hints.push('Add an uppercase letter (A-Z)');
    }

    // Check lowercase
    if (/[a-z]/.test(password)) {
        strength += 1;
        requirements.lowercase.className = 'requirement met';
        requirements.lowercase.innerHTML = '<span class="requirement-icon">✓</span> One lowercase letter';
    } else {
        requirements.lowercase.className = 'requirement unmet';
        requirements.lowercase.innerHTML = '<span class="requirement-icon">○</span> One lowercase letter';
        hints.push('Add a lowercase letter (a-z)');
    }

    // Check numbers
    if (/[0-9]/.test(password)) {
        strength += 1;
        requirements.number.className = 'requirement met';
        requirements.number.innerHTML = '<span class="requirement-icon">✓</span> One number';
    } else {
        requirements.number.className = 'requirement unmet';
        requirements.number.innerHTML = '<span class="requirement-icon">○</span> One number';
        hints.push('Include a number (0-9)');
    }

    // Check special characters
    if (/[^A-Za-z0-9]/.test(password)) {
        strength += 1;
        requirements.special.className = 'requirement met';
        requirements.special.innerHTML = '<span class="requirement-icon">✓</span> One special character';
    } else {
        requirements.special.className = 'requirement unmet';
        requirements.special.innerHTML = '<span class="requirement-icon">○</span> One special character';
        hints.push('Add a special character (!@#$% etc.)');
    }

    // Update strength bar and hints
    let strengthLevel = '';
    if (strength <= 2) {
        strengthLevel = 'weak';
        strengthBar.className = 'password-strength weak';
        hintText.textContent = 'Password is weak. ' + hints[0];
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

// Enhanced Login Handler with Security Features
async function handleLogin(event) {
    event.preventDefault();
    
    if (isAccountLocked()) {
        showAccountLockWarning();
        return;
    }

    const email = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;

    // Validate inputs
    if (!email || !password) {
        showSecurityWarning('Please fill in all fields', 'warning');
        return;
    }

    currentUserEmail = email;
    const loginButton = loginFormElement.querySelector('button[type="submit"]');
    setButtonLoading(loginButton, true, 'Login');

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Reset security state on successful login
        resetSecurityState();

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
        
        console.log('Login successful, security state reset');

    } catch (error) {
        console.error('Login error:', error);
        
        // Handle failed login attempts
        await handleFailedLoginAttempt(error);
        
    } finally {
        setButtonLoading(loginButton, false, 'Login');
    }
}

// Handle Failed Login Attempts
async function handleFailedLoginAttempt(error) {
    loginAttempts++;
    saveSecurityState();

    const remainingAttempts = SECURITY_CONFIG.maxLoginAttempts - loginAttempts;
    
    if (loginAttempts >= SECURITY_CONFIG.maxLoginAttempts) {
        // Lock the account
        accountLockedUntil = Date.now() + SECURITY_CONFIG.lockoutDuration;
        saveSecurityState();
        
        showAccountLockWarning();
        showSecurityWarning(
            `Account temporarily locked due to too many failed attempts. Please try again in 24 hours or use account recovery.`,
            'danger'
        );
    } else if (loginAttempts === 1) {
        showSecurityWarning(
            `Invalid credentials. ${remainingAttempts} attempts remaining.`,
            'warning'
        );
    } else if (loginAttempts === 2) {
        showSecurityWarning(
            `Invalid credentials. Last attempt before account lock!`,
            'danger'
        );
    } else {
        handleAuthError(error);
    }
    
    updateLoginAttemptsDisplay();
}

// Account Recovery System
async function handleAccountRecovery(event) {
    event.preventDefault();
    
    const email = document.getElementById('recoveryEmail').value.trim();
    const securityAnswer = document.getElementById('recoveryAnswer').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    
    if (!email) {
        showSecurityWarning('Please enter your email address', 'warning');
        return;
    }

    const recoveryButton = document.getElementById('recoveryButton');
    setButtonLoading(recoveryButton, true, 'Verify');

    try {
        // Check if user exists
        const userRecord = await getUserSecurityQuestion(email);
        
        if (!userRecord) {
            showSecurityWarning('No account found with this email address', 'warning');
            return;
        }

        // Verify security answer
        if (await verifySecurityAnswer(email, securityAnswer)) {
            // Reset password
            await auth.sendPasswordResetEmail(email);
            resetSecurityState(); // Reset lockout on successful recovery
            
            showSuccessMessage('Password reset email sent! Check your inbox.');
        } else {
            showSecurityWarning('Incorrect security answer', 'warning');
        }

    } catch (error) {
        console.error('Account recovery error:', error);
        showSecurityWarning('Recovery failed: ' + error.message, 'danger');
    } finally {
        setButtonLoading(recoveryButton, false, 'Verify & Reset');
    }
}

// Security Question Management
async function saveSecurityQuestion(userId, question, answer) {
    try {
        await db.collection('userSecurity').doc(userId).set({
            securityQuestion: question,
            securityAnswer: hashAnswer(answer), // Always hash security answers
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error saving security question:', error);
        throw error;
    }
}

async function getUserSecurityQuestion(email) {
    try {
        // In a real app, you'd look up by email
        // This is a simplified version
        const user = await auth.getUserByEmail(email);
        if (user) {
            const securityDoc = await db.collection('userSecurity').doc(user.uid).get();
            return securityDoc.exists ? securityDoc.data() : null;
        }
        return null;
    } catch (error) {
        console.error('Error getting security question:', error);
        return null;
    }
}

async function verifySecurityAnswer(email, answer) {
    try {
        const user = await auth.getUserByEmail(email);
        if (user) {
            const securityDoc = await db.collection('userSecurity').doc(user.uid).get();
            if (securityDoc.exists) {
                const securityData = securityDoc.data();
                return securityData.securityAnswer === hashAnswer(answer);
            }
        }
        return false;
    } catch (error) {
        console.error('Error verifying security answer:', error);
        return false;
    }
}

function hashAnswer(answer) {
    // Simple hash for demo purposes - use a proper hashing library in production
    let hash = 0;
    for (let i = 0; i < answer.length; i++) {
        const char = answer.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
}

// Enhanced Registration with Security Questions
async function handleRegister(event) {
    event.preventDefault();
    
    console.log('Registration started...');
    
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
    const securityQuestion = document.getElementById('securityQuestion').value;
    const securityAnswer = document.getElementById('securityAnswer').value.trim();
    
    // Clear previous errors
    clearFormErrors();
    const passwordMatchError = document.getElementById('passwordMatchError');
    if (passwordMatchError) passwordMatchError.style.display = 'none';

    // Enhanced validation
    if (!email || !password || !confirmPassword || !securityQuestion || !securityAnswer) {
        showSecurityWarning('Please fill in all fields.', 'warning');
        return;
    }

    // Check password strength
    const passwordStrength = checkPasswordStrength(password);
    if (SECURITY_CONFIG.requireStrongPassword && passwordStrength === 'weak') {
        showSecurityWarning('Please use a stronger password.', 'warning');
        return;
    }

    if (password !== confirmPassword) {
        if (passwordMatchError) {
            passwordMatchError.textContent = 'Passwords do not match';
            passwordMatchError.style.display = 'block';
        }
        showSecurityWarning('Passwords do not match.', 'warning');
        return;
    }

    if (password.length < SECURITY_CONFIG.passwordMinLength) {
        showSecurityWarning(`Password must be at least ${SECURITY_CONFIG.passwordMinLength} characters long`, 'warning');
        return;
    }

    const registerButton = document.getElementById('registerButton');
    setButtonLoading(registerButton, true, 'Register');

    try {
        console.log('Creating Firebase user...');
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        console.log('Firebase user created successfully:', user.uid);

        // Save security question
        await saveSecurityQuestion(user.uid, securityQuestion, securityAnswer);

        // Set registration flags
        localStorage.setItem('freshRegistration', 'true');
        localStorage.setItem('username', email);
        localStorage.setItem('userId', user.uid);

        console.log('Registration completed successfully');
        showSuccess('Registration successful! Redirecting to profile setup...');
        
    } catch (error) {
        console.error('Registration error:', error);
        handleAuthError(error);
    } finally {
        setButtonLoading(registerButton, false, 'Register');
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

// Enhanced UI Functions
function showSecurityWarning(message, type = 'warning') {
    const warningDiv = document.createElement('div');
    warningDiv.className = `security-warning ${type}`;
    warningDiv.innerHTML = `
        <span class="warning-icon">${type === 'danger' ? '⚠️' : type === 'info' ? 'ℹ️' : '⚠️'}</span>
        <span>${message}</span>
    `;
    
    // Remove existing warnings
    const existingWarnings = document.querySelectorAll('.security-warning');
    existingWarnings.forEach(warning => warning.remove());
    
    // Insert warning
    const activeForm = document.querySelector('.form-container.active');
    if (activeForm) {
        activeForm.insertBefore(warningDiv, activeForm.querySelector('form'));
        
        // Auto-remove after 5 seconds for non-danger messages
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
    const timeLeft = accountLockedUntil - Date.now();
    const hoursLeft = Math.ceil(timeLeft / (60 * 60 * 1000));
    
    const lockDiv = document.createElement('div');
    lockDiv.className = 'account-lock-warning';
    lockDiv.innerHTML = `
        <h4>🔒 Account Temporarily Locked</h4>
        <p>Too many failed login attempts. For security reasons, your account has been locked.</p>
        <div class="account-lock-timer">Time remaining: ${hoursLeft} hours</div>
        <p><a href="#" onclick="showAccountRecovery()">Use account recovery to reset your password</a></p>
    `;
    
    // Remove existing lock warnings
    const existingLocks = document.querySelectorAll('.account-lock-warning');
    existingLocks.forEach(lock => lock.remove());
    
    const activeForm = document.querySelector('.form-container.active');
    if (activeForm) {
        activeForm.insertBefore(lockDiv, activeForm.querySelector('form'));
    }
}

function updateLoginAttemptsDisplay() {
    const attemptsDisplay = document.querySelector('.attempts-counter');
    if (attemptsDisplay) {
        const remaining = SECURITY_CONFIG.maxLoginAttempts - loginAttempts;
        if (loginAttempts > 0) {
            attemptsDisplay.innerHTML = `
                <span class="${remaining <= 1 ? 'attempts-warning' : ''}">
                    ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining
                </span>
            `;
        } else {
            attemptsDisplay.innerHTML = '';
        }
    }
}

// New UI Functions
function showAccountRecovery() {
    hideAllForms();
    const recoveryForm = document.getElementById('accountRecoveryForm');
    if (recoveryForm) {
        recoveryForm.classList.add('active');
    }
    clearFormErrors();
}

// Update the existing hideAllForms function
function hideAllForms() {
    if (loginForm) loginForm.classList.remove('active');
    if (registerForm) registerForm.classList.remove('active');
    if (forgotPasswordForm) forgotPasswordForm.classList.remove('active');
    if (successMessage) successMessage.classList.add('hidden');
    
    const recoveryForm = document.getElementById('accountRecoveryForm');
    if (recoveryForm) recoveryForm.classList.remove('active');
}

// Update the forgot password handler to suggest account recovery
async function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('forgotUsername').value.trim();

    if (!email) {
        showSecurityWarning('Please enter your email address', 'warning');
        return;
    }

    const resetButton = forgotPasswordFormElement.querySelector('button[type="submit"]');
    setButtonLoading(resetButton, true, 'Reset Password');

    try {
        await auth.sendPasswordResetEmail(email);
        showSuccessMessage('Password reset email sent! Check your inbox.');
    } catch (error) {
        console.error('Password reset error:', error);
        if (error.code === 'auth/too-many-requests') {
            showSecurityWarning(
                'Too many reset attempts. Please try account recovery or wait before trying again.',
                'danger'
            );
        } else {
            handleAuthError(error);
        }
    } finally {
        setButtonLoading(resetButton, false, 'Reset Password');
    }
}

// Export new functions for global access
window.showAccountRecovery = showAccountRecovery;
window.checkPasswordStrength = checkPasswordStrength;
