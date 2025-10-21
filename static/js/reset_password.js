class ResetPasswordForm {
    constructor() {
        this.form = document.getElementById('resetPasswordForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.errorBanner = document.getElementById('errorBanner');
        this.errorMessage = document.getElementById('errorMessage');
        this.passwordField = document.getElementById('password');
        this.confirmPasswordField = document.getElementById('confirmPassword');
        this.csrfToken = document.querySelector('input[name="csrf_token"]').value;

        this.init();
    }

    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.passwordField.addEventListener('input', () => this.validateField('password'));
        this.confirmPasswordField.addEventListener('input', () => this.validateField('confirmPassword'));
    }

    validateField(fieldName) {
        const password = this.passwordField.value;
        const confirmPassword = this.confirmPasswordField.value;

        switch(fieldName) {
            case 'password':
                if (password.length < 6) {
                    this.showError('password', 'Password must be at least 6 characters');
                    return false;
                }
                this.clearError('password');
                return true;

            case 'confirmPassword':
                if (password !== confirmPassword) {
                    this.showError('confirmPassword', 'Passwords do not match');
                    return false;
                }
                this.clearError('confirmPassword');
                return true;
        }
    }

    showError(fieldName, message) {
        const errorElement = document.getElementById(`${fieldName}Error`);
        if (errorElement) {
            errorElement.textContent = message;
        }
        this.errorBanner.classList.add('show');
        this.errorMessage.textContent = message;
    }

    clearError(fieldName) {
        const errorElement = document.getElementById(`${fieldName}Error`);
        if (errorElement) {
            errorElement.textContent = '';
        }
        this.errorBanner.classList.remove('show');
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

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateField('password') || !this.validateField('confirmPassword')) {
            return;
        }

        this.setLoading(true);

        try {
            const response = await fetch(window.location.href, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({
                    password: this.passwordField.value
                })
            });

            const data = await response.json();

            if (response.ok) {
                window.location.href = '/login?reset=success';
            } else {
                this.showError('password', data.error || 'Something went wrong. Please try again.');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showError('password', 'Network error. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ResetPasswordForm();
});