// Global variables
let currentUser = null;
let tickets = [];
let filteredTickets = [];

// API Base URL - Change this to your Python backend URL
const API_BASE_URL = 'http://192.168.1.17:5000/api';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
    // Periodically check for ticket updates if the user is logged in
    setInterval(checkTicketUpdates, 60000); // Check every 60 seconds
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('createTicketForm').addEventListener('submit', handleCreateTicket);
}

// Check if user is already authenticated
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (token && userData) {
        currentUser = JSON.parse(userData);
        showDashboard();
        loadTickets();
    }
}

// Check for ticket updates and show notifications
async function checkTicketUpdates() {
    if (!currentUser) return; // Only check if a user is logged in
    
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/tickets`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const newTickets = await response.json();
            
            // Check for status changes and notify the user
            if (currentUser.role === 'user') {
                newTickets.forEach(newTicket => {
                    const oldTicket = tickets.find(t => t.id === newTicket.id);
                    // Check if the ticket existed before and its status has changed
                    if (oldTicket && oldTicket.status !== newTicket.status) {
                        if (newTicket.status === 'Resolved') {
                            showAlert(`Ticket #${newTicket.id}: "${newTicket.subject}" has been resolved.`, 'success');
                        } else if (newTicket.status === 'Closed') {
                            showAlert(`Ticket #${newTicket.id}: "${newTicket.subject}" has been closed.`, 'info');
                        }
                    }
                });
            }

            tickets = newTickets; // Update the main tickets array
            filterTickets(); // Re-apply filters and re-display tickets
            updateStats();
        }
    } catch (error) {
        console.error('Error checking for ticket updates:', error);
    }
}


