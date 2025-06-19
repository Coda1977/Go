// Frontend JavaScript for Go Leadership App

document.addEventListener('DOMContentLoaded', function() {
    // Auto-detect and set user's timezone
    detectAndSetTimezone();
    
    // Initialize signup form
    initializeSignupForm();
    
    // Add form validation
    addFormValidation();
});

// Detect user's timezone and set hidden field
function detectAndSetTimezone() {
    try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const timezoneField = document.getElementById('timezone');
        
        if (timezoneField) {
            timezoneField.value = timezone;
            console.log('Detected timezone:', timezone);
        }
    } catch (error) {
        console.warn('Could not detect timezone, using fallback');
        const timezoneField = document.getElementById('timezone');
        if (timezoneField) {
            timezoneField.value = 'UTC'; // Fallback to UTC
        }
    }
}

// Initialize the signup form with event listeners
function initializeSignupForm() {
    const form = document.getElementById('signupForm');
    if (!form) return;
    
    form.addEventListener('submit', handleSignupSubmit);
    
    // Add real-time validation
    const emailField = document.getElementById('email');
    const goalsField = document.getElementById('goals');
    
    if (emailField) {
        emailField.addEventListener('blur', validateEmail);
        emailField.addEventListener('input', clearEmailError);
    }
    
    if (goalsField) {
        goalsField.addEventListener('blur', validateGoals);
        goalsField.addEventListener('input', updateGoalsCounter);
    }
}

// Handle form submission
async function handleSignupSubmit(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const messageDiv = document.getElementById('message');
    const form = event.target;
    
    // Validate form before submission
    if (!validateForm()) {
        return;
    }
    
    // Disable submit button and show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Your Journey...';
    messageDiv.innerHTML = '';
    
    try {
        // Get form data
        const formData = new FormData(form);
        const data = {
            email: formData.get('email').trim(),
            goals: formData.get('goals').trim(),
            timezone: formData.get('timezone')
        };
        
        // Submit to server
        const response = await fetch('/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Success - redirect to success page
            window.location.href = `/success?email=${encodeURIComponent(data.email)}`;
        } else {
            // Show error message
            showMessage(result.message, 'error');
        }
        
    } catch (error) {
        console.error('Signup error:', error);
        showMessage('Something went wrong. Please try again.', 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = 'Start My 12-Week Journey →';
    }
}

// Validate the entire form
function validateForm() {
    const email = document.getElementById('email').value.trim();
    const goals = document.getElementById('goals').value.trim();
    
    let isValid = true;
    
    // Validate email
    if (!validateEmail()) {
        isValid = false;
    }
    
    // Validate goals
    if (!validateGoals()) {
        isValid = false;
    }
    
    return isValid;
}

// Validate email field
function validateEmail() {
    const emailField = document.getElementById('email');
    const email = emailField.value.trim();
    
    // Remove any existing error styling
    emailField.classList.remove('error');
    
    if (!email) {
        setFieldError(emailField, 'Email is required');
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        setFieldError(emailField, 'Please enter a valid email address');
        return false;
    }
    
    // Clear any error
    clearFieldError(emailField);
    return true;
}

// Validate goals field
function validateGoals() {
    const goalsField = document.getElementById('goals');
    const goals = goalsField.value.trim();
    
    // Remove any existing error styling
    goalsField.classList.remove('error');
    
    if (!goals) {
        setFieldError(goalsField, 'Please describe your leadership goals');
        return false;
    }
    
    if (goals.length < 20) {
        setFieldError(goalsField, 'Please provide more detail about your goals (at least 20 characters)');
        return false;
    }
    
    if (goals.length > 1000) {
        setFieldError(goalsField, 'Please keep your goals under 1000 characters');
        return false;
    }
    
    // Clear any error
    clearFieldError(goalsField);
    return true;
}

// Set field error styling and message
function setFieldError(field, message) {
    field.classList.add('error');
    
    // Remove existing error message
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Add new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

// Clear field error styling and message
function clearFieldError(field) {
    field.classList.remove('error');
    const errorDiv = field.parentNode.querySelector('.field-error');
    if (errorDiv) {
        errorDiv.remove();
    }
}

// Clear email error when user starts typing
function clearEmailError() {
    const emailField = document.getElementById('email');
    if (emailField.classList.contains('error')) {
        clearFieldError(emailField);
    }
}

// Update character counter for goals field
function updateGoalsCounter() {
    const goalsField = document.getElementById('goals');
    const goals = goalsField.value;
    
    // Remove existing counter
    const existingCounter = goalsField.parentNode.querySelector('.char-counter');
    if (existingCounter) {
        existingCounter.remove();
    }
    
    // Add character counter
    if (goals.length > 0) {
        const counter = document.createElement('div');
        counter.className = 'char-counter';
        counter.textContent = `${goals.length}/1000 characters`;
        
        if (goals.length > 1000) {
            counter.style.color = '#dc3545';
        } else if (goals.length < 20) {
            counter.style.color = '#ffc107';
        } else {
            counter.style.color = '#28a745';
        }
        
        goalsField.parentNode.appendChild(counter);
    }
    
    // Clear error when user starts typing enough
    if (goalsField.classList.contains('error') && goals.length >= 20) {
        clearFieldError(goalsField);
    }
}

// Show message to user
function showMessage(message, type = 'info') {
    const messageDiv = document.getElementById('message');
    if (!messageDiv) return;
    
    messageDiv.innerHTML = message;
    messageDiv.className = `message ${type}`;
    
    // Scroll to message
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.innerHTML = '';
            messageDiv.className = 'message';
        }, 5000);
    }
}

// Add form validation styles
function addFormValidation() {
    // Add CSS for validation
    const style = document.createElement('style');
    style.textContent = `
        .form-group input.error,
        .form-group textarea.error {
            border-color: #dc3545;
            box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
        }
        
        .field-error {
            color: #dc3545;
            font-size: 14px;
            margin-top: 5px;
            font-weight: 500;
        }
        
        .char-counter {
            font-size: 12px;
            margin-top: 5px;
            text-align: right;
            font-weight: 500;
        }
        
        .form-group input:focus,
        .form-group textarea:focus {
            box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
        }
        
        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #ffffff;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s ease-in-out infinite;
            margin-right: 8px;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    
    document.head.appendChild(style);
}

// Smooth scrolling for anchor links
function initializeSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Initialize smooth scrolling
initializeSmoothScrolling();