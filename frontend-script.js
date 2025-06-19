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

// Add loading spinner to button
function addLoadingSpinner(button) {
    const spinner = document.createElement('span');
    spinner.className = 'loading-spinner';
    button.insertBefore(spinner, button.firstChild);
}

// Remove loading spinner from button
function removeLoadingSpinner(button) {
    const spinner = button.querySelector('.loading-spinner');
    if (spinner) {
        spinner.remove();
    }
}

// Enhanced form submission with better UX
async function handleSignupSubmitEnhanced(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const messageDiv = document.getElementById('message');
    const form = event.target;
    
    // Validate form before submission
    if (!validateForm()) {
        // Highlight the first error field
        const firstError = form.querySelector('.error');
        if (firstError) {
            firstError.focus();
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    // Show loading state
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    addLoadingSpinner(submitBtn);
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
        
        // Show progress message
        showMessage('Analyzing your goals and setting up your personalized journey...', 'info');
        
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
            // Show success message briefly before redirect
            showMessage('✅ Success! Redirecting to your welcome page...', 'success');
            
            // Small delay to show success message
            setTimeout(() => {
                window.location.href = `/success?email=${encodeURIComponent(data.email)}`;
            }, 1500);
        } else {
            // Show error message
            showMessage(result.message, 'error');
        }
        
    } catch (error) {
        console.error('Signup error:', error);
        showMessage('Something went wrong. Please check your internet connection and try again.', 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        removeLoadingSpinner(submitBtn);
        submitBtn.textContent = originalText;
    }
}

// Email suggestions for common typos
function suggestEmailCorrection(email) {
    const commonDomains = [
        'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
        'aol.com', 'icloud.com', 'protonmail.com'
    ];
    
    const emailParts = email.split('@');
    if (emailParts.length !== 2) return null;
    
    const [username, domain] = emailParts;
    
    // Check for common typos
    const suggestions = {
        'gmai.com': 'gmail.com',
        'gmial.com': 'gmail.com',
        'yaho.com': 'yahoo.com',
        'hotmai.com': 'hotmail.com',
        'outlok.com': 'outlook.com'
    };
    
    if (suggestions[domain]) {
        return `${username}@${suggestions[domain]}`;
    }
    
    return null;
}

// Enhanced email validation with suggestions
function validateEmailEnhanced() {
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
        // Check for suggestion
        const suggestion = suggestEmailCorrection(email);
        if (suggestion) {
            setFieldSuggestion(emailField, `Did you mean ${suggestion}?`, suggestion);
        } else {
            setFieldError(emailField, 'Please enter a valid email address');
        }
        return false;
    }
    
    // Clear any error or suggestion
    clearFieldError(emailField);
    clearFieldSuggestion(emailField);
    return true;
}

// Set field suggestion
function setFieldSuggestion(field, message, suggestion) {
    field.classList.add('suggestion');
    
    // Remove existing suggestion
    const existingSuggestion = field.parentNode.querySelector('.field-suggestion');
    if (existingSuggestion) {
        existingSuggestion.remove();
    }
    
    // Add new suggestion
    const suggestionDiv = document.createElement('div');
    suggestionDiv.className = 'field-suggestion';
    suggestionDiv.innerHTML = `
        ${message} 
        <button type="button" class="suggestion-btn" onclick="applySuggestion('${field.id}', '${suggestion}')">
            Use this
        </button>
    `;
    field.parentNode.appendChild(suggestionDiv);
}

// Clear field suggestion
function clearFieldSuggestion(field) {
    field.classList.remove('suggestion');
    const suggestionDiv = field.parentNode.querySelector('.field-suggestion');
    if (suggestionDiv) {
        suggestionDiv.remove();
    }
}

// Apply email suggestion
function applySuggestion(fieldId, suggestion) {
    const field = document.getElementById(fieldId);
    field.value = suggestion;
    clearFieldSuggestion(field);
    field.focus();
    validateEmail();
}

// Goal examples and inspiration
const goalExamples = [
    "Improve my ability to give constructive feedback without damaging team relationships",
    "Develop better listening skills and learn to ask more thoughtful questions in meetings",
    "Build confidence in public speaking and presenting to senior leadership",
    "Learn to delegate effectively while maintaining quality standards",
    "Improve my emotional intelligence and ability to manage difficult conversations",
    "Develop a more strategic mindset and improve my decision-making process",
    "Build stronger relationships with team members and create better team cohesion",
    "Learn to manage my time better and set clearer priorities for my team",
    "Develop skills to lead through change and uncertainty",
    "Improve my ability to motivate and inspire others to achieve their best"
];

