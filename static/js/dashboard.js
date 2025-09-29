// Global variable to store all equipment data
let allEquipmentData = [];

// Create table row
function createTableRow(item, index) {
    return `
        <tr class="fade-in">
            <td class="sn-column">${String(index + 1).padStart(2, '0')}</td>
            <td class="name-column">${item.name}</td>
            <td class="location-column">${item.location}</td>
            <td class="date-column">${formatDate(item.next_calibration_date)}</td>
            <td class="cal_status-column">${getcal_statusBadge(item.cal_status)}</td>
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

function openDetails(equipmentId) {
    window.location.href = `/equipments/${equipmentId}`;
}

function getcal_statusBadge(cal_status) {
    const cal_statusMap = {
        'OK': { class: 'cal_status-active', text: 'OK' },
        'Due Soon': { class: 'cal_status-warning', text: 'Due Soon' },
        'Over Due': { class: 'cal_status-expired', text: 'Over Due' },
        'Unknown': { class: 'cal_status-unknown', text: 'Unknown' }
    };
    const cal_statusInfo = cal_statusMap[cal_status] || cal_statusMap['Unknown'];
    return `<span class="cal_status-badge ${cal_statusInfo.class}">${cal_statusInfo.text}</span>`;
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
            <p>Try adjusting your search or filter criteria.</p>
        </div>
    `;
}

// Filter and search function
function filterAndSearchEquipment() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    const locationFilter = document.getElementById('location-filter').value;

    let filteredData = allEquipmentData;

    // Apply search filter
    if (searchTerm) {
        filteredData = filteredData.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            item.location.toLowerCase().includes(searchTerm) ||
            item.serial_number.toLowerCase().includes(searchTerm)
        );
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
        filteredData = filteredData.filter(item => item.cal_status === statusFilter);
    }

    // Apply location filter
    if (locationFilter && locationFilter !== 'all') {
        filteredData = filteredData.filter(item => item.location === locationFilter);
    }

    // Update the table with filtered data
    updateTable(filteredData);
    
    // Update results count
    updateResultsCount(filteredData.length, allEquipmentData.length);
}

// Update table with filtered data
function updateTable(data) {
    const tableBody = document.getElementById('table-body');
    
    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">${createEmptyState()}</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = data
        .map((item, index) => createTableRow(item, index))
        .join('');
}

// Update results count
function updateResultsCount(filtered, total) {
    const countElement = document.getElementById('results-count');
    if (countElement) {
        countElement.textContent = `Showing ${filtered} of ${total} equipment`;
    }
}

// Populate location filter dropdown
function populateLocationFilter() {
    const locations = [...new Set(allEquipmentData.map(item => item.location))].sort();
    const locationFilter = document.getElementById('location-filter');
    
    // Clear existing options except "All Locations"
    locationFilter.innerHTML = '<option value="all">All Locations</option>';
    
    // Add location options
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });
}

// Clear all filters
function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('status-filter').value = 'all';
    document.getElementById('location-filter').value = 'all';
    filterAndSearchEquipment();
}

// Render table
function renderTable() {
    fetch('/api/equipments')
        .then(response => response.json())
        .then(data => {
            allEquipmentData = data;
            populateLocationFilter();
            updateTable(allEquipmentData);
            updateResultsCount(allEquipmentData.length, allEquipmentData.length);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            const tableBody = document.getElementById('table-body');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #e74c3c;">
                        Error loading equipment data. Please refresh the page.
                    </td>
                </tr>
            `;
        });
}

document.addEventListener('DOMContentLoaded', function() {
    renderTable();
    
    // Add event listeners for search and filters
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    const locationFilter = document.getElementById('location-filter');
    const clearBtn = document.getElementById('clear-filters');

    if (searchInput) {
        searchInput.addEventListener('input', filterAndSearchEquipment);
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', filterAndSearchEquipment);
    }

    if (locationFilter) {
        locationFilter.addEventListener('change', filterAndSearchEquipment);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearFilters);
    }
});