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
        default: return 'role-user';
    }
}

let users = [];

// Function to update user counts
function updateUserCounts() {
    const normalUsers = users.filter(user => user.roles.toLowerCase() === 'user').length;
    const admins = users.filter(user => user.roles.toLowerCase() === 'admin').length;

    document.getElementById('normal-users-count').textContent = normalUsers;
    document.getElementById('admins-count').textContent = admins;
}

// Function to render users table
function renderUsersTable(usersToRender = users) {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';

    usersToRender.forEach(user => {
        const row = document.createElement('tr');
        const currentRole = user.roles.toLowerCase();
        const nextRole = currentRole === 'admin' ? 'user' : 'admin';
        
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td><span class="role-badge ${getRoleClass(user.roles)}">${user.roles}</span></td>
            <td class="date-cell">${formatDate(user.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="delete-btn" onclick="deleteUser(${user.id})">Delete User</button>
                    <button class="toggle-role-btn" onclick="toggleRole(${user.id})" data-next-role="${nextRole}">
                        Switch to ${nextRole.charAt(0).toUpperCase() + nextRole.slice(1)}
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function fetchUsers() {
    const response = await fetch('/api/admin/users');
    if (response.ok) {
        console.log('Fetched users successfully');
        console.log(response);
        users = await response.json();
        renderUsersTable(users);
        updateUserCounts();
    } else {
        console.error('Failed to fetch users');
    }
}

// Function to delete user
function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        response = fetch(`/api/admin/delete_user/${userId}`, {
            method: 'DELETE'
        });
        fetchUsers();
        updateUserCounts();
    }
}

// Function to toggle user role
function toggleRole(userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
        const currentRole = user.roles.toLowerCase();
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        user.roles = newRole;
        renderUsersTable();
        updateUserCounts();
        console.log(`User ${userId} role changed to ${newRole}`);
        
        //Optional: Add API call here to persist the change
        fetch(`/api/admin/update_role/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });
    }
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

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    fetchUsers();
    updateUserCounts();
    renderUsersTable();
});