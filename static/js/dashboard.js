// Create table row
function createTableRow(item, index) {
    return `
        <tr class="fade-in">
            <td class="sn-column">${String(index + 1).padStart(2, '0')}</td>
            <td class="name-column">${item.name}</td>
            <td class="location-column">${item.location}</td>
            <td class="date-column">${formatDate(item.next_calibration_date)}</td>
            <td class="status-column">${getStatusBadge(item.status)}</td>
            <td class="action-column">
                <button class="action-button" onclick="openDetails(${item.id})">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                    <span>View</span>
                </button>
            </td>
        </tr>
    `;
}

function getStatusBadge(status) {
    const statusMap = {
        'OK': { class: 'status-active', text: 'OK' },
        'Due Soon': { class: 'status-warning', text: 'Due Soon' },
        'Over Due': { class: 'status-expired', text: 'Over Due' },
        'Unknown': { class: 'status-unknown', text: 'Unknown' }
    };
    const statusInfo = statusMap[status] || statusMap['Unknown'];
    return `<span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>`;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
        day: '2-digit', month: 'short', year: 'numeric' 
    });
}


// Empty state HTML
function createEmptyState() {
    return `
        <div class="empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
            </svg>
            <h3>No Equipment Found</h3>
            <p>Click "Add Row" to add new equipment to the table.</p>
        </div>
    `;
}

// Render table
function renderTable() {
    fetch('/api/equipments')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.getElementById('table-body');
            const tableData = data;
            // Handle empty state
            if (tableData.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6">${createEmptyState()}</td>
                    </tr>
                `;
                return;
            }

            // Render table
            tableBody.innerHTML = tableData
                                    .map((item, index) => createTableRow(item, index))
                                    .join('');
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}



document.addEventListener('DOMContentLoaded', function() {
    renderTable();
});