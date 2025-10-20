class UpdateEquipmentFormValidator {
    constructor() {
        this.form = document.getElementById('equipmentForm');
        const equipmentId = this.form.dataset.id;
        this.equipmentId = equipmentId;
        this.fields = {
            name: this.form.querySelector('input[name="name"]'),
            manufacturer: this.form.querySelector('input[name="manufacturer"]'),
            model: this.form.querySelector('input[name="model"]'),
            serial_number: this.form.querySelector('input[name="serial_number"]'),
            new_id_number: this.form.querySelector('input[name="new_id_number"]'),
            branch: this.form.querySelector('select[name="branch"]'),
            unit_id: this.form.querySelector('select[name="unit_id"]'),
            calibration_date: this.form.querySelector('input[name="calibration_date"]'),
            maintenance_date: this.form.querySelector('input[name="maintenance_date"]'),
            calibration_frequency: this.form.querySelector('select[name="calibration_frequency"]'),
            maintenance_frequency: this.form.querySelector('select[name="maintenance_frequency"]'),
            quantity: this.form.querySelector('input[name="quantity"]'),
            description: this.form.querySelector('textarea[name="description"]')
        };
        this.csrfToken = document.querySelector('input[name="csrf_token"]').value;
        this.submitBtn = this.form.querySelector('.submit-btn');
        this.successMessage = document.getElementById('success-message');
        this.validationTimeouts = {};
        this.uniqueIdValid = true;
        

        this.parametersContainer = document.getElementById('parametersContainer');
        this.parametersEmpty = document.getElementById('parametersEmpty');
        this.addParameterBtn = document.getElementById('addParameterBtn');
        const preloadedItems = this.parametersContainer.querySelectorAll('.parameter-item');
        this.parameterCount = preloadedItems.length;

        this.parameters = [];

        this.init();
    }

    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.addParameterBtn.addEventListener('click', this.addParameter.bind(this));
        this.fields.branch.addEventListener('change', this.handleBranchChange.bind(this));
        
        this.handleBranchChange();
        
        Object.keys(this.fields).forEach(fieldName => {
            const field = this.fields[fieldName];
            field.addEventListener('blur', () => this.validateField(fieldName));
            field.addEventListener('input', () => {
                this.clearError(fieldName);
                if (fieldName === 'new_id_number') {
                    clearTimeout(this.validationTimeouts[fieldName]);
                    this.validationTimeouts[fieldName] = setTimeout(() => {
                        this.validateField(fieldName);
                    }, 500);
                }
            });
        });
        const parameterItems = this.parametersContainer.querySelectorAll('.parameter-item');
        parameterItems.forEach(item => {
            const nameInput = item.querySelector('.param-name');
            const valueInput = item.querySelector('.param-value');
            if (nameInput.value.trim() || valueInput.value.trim()) {
                this.parameters.push({
                    name: nameInput.value.trim(),
                    value: valueInput.value.trim()
                });
            }

            // Make sure changes update `this.parameters`
            nameInput.addEventListener('input', () => this.updateParametersData());
            valueInput.addEventListener('input', () => this.updateParametersData());
        });
    }

    handleBranchChange() {
        const selectedBranchId = this.fields.branch.value;
        const unitSelect = this.fields.unit_id;
        const unitOptions = unitSelect.querySelectorAll('option');

        // Show/hide unit options based on the selected branch
        unitOptions.forEach(option => {
            // Show the option if its 'data-branch' matches or if it's a placeholder
            if (option.dataset.branch === selectedBranchId || !option.value) {
                option.style.display = 'block';
            } else {
                // Hide the option but keep it in the DOM
                option.style.display = 'none';
            }
        });

        // If the currently selected unit is now hidden, reset the dropdown
        if (unitSelect.options[unitSelect.selectedIndex]?.style.display === 'none') {
            unitSelect.value = '';
        }
    }

     addParameter() {
        this.parameterCount++;
        const parameterItem = document.createElement('div');
        parameterItem.className = 'parameter-item';
        parameterItem.dataset.parameterId = this.parameterCount;
        
        parameterItem.innerHTML = `
            <input type="text" placeholder="Parameter Name (e.g., Voltage, Temperature)" class="param-name" data-param-id="${this.parameterCount}">
            <input type="text" placeholder="Value (e.g., 220V, -40°C to +85°C)" class="param-value" data-param-id="${this.parameterCount}">
            <button type="button" class="remove-parameter-btn" onclick="update_equipment_form_validator.removeParameter(${this.parameterCount})">×</button>
        `;
        
        this.parametersContainer.appendChild(parameterItem);
        this.parametersEmpty.style.display = 'none';
        
        // Add event listeners for the new parameter inputs
        const nameInput = parameterItem.querySelector('.param-name');
        const valueInput = parameterItem.querySelector('.param-value');
        
        nameInput.addEventListener('input', () => this.updateParametersData());
        valueInput.addEventListener('input', () => this.updateParametersData());
        
        // Focus on the name input
        nameInput.focus();
        
        this.updateParametersData();
    }

    removeParameter(parameterId) {
        // Fix: Use the correct data attribute selector
        const parameterItem = document.querySelector(`[data-parameter-id="${parameterId}"]`);
        if (parameterItem) {
            parameterItem.remove();
            this.updateParametersData();
            
            // Show empty message if no parameters left
            const remainingItems = this.parametersContainer.querySelectorAll('.parameter-item');
            if (remainingItems.length === 0) {
                this.parametersEmpty.style.display = 'block';
            }
        }
    }

    updateParametersData() {
        this.parameters = [];
        const parameterItems = this.parametersContainer.querySelectorAll('.parameter-item');
        
        parameterItems.forEach(item => {
            const nameInput = item.querySelector('.param-name');
            const valueInput = item.querySelector('.param-value');
            
            if (nameInput.value.trim() || valueInput.value.trim()) {
                this.parameters.push({
                    name: nameInput.value.trim(),
                    value: valueInput.value.trim()
                });
            }
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
        const response = await fetch(`/api/check-id-uniqueness?id=${encodeURIComponent(idValue)}&exclude=${this.equipmentId}`);
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

    async validateForm() {
        let isFormValid = true;
        
        if (!await this.validateField('name')) isFormValid = false;
        if (!await this.validateField('calibration_frequency')) isFormValid = false;
        if (!await this.validateField('maintenance_frequency')) isFormValid = false;
        if (!await this.validateField('quantity')) isFormValid = false;

        for (const fieldName of Object.keys(this.fields)) {
            if (!['name', 'quantity', 'calibration_frequency', 'maintenance_frequency'].includes(fieldName)) {
                if (this.fields[fieldName].value.trim()) {
                    if (!await this.validateField(fieldName)) {
                        isFormValid = false;
                    }
                }
            }
        }

        return isFormValid;
    }

    async handleSubmit(e) {
        e.preventDefault();
        this.successMessage.classList.remove('show');

        this.updateParametersData();

        const isFormValid = await this.validateForm();

        // Await uniqueness check if ID provided
        let idValid = true;
        const newIdValue = this.fields.new_id_number.value.trim();
        if (newIdValue) {
            idValid = await this.checkIdUniqueness(newIdValue, 'new_id_number');
        }

        if (isFormValid && idValid) {
            this.submitBtn.disabled = true;
            this.submitBtn.textContent = 'Updating Equipment...';

            const formData = {}
            Object.keys(this.fields).forEach(fieldName => {
                if (fieldName !== 'branch') {
                    formData[fieldName] = this.fields[fieldName].value.trim();
                }
            });
            // Convert string numbers to actual integers
            formData.unit_id = parseInt(formData.unit_id, 10);
            formData.quantity = parseInt(formData.quantity, 10);
            
            // Handle case where unit might not be selected
            if (isNaN(formData.unit_id)) {
                formData.unit_id = null;
            }
            formData.parameters = this.parameters;

            fetch(`/api/updateEquipment/${this.equipmentId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify(formData)
            })
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(new_equipment => {
                this.showSuccessMessage();
            })
            .catch(error => {
                console.error('Error adding equipment:', error);
                alert('An error occurred while adding the equipment. Please try again.');
            })
            .finally(() => {
                this.submitBtn.disabled = false;
                this.submitBtn.textContent = 'Update Equipment';
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

    // resetForm() {
    //     this.form.reset();
    //     this.fields.quantity.value = '1';
    //     this.uniqueIdValid = true;
        
    //     Object.keys(this.fields).forEach(fieldName => {
    //         this.fields[fieldName].classList.remove('error', 'success', 'checking');
    //         document.getElementById(`${fieldName}-error`).classList.remove('show');
    //     });
    // }
}

let update_equipment_form_validator;

document.addEventListener('DOMContentLoaded', () => {
    update_equipment_form_validator = new UpdateEquipmentFormValidator();
});
