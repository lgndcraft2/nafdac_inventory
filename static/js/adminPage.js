// --- Global variables ---
let allUsers = [];
let allUnits = [];
let selectedUserId = null;
const csrfToken = document.querySelector('input[name="csrf_token"]').value;

// --- Helper Functions ---
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function getRoleClass(role) {
    switch (role.toLowerCase()) {
        case 'admin': return 'role-admin';
        case 'hou': return 'role-hou';
        default: return 'role-user';
    }
}

// --- Data Fetching ---
async function fetchData() {
    try {
        const [usersResponse, unitsResponse] = await Promise.all([
            fetch('/api/admin/users'),
            fetch('/api/units')
        ]);
        if (!usersResponse.ok || !unitsResponse.ok) throw new Error('Failed to fetch data.');
        
        allUsers = await usersResponse.json();
        allUnits = await unitsResponse.json();
        
        updateUserCounts();
        renderUsersTable();
    } catch (error) {
        console.error("Fetch Error:", error);
        // Display an error message to the user
    }
}

// --- UI Rendering ---
function updateUserCounts() {
    const userCount = allUsers.filter(u => u.roles === 'user').length;
    const adminCount = allUsers.filter(u => u.roles === 'admin').length;
    const houCount = allUsers.filter(u => u.roles === 'hou').length;
    
    document.getElementById('normal-users-count').textContent = userCount + houCount; // HOUs are also users
    document.getElementById('admins-count').textContent = adminCount;
}

function renderUsersTable(usersToRender = allUsers) {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = ''; // Clear existing rows

    usersToRender.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td><span class="role-badge ${getRoleClass(user.roles)}">${user.roles.toUpperCase()}</span></td>
            <td class="date-cell">${formatDate(user.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="change-role-btn" onclick="openRoleModal(${user.id})">Change Role</button>
                    <button class="delete-btn" onclick="deleteUser(${user.id})">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// --- Modal Logic ---
const modal = document.getElementById('role-modal');
const roleSelect = document.getElementById('role-select');
const unitSelectGroup = document.getElementById('unit-select-group');
const unitSelect = document.getElementById('unit-select');

function openRoleModal(userId) {
    selectedUserId = userId;
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('modal-username').textContent = user.username;
    roleSelect.value = user.roles;
    
    // Show/hide unit dropdown based on selected role
    unitSelectGroup.style.display = user.roles === 'hou' ? 'block' : 'none';

    // Populate the unit dropdown with only units that are available or assigned to this user
    populateUnitSelect(user.id);

    modal.style.display = 'flex';
}

function populateUnitSelect(currentUserId) {
    unitSelect.innerHTML = '<option value="">-- Select a Unit --</option>';
    
    const currentUserUnit = allUnits.find(u => u.hou_id === currentUserId);
    
    allUnits.forEach(unit => {
        // A unit is available if it has no HOU, OR if the HOU is the current user
        const isAvailable = unit.hou_id === null || unit.hou_id === currentUserId;
        if (isAvailable) {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = `${unit.name} (${unit.branch_name})`;
            
            // Pre-select the unit if it's the one this user is HOU of
            if (currentUserUnit && currentUserUnit.id === unit.id) {
                option.selected = true;
            }
            
            unitSelect.appendChild(option);
        }
    });
}

function closeModal() {
    modal.style.display = 'none';
    selectedUserId = null;
}

// --- API Actions ---
async function deleteUser(userId) {
    if (confirm(`Are you sure you want to delete user ID ${userId}? This cannot be undone.`)) {
        try {
            const response = await fetch(`/api/admin/delete_user/${userId}`, { method: 'DELETE', headers: { 'X-CSRFToken': csrfToken } });
            if (!response.ok) throw new Error('Server responded with an error.');
            await fetchData(); // Refresh data from server
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Failed to delete user.");
        }
    }
}

async function saveRoleChange() {
    if (!selectedUserId) return;

    const newRole = roleSelect.value;
    const unitId = unitSelect.value;

    if (newRole === 'hou' && !unitId) {
        alert('Please select a unit to assign the HOU to.');
        return;
    }

    try {
        const response = await fetch(`/api/admin/update_role/${selectedUserId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ role: newRole, unit_id: unitId })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to update role.');
        }
        
        closeModal();
        await fetchData(); // Refresh data from server
        
    } catch (error) {
        console.error("Update Role Error:", error);
        alert(`Error: ${error.message}`);
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    // Modal event listeners
    modal.querySelector('.close-button').addEventListener('click', closeModal);
    modal.querySelector('.cancel').addEventListener('click', closeModal);
    document.getElementById('save-role-button').addEventListener('click', saveRoleChange);
    
    roleSelect.addEventListener('change', () => {
        unitSelectGroup.style.display = roleSelect.value === 'hou' ? 'block' : 'none';
    });

    // Search functionality
    document.getElementById('search-input').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = allUsers.filter(user =>
            user.username.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            user.roles.toLowerCase().includes(searchTerm)
        );
        renderUsersTable(filteredUsers);
    });
});