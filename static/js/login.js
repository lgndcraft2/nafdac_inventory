class LoginForm {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.errorBanner = document.getElementById('errorBanner');
        this.errorMessage = document.getElementById('errorMessage');
        this.successMessage = document.getElementById('successMessage');
        
        this.fields = {
            login: document.getElementById('login'),
            password: document.getElementById('password'),
            rememberMe: document.getElementById('rememberMe')
        };

        this.errors = {
            login: document.getElementById('loginError'),
            password: document.getElementById('passwordError')
        };

        this.init();
    }

    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        
        // Clear errors when user starts typing
        Object.keys(this.fields).forEach(field => {
            if (this.fields[field] && this.errors[field]) {
                this.fields[field].addEventListener('input', () => this.clearError(field));
                this.fields[field].addEventListener('focus', () => this.hideErrorBanner());
            }
        });

        // Check for URL parameters (e.g., registration success)
        this.checkUrlParams();
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const message = urlParams.get('message');
        
        if (message === 'registered') {
            this.showSuccess('Account created successfully! You can now sign in.');
        }
    }

    validateField(fieldName) {
        const field = this.fields[fieldName];
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        switch (fieldName) {
            case 'login':
                if (!value) {
                    errorMessage = 'Username or email is required';
                    isValid = false;
                }
                break;

            case 'password':
                if (!value) {
                    errorMessage = 'Password is required';
                    isValid = false;
                }
                break;
        }

        this.showFieldError(fieldName, errorMessage, !isValid);
        return isValid;
    }

    showFieldError(fieldName, message, hasError) {
        const field = this.fields[fieldName];
        const errorElement = this.errors[fieldName];

        if (!field || !errorElement) return;

        if (hasError) {
            field.classList.add('error');
            errorElement.textContent = message;
            errorElement.classList.add('show');
        } else {
            field.classList.remove('error');
            errorElement.classList.remove('show');
        }
    }

    clearError(fieldName) {
        this.showFieldError(fieldName, '', false);
    }

    showErrorBanner(message) {
        this.errorMessage.textContent = message;
        this.errorBanner.classList.add('show');
    }

    hideErrorBanner() {
        this.errorBanner.classList.remove('show');
    }

    showSuccess(message = 'Login successful! Redirecting...') {
        this.successMessage.textContent = message;
        this.successMessage.classList.add('show');
    }

    hideSuccess() {
        this.successMessage.classList.remove('show');
    }

    validateForm() {
        let isValid = true;
        ['login', 'password'].forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        return isValid;
    }

    async handleSubmit(e) {
        e.preventDefault();

        // Clear previous messages
        this.hideErrorBanner();
        this.hideSuccess();

        if (!this.validateForm()) {
            return;
        }

        this.setLoading(true);

        const formData = {
            login: this.fields.login.value.trim(),
            password: this.fields.password.value,
            remember_me: this.fields.rememberMe.checked
        };

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess();
                
                // Redirect after successful login
                setTimeout(() => {
                    window.location.href = data.redirect_url || '/dashboard';
                }, 1500);
            } else {
                // Handle different types of errors
                if (data.errors) {
                    // Field-specific errors
                    Object.keys(data.errors).forEach(field => {
                        if (this.errors[field]) {
                            this.showFieldError(field, data.errors[field], true);
                        }
                    });
                } else {
                    // General error message
                    this.showErrorBanner(data.message || 'Invalid credentials. Please try again.');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showErrorBanner('Network error. Please check your connection and try again.');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        if (loading) {
            this.submitBtn.disabled = true;
            this.submitBtn.classList.add('loading');
        } else {
            this.submitBtn.disabled = false;
            this.submitBtn.classList.remove('loading');
        }
    }
}

// Initialize the form when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LoginForm();
});