// Add goal inspiration feature
function addGoalInspiration() {
    const goalsField = document.getElementById('goals');
    if (!goalsField) return;
    
    // Add inspiration button
    const inspirationBtn = document.createElement('button');
    inspirationBtn.type = 'button';
    inspirationBtn.className = 'inspiration-btn';
    inspirationBtn.textContent = '💡 Need inspiration?';
    inspirationBtn.onclick = showGoalExamples;
    
    goalsField.parentNode.appendChild(inspirationBtn);
}

// Show goal examples modal
function showGoalExamples() {
    const modal = document.createElement('div');
    modal.className = 'inspiration-modal';
    modal.innerHTML = `
        <div class="inspiration-content">
            <h3>Leadership Goal Examples</h3>
            <p>Here are some examples to inspire your own goals:</p>
            <div class="examples-list">
                ${goalExamples.map(example => `
                    <div class="example-item" onclick="useExample('${example.replace(/'/g, "\\'")}')">
                        "${example}"
                    </div>
                `).join('')}
            </div>
            <div class="inspiration-actions">
                <button onclick="closeInspiration()" class="secondary-btn">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeInspiration();
        }
    });
}

// Use example goal
function useExample(example) {
    const goalsField = document.getElementById('goals');
    goalsField.value = example;
    updateGoalsCounter();
    closeInspiration();
    goalsField.focus();
}

// Close inspiration modal
function closeInspiration() {
    const modal = document.querySelector('.inspiration-modal');
    if (modal) {
        modal.remove();
    }
}

// Analytics and tracking (privacy-friendly)
function trackEvent(eventName, data = {}) {
    // Only track if user hasn't opted out
    if (localStorage.getItem('go-analytics-opt-out') === 'true') {
        return;
    }
    
    // Simple privacy-friendly analytics
    const event = {
        name: eventName,
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...data
    };
    
    // Could send to analytics service here
    console.log('Event tracked:', event);
}

// Track form interactions
function addAnalytics() {
    const form = document.getElementById('signupForm');
    if (!form) return;
    
    // Track form start
    form.addEventListener('focus', () => {
        trackEvent('form_started');
    }, { once: true });
    
    // Track form completion
    form.addEventListener('submit', () => {
        trackEvent('form_submitted');
    });
    
    // Track field completion
    document.getElementById('email')?.addEventListener('blur', (e) => {
        if (e.target.value.trim()) {
            trackEvent('email_entered');
        }
    }, { once: true });
    
    document.getElementById('goals')?.addEventListener('blur', (e) => {
        if (e.target.value.trim().length >= 20) {
            trackEvent('goals_entered');
        }
    }, { once: true });
}

// Initialize all features when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Core functionality
    detectAndSetTimezone();
    initializeSignupForm();
    addFormValidation();
    
    // Enhanced features
    initializeSmoothScrolling();
    addGoalInspiration();
    addAnalytics();
    
    // Add enhanced validation styles
    const enhancedStyles = document.createElement('style');
    enhancedStyles.textContent = `
        .field-suggestion {
            color: #fd7e14;
            font-size: 14px;
            margin-top: 5px;
            font-weight: 500;
        }
        
        .suggestion-btn {
            background: none;
            border: none;
            color: #667eea;
            text-decoration: underline;
            cursor: pointer;
            font-size: 14px;
            padding: 0;
            margin-left: 5px;
        }
        
        .inspiration-btn {
            background: transparent;
            border: 1px solid #667eea;
            color: #667eea;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            margin-top: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .inspiration-btn:hover {
            background: #667eea;
            color: white;
        }
        
        .inspiration-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        
        .inspiration-content {
            background: white;
            padding: 30px;
            border-radius: 15px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            margin: 20px;
        }
        
        .examples-list {
            margin: 20px 0;
        }
        
        .example-item {
            padding: 15px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-style: italic;
            color: #666;
        }
        
        .example-item:hover {
            background: #f8f9fa;
            border-color: #667eea;
            color: #333;
        }
        
        .inspiration-actions {
            text-align: center;
            margin-top: 20px;
        }
        
        .secondary-btn {
            background: transparent;
            border: 2px solid #667eea;
            color: #667eea;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
        }
        
        .secondary-btn:hover {
            background: #667eea;
            color: white;
        }
    `;
    
    document.head.appendChild(enhancedStyles);
});

// Make functions available globally for onclick handlers
window.applySuggestion = applySuggestion;
window.useExample = useExample;
window.closeInspiration = closeInspiration;