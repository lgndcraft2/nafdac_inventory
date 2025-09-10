class EquipmentFormValidator {
    constructor() {
        this.form = document.getElementById('equipmentForm');
        this.fields = {
            name: this.form.querySelector('input[name="name"]'),
            manufacturer: this.form.querySelector('input[name="manufacturer"]'),
            model: this.form.querySelector('input[name="model"]'),
            serial_number: this.form.querySelector('input[name="serial_number"]'),
            new_id_number: this.form.querySelector('input[name="new_id_number"]'),
            location: this.form.querySelector('input[name="location"]'),
            calibration_date: this.form.querySelector('input[name="calibration_date"]'),
            maintenance_date: this.form.querySelector('input[name="maintenance_date"]'),
            calibration_frequency: this.form.querySelector('select[name="calibration_frequency"]'),
            maintenance_frequency: this.form.querySelector('select[name="maintenance_frequency"]'),
            quantity: this.form.querySelector('input[name="quantity"]'),
            description: this.form.querySelector('textarea[name="description"]')
        };
        this.submitBtn = this.form.querySelector('.submit-btn');
        this.successMessage = document.getElementById('success-message');
        this.validationTimeouts = {};
        this.uniqueIdValid = true;
        
        this.init();
    }

    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        
        Object.keys(this.fields).forEach(fieldName => {
            const field = this.fields[fieldName];
            field.addEventListener('blur', () => this.validateField(fieldName));
            field.addEventListener('input', () => {
                this.clearError(fieldName);
                if (fieldName === 'new_id_number') {
                    clearTimeout(this.validationTimeouts[fieldName]);
                    this.validationTimeouts[fieldName] = setTimeout(() => {
                        this.validateField(fieldName);
                    }, 5);
                }
            });
        });
    }

    async validateField(fieldName) {
    const field = this.fields[fieldName];
    const value = field.value.trim();
    const errorElement = document.getElementById(`${fieldName}-error`);
    let isValid = true;
    let errorMessage = '';

    switch (fieldName) {
        case 'name':
            if (value.length < 3) {
                isValid = false;
                errorMessage = 'Name must be at least 3 characters long';
            }
            break;

        case 'manufacturer':
            if (value.length < 2) {
                isValid = false;
                errorMessage = 'Manufacturer must be at least 2 characters long';
            }
            break;

        case 'quantity':
            if (!value || parseInt(value) < 1) {
                isValid = false;
                errorMessage = 'Quantity must be at least 1';
            }
            break;

        case 'new_id_number':
            if (value && !/^[A-Za-z0-9\-_]+$/.test(value)) {
                isValid = false;
                errorMessage = 'ID number should contain only letters, numbers, hyphens, and underscores';
            } else if (value && value.length >= 3) {
                // Run async uniqueness check
                const unique = await this.checkIdUniqueness(value, fieldName);
                if (!unique) {
                    isValid = false;
                    errorMessage = 'This ID number is already in use. Please choose another.';
                }
            }
            break;

        default:
            break;
    }

    if (!isValid) {
        field.classList.remove('success', 'checking');
        field.classList.add('error');
        errorElement.textContent = errorMessage;
        errorElement.classList.add('show');
    } else {
        // Only mark success if not currently checking
        if (!field.classList.contains('checking')) {
            field.classList.remove('error', 'checking');
            field.classList.add('success');
            errorElement.classList.remove('show');
        }
    }

    return isValid;
    }


    async checkIdUniqueness(idValue, fieldName) {
    const field = this.fields[fieldName];
    const errorElement = document.getElementById(`${fieldName}-error`);

    try {
        // Show "checking" state
        field.classList.remove('error', 'success');
        field.classList.add('checking');
        errorElement.textContent = 'Checking ID availability...';
        errorElement.classList.add('show');

        // Call your backend
        const response = await fetch(`/api/check-id-uniqueness?id=${encodeURIComponent(idValue)}`);
        const data = await response.json();

        if (data.isUnique) {
            // ✅ ID is available
            field.classList.remove('checking', 'error');
            field.classList.add('success');
            errorElement.classList.remove('show');
            return true;
        } else {
            // ❌ ID already exists
            field.classList.remove('checking', 'success');
            field.classList.add('error');
            errorElement.textContent = 'This ID number is already in use. Please choose another.';
            errorElement.classList.add('show');
            return false;
        }
    } catch (error) {
        console.error('Error checking ID uniqueness:', error);

        // In case of network/server issue, don’t block the user
        field.classList.remove('checking');
        field.classList.add('success');
        errorElement.classList.remove('show');
        return true; 
    }
    }

    showFieldResult(fieldName, isValid, errorMessage) {
        const field = this.fields[fieldName];
        const errorElement = document.getElementById(`${fieldName}-error`);

        field.classList.remove('error', 'success');
        errorElement.classList.remove('show');

        if (!isValid) {
            field.classList.add('error');
            errorElement.textContent = errorMessage;
            errorElement.classList.add('show');
        } else if (field.value.trim()) {
            field.classList.add('success');
        }
    }

    clearError(fieldName) {
        const field = this.fields[fieldName];
        const errorElement = document.getElementById(`${fieldName}-error`);
        
        field.classList.remove('error');
        errorElement.classList.remove('show');
    }

    validateForm() {
        let isFormValid = true;

        if (!this.validateField('name')) isFormValid = false;
        if (!this.validateField('calibration_frequency')) isFormValid = false;
        if (!this.validateField('maintenance_frequency')) isFormValid = false;
        if (!this.validateField('quantity')) isFormValid = false;

        Object.keys(this.fields).forEach(fieldName => {
            if (!['name', 'quantity', 'calibration_frequency', 'maintenance_frequency'].includes(fieldName)) {
                if (this.fields[fieldName].value.trim()) {
                    if (!this.validateField(fieldName)) {
                        isFormValid = false;
                    }
                }
            }
        });

        return isFormValid;
    }

    async handleSubmit(e) {
        e.preventDefault();
        this.successMessage.classList.remove('show');

        const isFormValid = this.validateForm();

        // Await uniqueness check if ID provided
        let idValid = true;
        const newIdValue = this.fields.new_id_number.value.trim();
        if (newIdValue) {
            idValid = await this.checkIdUniqueness(newIdValue, 'new_id_number');
        }

        if (isFormValid && idValid) {
            this.submitBtn.disabled = true;
            this.submitBtn.textContent = 'Adding Equipment...';

            const formData = {}
            Object.keys(this.fields).forEach(fieldName => {
                formData[fieldName] = this.fields[fieldName].value.trim();
            });

            fetch('/api/add_equipments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(new_equipment => {
                this.showSuccessMessage();
                this.resetForm();
            })
            .catch(error => {
                console.error('Error adding equipment:', error);
                alert('An error occurred while adding the equipment. Please try again.');
            })
            .finally(() => {
                this.submitBtn.disabled = false;
                this.submitBtn.textContent = 'Add Equipment';
            });

        } else {
            const firstError = this.form.querySelector('.error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.focus();
            }
        }
    }

    showSuccessMessage() {
        this.successMessage.classList.add('show');
        setTimeout(() => {
            this.successMessage.classList.remove('show');
        }, 5000);
    }

    resetForm() {
        this.form.reset();
        this.fields.quantity.value = '1';
        this.uniqueIdValid = true;
        
        Object.keys(this.fields).forEach(fieldName => {
            this.fields[fieldName].classList.remove('error', 'success', 'checking');
            document.getElementById(`${fieldName}-error`).classList.remove('show');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new EquipmentFormValidator();
});
