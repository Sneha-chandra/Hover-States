// Global variables
let currentUser = null;
let tickets = [];
let filteredTickets = [];

// API Base URL - Change this to your Python backend URL
const API_BASE_URL = 'http://localhost:5000/api';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
    // Periodically check for ticket updates if the user is logged in
    setInterval(checkTicketUpdates, 60000); // Check every 60 seconds
});

// Setup event listeners
function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const createTicketForm = document.getElementById('createTicketForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    if (createTicketForm) {
        createTicketForm.addEventListener('submit', handleCreateTicket);
    }
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
    
    if (!loginForm || !registerForm || !tabs.length) return;
    
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
            // Check if it's a database connection error
            if (data.message && data.message.includes('Database connection')) {
                showAlert('Database connection failed. Please check your MongoDB installation or configuration.', 'error');
            } else {
                showAlert(data.message || 'Login failed', 'error');
            }
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
            // Check if it's a database connection error
            if (data.message && data.message.includes('Database connection')) {
                showAlert('Database connection failed. Please check your MongoDB installation or configuration.', 'error');
            } else {
                showAlert(data.message || 'Registration failed', 'error');
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

// Show dashboard
function showDashboard() {
    const authSection = document.getElementById('authSection');
    const dashboard = document.getElementById('dashboard');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const userRole = document.getElementById('userRole');
    
    if (authSection) authSection.style.display = 'none';
    if (dashboard) dashboard.classList.add('active');
    
    if (welcomeMessage) welcomeMessage.textContent = `Welcome back, ${currentUser.name}!`;
    if (userRole) userRole.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
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

        const data = await response.json();
        
        if (response.ok) {
            tickets = data;
            filteredTickets = [...tickets];
            displayTickets();
            updateStats();
        } else {
            // Check if it's a database connection error
            if (data.message && data.message.includes('Database connection')) {
                showAlert('Database connection failed. Please check your MongoDB installation or configuration.', 'error');
            } else {
                showAlert(data.message || 'Failed to load tickets', 'error');
            }
        }
    } catch (error) {
        console.error('Error loading tickets:', error);
        showAlert('Network error. Failed to load tickets.', 'error');
    }
}

