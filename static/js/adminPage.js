// Function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Function to get role class for badge
function getRoleClass(role) {
    switch(role.toLowerCase()) {
        case 'admin': return 'role-admin';
        case 'editor': return 'role-editor';
        default: return 'role-user';
    }
}

// Function to update user counts
function updateUserCounts() {
    const normalUsers = users.filter(user => user.roles.toLowerCase() === 'user').length;
    const editors = users.filter(user => user.roles.toLowerCase() === 'editor').length;
    const admins = users.filter(user => user.roles.toLowerCase() === 'admin').length;

    document.getElementById('normal-users-count').textContent = normalUsers;
    document.getElementById('editors-count').textContent = editors;
    document.getElementById('admins-count').textContent = admins;
}

// Function to render users table
function renderUsersTable(usersToRender = users) {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';

    usersToRender.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td><span class="role-badge ${getRoleClass(user.roles)}">${user.roles}</span></td>
            <td class="date-cell">${formatDate(user.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="delete-btn" onclick="deleteUser(${user.id})">Delete User</button>
                    <div class="role-dropdown">
                        <button class="dropdown-btn" onclick="toggleDropdown(${user.id})">
                            Change Role ▼
                        </button>
                        <div class="dropdown-content" id="dropdown-${user.id}">
                            <a href="#" onclick="changeRole(${user.id}, 'user')">User</a>
                            <a href="#" onclick="changeRole(${user.id}, 'editor')">Editor</a>
                            <a href="#" onclick="changeRole(${user.id}, 'admin')">Admin</a>
                        </div>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function fetchUsers() {
    const response = await fetch('/api/users');
    if (response.ok) {
        users = await response.json();
        renderUsersTable();
        updateUserCounts();
    } else {
        console.error('Failed to fetch users');
    }
}


// Function to delete user
function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        users = users.filter(user => user.id !== userId);
        renderUsersTable();
        updateUserCounts();
        console.log(`User ${userId} deleted`);
    }
}

// Function to change user role
function changeRole(userId, newRole) {
    const user = users.find(u => u.id === userId);
    if (user) {
        user.roles = newRole;
        renderUsersTable();
        updateUserCounts();
        console.log(`User ${userId} role changed to ${newRole}`);
    }
    // Close dropdown
    document.getElementById(`dropdown-${userId}`).parentElement.classList.remove('show');
}

// Function to toggle dropdown
function toggleDropdown(userId) {
    const dropdown = document.getElementById(`dropdown-${userId}`).parentElement;
    
    // Close all other dropdowns
    document.querySelectorAll('.role-dropdown.show').forEach(d => {
        if (d !== dropdown) d.classList.remove('show');
    });
    
    dropdown.classList.toggle('show');
}

// Search functionality
document.getElementById('search-input').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        user.roles.toLowerCase().includes(searchTerm)
    );
    renderUsersTable(filteredUsers);
});

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.matches('.dropdown-btn')) {
        document.querySelectorAll('.role-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }
});

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    updateUserCounts();
    renderUsersTable();
});