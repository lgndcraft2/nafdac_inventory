class RegistrationForm {
    constructor() {
        this.form = document.getElementById('registrationForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.successMessage = document.getElementById('successMessage');
        
        this.fields = {
            username: document.getElementById('username'),
            email: document.getElementById('email'),
            password: document.getElementById('password'),
            unit: document.getElementById('unit'),
            branch: document.getElementById('branch'),
            confirmPassword: document.getElementById('confirmPassword')
        };

        this.errors = {
            username: document.getElementById('usernameError'),
            email: document.getElementById('emailError'),
            unit: document.getElementById('unitError'),
            branch: document.getElementById('branchError'),
            password: document.getElementById('passwordError'),
            confirmPassword: document.getElementById('confirmPasswordError')
        };
        this.csrfToken = document.querySelector('input[name="csrf_token"]').value;
        this.init();
    }

    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        
        this.fields.branch.addEventListener('change', this.handleBranchChange.bind(this));

        // Real-time validation
        Object.keys(this.fields).forEach(field => {
            this.fields[field].addEventListener('blur', () => this.validateField(field));
            this.fields[field].addEventListener('input', () => this.clearError(field));
        });

        // Password confirmation validation
        this.fields.confirmPassword.addEventListener('input', () => {
            this.validatePasswordMatch();
        });
    }

    validateField(fieldName) {
        const field = this.fields[fieldName];
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        switch (fieldName) {
            case 'username':
                if (!value) {
                    errorMessage = 'Username is required';
                    isValid = false;
                } else if (value.length < 3) {
                    errorMessage = 'Username must be at least 3 characters';
                    isValid = false;
                } else if (value.length > 150) {
                    errorMessage = 'Username must be less than 150 characters';
                    isValid = false;
                } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                    errorMessage = 'Username can only contain letters, numbers, and underscores';
                    isValid = false;
                }
                break;

            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!value) {
                    errorMessage = 'Email is required';
                    isValid = false;
                } else if (!emailRegex.test(value)) {
                    errorMessage = 'Please enter a valid email address';
                    isValid = false;
                } else if (value.length > 150) {
                    errorMessage = 'Email must be less than 150 characters';
                    isValid = false;
                }
                break;

            case 'password':
                if (!value) {
                    errorMessage = 'Password is required';
                    isValid = false;
                } else if (value.length < 8) {
                    errorMessage = 'Password must be at least 8 characters';
                    isValid = false;
                } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
                    errorMessage = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
                    isValid = false;
                }
                break;

            case 'confirmPassword':
                if (!value) {
                    errorMessage = 'Please confirm your password';
                    isValid = false;
                } else if (value !== this.fields.password.value) {
                    errorMessage = 'Passwords do not match';
                    isValid = false;
                }
                break;
        }

        this.showError(fieldName, errorMessage, !isValid);
        return isValid;
    }

    validatePasswordMatch() {
        const password = this.fields.password.value;
        const confirmPassword = this.fields.confirmPassword.value;
        
        if (confirmPassword && password !== confirmPassword) {
            this.showError('confirmPassword', 'Passwords do not match', true);
        } else if (confirmPassword) {
            this.showError('confirmPassword', '', false);
        }
    }

    showError(fieldName, message, hasError) {
        const field = this.fields[fieldName];
        const errorElement = this.errors[fieldName];

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
        this.showError(fieldName, '', false);
    }

    validateForm() {
        let isValid = true;
        Object.keys(this.fields).forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        return isValid;
    }

    handleBranchChange() {
        const selectedBranchId = this.fields.branch.value;
        const unitOptions = this.fields.unit.querySelectorAll('option');

        // Reset the unit dropdown to its placeholder
        this.fields.unit.value = '';

        // Loop through all possible unit options
        unitOptions.forEach(option => {
            // Show the option if its 'data-branch' matches the selected branch, or if it's the placeholder
            if (option.dataset.branch === selectedBranchId || !option.value) {
                option.style.display = 'block';
            } else {
                option.style.display = 'none';
            }
        });
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (!this.validateForm()) {
            return;
        }

        this.setLoading(true);
        this.hideSuccess();

        const formData = {
            username: this.fields.username.value.trim(),
            email: this.fields.email.value.trim(),
            unit: this.fields.unit.value.trim(),
            password: this.fields.password.value,
            roles: 'user' // Default role as per your model
        };

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess();
                this.form.reset();
                // Optionally redirect after a delay
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                this.handleServerErrors(data.errors || { general: data.message || 'Registration failed' });
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('username', 'Network error. Please try again.', true);
        } finally {
            this.setLoading(false);
        }
    }

    handleServerErrors(errors) {
        Object.keys(errors).forEach(field => {
            if (this.errors[field]) {
                this.showError(field, errors[field], true);
            } else {
                // Handle general errors
                this.showError('username', errors[field] || 'An error occurred', true);
            }
        });
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

    showSuccess() {
        this.successMessage.classList.add('show');
    }

    hideSuccess() {
        this.successMessage.classList.remove('show');
    }
}

// Initialize the form when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RegistrationForm();
});