// Display tickets
function displayTickets() {
    const ticketsGrid = document.getElementById('ticketsGrid');
    
    if (!ticketsGrid) return;
    
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
                ${currentUser && currentUser.role !== 'user' ? `
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
    let assigned = 0;
    
    if (currentUser) {
        assigned = tickets.filter(t => t.assigned_to?.id === currentUser.id).length;
    }

    const totalTicketsEl = document.getElementById('totalTickets');
    const openTicketsEl = document.getElementById('openTickets');
    const resolvedTicketsEl = document.getElementById('resolvedTickets');
    const assignedTicketsEl = document.getElementById('assignedTickets');

    if (totalTicketsEl) totalTicketsEl.textContent = total;
    if (openTicketsEl) openTicketsEl.textContent = open;
    if (resolvedTicketsEl) resolvedTicketsEl.textContent = resolved;
    if (assignedTicketsEl) assignedTicketsEl.textContent = assigned;
}

// Filter tickets
function filterTickets() {
    const statusFilter = document.getElementById('statusFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const searchFilter = document.getElementById('searchFilter');
    
    if (!statusFilter || !categoryFilter || !searchFilter) return;

    const statusValue = statusFilter.value;
    const categoryValue = categoryFilter.value;
    const searchValue = searchFilter.value.toLowerCase();

    filteredTickets = tickets.filter(ticket => {
        const matchesStatus = !statusValue || ticket.status === statusValue;
        const matchesCategory = !categoryValue || ticket.category === categoryValue;
        const matchesSearch = !searchValue || 
            (ticket.subject && ticket.subject.toLowerCase().includes(searchValue)) ||
            (ticket.description && ticket.description.toLowerCase().includes(searchValue));

        return matchesStatus && matchesCategory && matchesSearch;
    });

    displayTickets();
}

// Open create ticket modal
function openCreateTicketModal() {
    const modal = document.getElementById('createTicketModal');
    if (modal) modal.classList.add('active');
}

// Handle create ticket
async function handleCreateTicket(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const subject = document.getElementById('ticketSubject');
    const category = document.getElementById('ticketCategory');
    const description = document.getElementById('ticketDescription');
    const attachment = document.getElementById('ticketAttachment');
    
    if (subject) formData.append('subject', subject.value);
    if (category) formData.append('category', category.value);
    if (description) formData.append('description', description.value);
    
    if (attachment && attachment.files[0]) {
        formData.append('attachment', attachment.files[0]);
    }

    // Show loading state
    showAlert('Creating ticket...', 'info');

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/tickets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('Ticket created successfully!', 'success');
            closeModal('createTicketModal');
            const form = document.getElementById('createTicketForm');
            if (form) form.reset();
            loadTickets();
        } else {
            // Check if it's a database connection error
            if (data.message && data.message.includes('Database connection')) {
                showAlert('Database connection failed. Please check your MongoDB installation or configuration.', 'error');
            } else {
                showAlert(data.message || 'Failed to create ticket', 'error');
            }
        }
    } catch (error) {
        console.error('Error creating ticket:', error);
        showAlert('Network error. Failed to connect to the server.', 'error');
    }
}

// View ticket details
async function viewTicket(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const ticketDetailsTitle = document.getElementById('ticketDetailsTitle');
    const ticketDetailsContent = document.getElementById('ticketDetailsContent');
    
    if (ticketDetailsTitle) {
        ticketDetailsTitle.innerHTML = `
            <i class="fas fa-ticket-alt"></i> Ticket #${ticket.id}
        `;
    }

    if (ticketDetailsContent) {
        ticketDetailsContent.innerHTML = `
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

            ${currentUser && currentUser.role !== 'user' ? `
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
                        <textarea id="replyMessage-${ticket.id}" rows="3" placeholder="Type your reply..." required style="width: 100%; padding: 10px; border: 2px solid #e1e8ff; border-radius: 8px;"></textarea>
                    </div>
                    <button type="submit" class="btn-sm btn-secondary">
                        <i class="fas fa-reply"></i> Reply
                    </button>
                </form>
            </div>
        `;
    }

    const modal = document.getElementById('ticketDetailsModal');
    if (modal) modal.classList.add('active');
}

// Add reply to ticket
async function addReply(e, ticketId) {
    e.preventDefault();
    const replyMessage = document.getElementById(`replyMessage-${ticketId}`);
    
    if (!replyMessage) return;
    
    const message = replyMessage.value;
    
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            showAlert('Authentication token not found. Please log in again.', 'error');
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/reply`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Reply added successfully!', 'success');
            replyMessage.value = '';
            loadTickets(); // Reload tickets to show the new reply
        } else {
            // Check if it's a database connection error
            if (data.message && data.message.includes('Database connection')) {
                showAlert('Database connection failed. Please check your MongoDB installation or configuration.', 'error');
            } else {
                showAlert(data.message || 'Failed to add reply', 'error');
            }
        }
    } catch (error) {
        console.error('Error adding reply:', error);
        showAlert('Network error. Failed to connect to the server.', 'error');
    }
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
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert(`Ticket status updated to ${newStatus}`, 'success');
            loadTickets(); // Reload tickets to show the updated status
        } else {
            // Check if it's a database connection error
            if (data.message && data.message.includes('Database connection')) {
                showAlert('Database connection failed. Please check your MongoDB installation or configuration.', 'error');
            } else {
                showAlert(data.message || 'Failed to update ticket status', 'error');
            }
        }
    } catch (error) {
        console.error('Error updating ticket status:', error);
        showAlert('Network error. Failed to connect to the server.', 'error');
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// Show alert message
function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="alert-close">&times;</button>
    `;
    
    alertContainer.appendChild(alert);
    
    // Remove alert after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

// Format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Logout
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    currentUser = null;
    tickets = [];
    filteredTickets = [];
    
    const dashboard = document.getElementById('dashboard');
    const authSection = document.getElementById('authSection');
    
    if (dashboard) dashboard.classList.remove('active');
    if (authSection) authSection.style.display = 'block';
    
    // Reset forms
    const forms = document.querySelectorAll('form');
    forms.forEach(form => form.reset());
    
    // Clear ticket display
    const ticketsGrid = document.getElementById('ticketsGrid');
    if (ticketsGrid) ticketsGrid.innerHTML = '';
    
    // Reset filters
    const statusFilter = document.getElementById('statusFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const searchFilter = document.getElementById('searchFilter');
    
    if (statusFilter) statusFilter.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (searchFilter) searchFilter.value = '';
}
