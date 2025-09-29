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

let users = [];

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
                        <button class="dropdown-btn" data-id="${user.id}">
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
    attachDropdownListeners();
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
    const dropdownWrapper = document.getElementById(`dropdown-${userId}`).parentElement;
    if (dropdownWrapper) dropdownWrapper.classList.remove('show');
}


function attachDropdownListeners() {
    document.querySelectorAll('.dropdown-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent doc click from closing immediately
            e.preventDefault();
            const userId = btn.getAttribute('data-id');
            const dropdownWrapper = document.querySelector(`#dropdown-${userId}`).parentElement;
    
    
            // Close all other dropdowns first
            document.querySelectorAll('.role-dropdown.show').forEach(d => {
                if (d !== dropdownWrapper) d.classList.remove('show');
            });
            
            // Toggle the current dropdown
            dropdownWrapper.classList.toggle('show');
        });
    });
}

// FIXED: Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    // Check if the click is outside of any dropdown
    if (!e.target.closest('.role-dropdown')) {
        document.querySelectorAll('.role-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }
});

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