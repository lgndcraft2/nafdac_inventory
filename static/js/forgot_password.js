class ForgotPasswordForm {
    constructor() {
        this.form = document.getElementById('forgotPasswordForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.errorBanner = document.getElementById('errorBanner');
        this.errorMessage = document.getElementById('errorMessage');
        this.successMessage = document.getElementById('successMessage');
        this.emailField = document.getElementById('email');
        this.emailError = document.getElementById('emailError');
        this.csrfToken = document.querySelector('input[name="csrf_token"]').value;

        this.init();
    }

    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.emailField.addEventListener('input', () => this.clearError());
    }

    clearError() {
        this.emailError.textContent = '';
        this.emailField.classList.remove('error');
        this.errorBanner.classList.remove('show');
    }

    showError(message) {
        this.emailError.textContent = message;
        this.emailField.classList.add('error');
        this.errorBanner.classList.add('show');
        this.errorMessage.textContent = message;
    }

    showSuccess() {
        this.successMessage.classList.add('show');
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
        this.clearError();

        const email = this.emailField.value.trim();
        if (!email) {
            this.showError('Email is required');
            return;
        }

        this.setLoading(true);

        try {
            const response = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess();
                this.form.reset();
            } else {
                this.showError(data.error || 'Something went wrong. Please try again.');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ForgotPasswordForm();
});