const csrfToken = document.querySelector('input[name="csrf_token"]').value;

async function deleteRow(id) {
    try {
        const response = await fetch(`/api/delete/${id}`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': csrfToken
            }
        });

        if (response.ok) {
            window.location.href = '/dashboard';
        } else {
            alert('Failed to delete equipment.');
        }
    } catch (err) {
        console.error('Error deleting equipment:', err);
        alert('Something went wrong.');
    }
}


function getcal_statusBadge(cal_status, cal_date) {
    const cal_statusMap = {
        'OK':       { class: 'cal_status-active',  text: 'OK' },
        'Due Soon': { class: 'cal_status-warning', text: 'Due Soon' },
        'Over Due': { class: 'cal_status-expired', text: 'Over Due' },
        'Unknown':  { class: 'cal_status-unknown', text: 'Unknown' }
    };
    const cal_statusInfo = cal_statusMap[cal_status] || cal_statusMap['Unknown'];
    return `<span class="cal_status-badge ${cal_statusInfo.class}">${cal_date}</span>`;
}

function getmnt_statusBadge(mnt_status, mnt_date) {
    const mnt_statusMap = {
        'OK':       { class: 'mnt_status-active',  text: 'OK' },
        'Due Soon': { class: 'mnt_status-warning', text: 'Due Soon' },
        'Over Due': { class: 'mnt_status-expired', text: 'Over Due' },
        'Unknown':  { class: 'mnt_status-unknown', text: 'Unknown' }
    };
    const mnt_statusInfo = mnt_statusMap[mnt_status] || mnt_statusMap['Unknown'];
    return `<span class="mnt_status-badge ${mnt_statusInfo.class}">${mnt_date}</span>`;
}

function openModal() {
    document.getElementById('id01').style.display='block';
    var modal = document.getElementById('id01');
    var cancelBtn = modal.querySelector('.cancelbtn');
   window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
    cancelBtn.onclick = function() {
        modal.style.display = "none";
    }
}

function openMaintenanceModal(){
    document.getElementById('id02').style.display='block';
    var modal = document.getElementById('id02');
    var cancelBtn = modal.querySelector('.cancelbtn');
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
    cancelBtn.onclick = function() {
        modal.style.display = "none";
    }
}

function openCalibrationModal(){
    document.getElementById('id03').style.display='block';
    var modal = document.getElementById('id03');
    var cancelBtn = modal.querySelector('.cancelbtn');
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
    cancelBtn.onclick = function() {
        modal.style.display = "none";
    }
}

async function markMaintained(equipmentId) {
    const response = await fetch(`/api/maintain/${equipmentId}`, {
        method: 'PUT',
        headers: {
            'X-CSRFToken': csrfToken
        }
    });
    if (response.ok) {
        window.location.reload();
    } else {
        alert('Failed to mark maintenance as completed.');
    }
}

async function markCalibrated(equipmentId) {
    const response = await fetch(`/api/calibrate/${equipmentId}`, {
        method: 'PUT',
        headers: {
            'X-CSRFToken': csrfToken
        }
    });
    if (response.ok) {
        window.location.reload();
    } else{
        alert("Failed to mark calibration as completed");
    }
}


document.addEventListener('DOMContentLoaded', function() {
    // renderTable();
    const deleteButtons = document.querySelectorAll('.delete-button');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            openModal();
            const confirmBtn = document.querySelector('.confirmbtn');
            confirmBtn.onclick = function() {
                deleteRow(id);
            }
        });
    });
    const equipmentEl = document.getElementById("equipment-data");
    const mnt_Status = equipmentEl.dataset.mnt;
    const mnt_Date   = equipmentEl.dataset.mntDate;
    const cal_Status = equipmentEl.dataset.cal;
    const cal_Date   = equipmentEl.dataset.calDate;

    // Apply combined status+date badges
    document.getElementById("mnt_status_display").innerHTML = getmnt_statusBadge(mnt_Status, mnt_Date);
    document.getElementById("cal_status_display").innerHTML = getcal_statusBadge(cal_Status, cal_Date);

    // Also update header badge
    document.getElementById("cal_status_badge").innerHTML = getcal_statusBadge(cal_Status, cal_Date);
});