// Switch between login and register tabs
function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.auth-tab');
    
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        tabs[1].classList.add('active');
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userData', JSON.stringify(data.user));
            currentUser = data.user;
            showAlert('Login successful!', 'success');
            showDashboard();
            loadTickets();
        } else {
            showAlert(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

// Handle registration
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const role = document.getElementById('registerRole').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password, role })
        });

        const data = await response.json();
        
        if (response.ok) {
            showAlert('Registration successful! Please login.', 'success');
            switchTab('login');
            document.getElementById('registerForm').reset();
        } else {
            showAlert(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

// Show dashboard
function showDashboard() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
    
    document.getElementById('welcomeMessage').textContent = `Welcome back, ${currentUser.name}!`;
    document.getElementById('userRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
}

// Load tickets
async function loadTickets() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/tickets`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            tickets = await response.json();
            filteredTickets = [...tickets];
            displayTickets();
            updateStats();
        } else {
            showAlert('Failed to load tickets', 'error');
        }
    } catch (error) {
        console.error('Error loading tickets:', error);
        showAlert('Network error. Failed to load tickets.', 'error');
    }
}

// Display tickets
function displayTickets() {
    const ticketsGrid = document.getElementById('ticketsGrid');
    
    if (filteredTickets.length === 0) {
        ticketsGrid.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No tickets found.</p>';
        return;
    }

    ticketsGrid.innerHTML = filteredTickets.map(ticket => `
        <div class="ticket-card">
            <div class="ticket-header">
                <div class="ticket-id">#${ticket.id}</div>
                <div class="ticket-status status-${ticket.status.toLowerCase().replace(' ', '-')}">${ticket.status}</div>
            </div>
            <div class="ticket-title">${ticket.subject}</div>
            <div class="ticket-description">${ticket.description}</div>
            <div class="ticket-meta">
                <div>
                    <i class="fas fa-user"></i> ${ticket.created_by?.name || 'Unknown'}
                    ${ticket.assigned_to ? `<i class="fas fa-arrow-right"></i> ${ticket.assigned_to.name}` : ''}
                </div>
                <div>
                    <i class="fas fa-tag"></i> ${ticket.category}
                </div>
            </div>
            <div class="ticket-meta">
                <div><i class="fas fa-clock"></i> ${formatDate(ticket.created_at)}</div>
                <div><i class="fas fa-comments"></i> ${ticket.replies?.length || 0} replies</div>
            </div>
            <div class="ticket-actions">
                <button class="btn-sm btn-secondary" onclick="viewTicket('${ticket.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                ${currentUser.role !== 'user' ? `
                    <button class="btn-sm" onclick="updateTicketStatus('${ticket.id}', 'In Progress')" 
                            ${ticket.status === 'In Progress' ? 'disabled' : ''}>
                        <i class="fas fa-play"></i> Start
                    </button>
                    <button class="btn-sm btn-secondary" onclick="updateTicketStatus('${ticket.id}', 'Resolved')"
                            ${ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'disabled' : ''}>
                        <i class="fas fa-check"></i> Resolve
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Update statistics
function updateStats() {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'Open').length;
    const resolved = tickets.filter(t => t.status === 'Resolved').length;
    const assigned = tickets.filter(t => t.assigned_to?.id === currentUser.id).length;

    document.getElementById('totalTickets').textContent = total;
    document.getElementById('openTickets').textContent = open;
    document.getElementById('resolvedTickets').textContent = resolved;
    document.getElementById('assignedTickets').textContent = assigned;
}

// Filter tickets
function filterTickets() {
    const statusFilter = document.getElementById('statusFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    const searchFilter = document.getElementById('searchFilter').value.toLowerCase();

    filteredTickets = tickets.filter(ticket => {
        const matchesStatus = !statusFilter || ticket.status === statusFilter;
        const matchesCategory = !categoryFilter || ticket.category === categoryFilter;
        const matchesSearch = !searchFilter || 
            ticket.subject.toLowerCase().includes(searchFilter) ||
            ticket.description.toLowerCase().includes(searchFilter);

        return matchesStatus && matchesCategory && matchesSearch;
    });

    displayTickets();
}

// Open create ticket modal
function openCreateTicketModal() {
    document.getElementById('createTicketModal').classList.add('active');
}

// Handle create ticket
async function handleCreateTicket(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('subject', document.getElementById('ticketSubject').value);
    formData.append('category', document.getElementById('ticketCategory').value);
    formData.append('description', document.getElementById('ticketDescription').value);
    
    const attachment = document.getElementById('ticketAttachment').files[0];
    if (attachment) {
        formData.append('attachment', attachment);
    }

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/tickets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (response.ok) {
            showAlert('Ticket created successfully!', 'success');
            closeModal('createTicketModal');
            document.getElementById('createTicketForm').reset();
            loadTickets();
        } else {
            const error = await response.json();
            showAlert(error.message || 'Failed to create ticket', 'error');
        }
    } catch (error) {
        console.error('Error creating ticket:', error);
        showAlert('Network error. Failed to connect to the server.', 'error');
    }
}

// View ticket details
function viewTicket(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    document.getElementById('ticketDetailsTitle').innerHTML = `
        <i class="fas fa-ticket-alt"></i> Ticket #${ticket.id}
    `;

    document.getElementById('ticketDetailsContent').innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4>${ticket.subject}</h4>
                <span class="ticket-status status-${ticket.status.toLowerCase().replace(' ', '-')}">${ticket.status}</span>
            </div>
            <p style="color: #666; margin-bottom: 10px;"><strong>Category:</strong> ${ticket.category}</p>
            <p style="color: #666; margin-bottom: 10px;"><strong>Created by:</strong> ${ticket.created_by?.name}</p>
            <p style="color: #666; margin-bottom: 10px;"><strong>Created on:</strong> ${formatDate(ticket.created_at)}</p>
            ${ticket.assigned_to ? `<p style="color: #666; margin-bottom: 10px;"><strong>Assigned to:</strong> ${ticket.assigned_to.name}</p>` : ''}
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 15px 0;">
                <strong>Description:</strong><br>
                ${ticket.description}
            </div>
        </div>

        ${currentUser.role !== 'user' ? `
            <div style="margin-bottom: 20px;">
                <h5 style="margin-bottom: 10px;">Update Status:</h5>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn-sm" onclick="updateTicketStatus('${ticket.id}', 'Open')" 
                            ${ticket.status === 'Open' ? 'disabled' : ''}>Open</button>
                    <button class="btn-sm" onclick="updateTicketStatus('${ticket.id}', 'In Progress')" 
                            ${ticket.status === 'In Progress' ? 'disabled' : ''}>In Progress</button>
                    <button class="btn-sm btn-secondary" onclick="updateTicketStatus('${ticket.id}', 'Resolved')" 
                            ${ticket.status === 'Resolved' ? 'disabled' : ''}>Resolved</button>
                    <button class="btn-sm btn-danger" onclick="updateTicketStatus('${ticket.id}', 'Closed')" 
                            ${ticket.status === 'Closed' ? 'disabled' : ''}>Closed</button>
                </div>
            </div>
        ` : ''}

        <div>
            <h5 style="margin-bottom: 15px;">Replies (${ticket.replies?.length || 0})</h5>
            <div id="repliesContainer">
                ${ticket.replies?.map(reply => `
                    <div style="background: white; border: 1px solid #e1e8ff; border-radius: 10px; padding: 15px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <strong>${reply.user?.name || 'Unknown'}</strong>
                            <small style="color: #666;">${formatDate(reply.created_at)}</small>
                        </div>
                        <p>${reply.message}</p>
                    </div>
                `).join('') || '<p style="color: #666; text-align: center; padding: 20px;">No replies yet.</p>'}
            </div>
            
            <form onsubmit="addReply(event, '${ticket.id}')" style="margin-top: 20px;">
                <div class="form-group">
                    <label>Add Reply:</label>
                    <textarea id="replyMessage" rows="3" placeholder="Type your reply..." required style="width: 100%; padding: 10px; border: 2px solid #e1e8ff; border-radius: 8px;"></textarea>
                </div>
                <button type="submit" class="btn-sm btn-secondary">
                    <i class="fas fa-reply"></i> Reply
                </button>
            </form>
        </div>
    `;

    document.getElementById('ticketDetailsModal').classList.add('active');
}

// Add reply to ticket
async function addReply(e, ticketId) {
    e.preventDefault();
    const message = document.getElementById('replyMessage').value;
    
    // API call to add reply (assumed to exist)
    // Here we're just updating the local state for demonstration
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const newReply = {
        user: { name: currentUser.name, id: currentUser.id },
        message: message,
        created_at: new Date().toISOString()
    };

    if (!ticket.replies) ticket.replies = [];
    ticket.replies.push(newReply);

    document.getElementById('replyMessage').value = '';
    viewTicket(ticketId); // Refresh the modal
    displayTickets(); // Refresh the tickets display
    showAlert('Reply added successfully!', 'success');
}

// Update ticket status
async function updateTicketStatus(ticketId, newStatus) {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            showAlert('Authentication token not found. Please log in again.', 'error');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            showAlert('Ticket status updated successfully!', 'success');
            closeModal('ticketDetailsModal');
            loadTickets();
        } else {
            const error = await response.json();
            showAlert(error.message || 'Failed to update ticket status. Please try again.', 'error');
            console.error('API Error:', error);
        }
    } catch (error) {
        console.error('Error updating ticket status:', error);
        showAlert('Network error. Failed to connect to the server.', 'error');
    }
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Show alert
function showAlert(message, type) {
    // Remove existing alerts
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
    `;

    document.body.insertBefore(alert, document.body.firstChild);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Logout
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    currentUser = null;
    tickets = [];
    filteredTickets = [];
    
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('dashboard').classList.remove('active');
    
    // Reset forms
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
    switchTab('login');
    
    showAlert('Logged out successfully!', 'info');
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.classList.remove('active');
        }
    });
}

// Handle escape key to close modals
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            activeModal.classList.remove('active');
        }
    }
});
