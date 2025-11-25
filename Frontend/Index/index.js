//Load authorising variables
const API_URL = `/api`;
let currentUserRole = null;
let currentUser = null;
let authChecked = false;

//Check whether the user is authorised or not
window.addEventListener('DOMContentLoaded', () => {
    if(!authChecked){
        checkAuth();
    }
});

//Configuring variables to be used to blur the maincontent whenever sidebar is active.
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');
const overlay = document.getElementById('overlay');

//Provides the blurring/unblurring effect to the target containers
function toggleMenu(){
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    mainContent.classList.toggle('blurred');
    menuToggle.classList.toggle('active');
}


//Listen for user clicking on the button or on the overlay container.
menuToggle.addEventListener('click', toggleMenu);
overlay.addEventListener('click', toggleMenu);

document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && sidebar.classList.contains('active')){
        toggleMenu();
    }
});
document.addEventListener('click', (e) =>{
    if(sidebar.classList.contains('active') && 
        !sidebar.contains(e.target) &&
        !menuToggle.contains(e.target)
    ){
        toggleMenu();
    }
});

//Function targets the links and determines whether the user is on their pages or not.
function setActiveMenuItem(){
    const currentPath = window.location.pathname;
    const menuLinks = document.querySelectorAll('.menu-item');

    menuLinks.forEach(link => {
        link.classList.remove('active');
        const linkPath = link.getAttribute('href');
        if(currentPath.includes(linkPath.replace('/',''))){
            link.classList.add('active');
        }
    });
}

setActiveMenuItem();

//Function prevents the browser's default behaviour of reloading if the user is already in the target webpage.
sidebar.addEventListener('click', (e) =>{
    const menuItem = e.target.closest('.menu-item');
    if(menuItem){
        const linkPath = menuItem.getAttribute('href');
        const currentPath = window.location.pathname;
        
        const isCurrentPage = (linkPath.toLowerCase() === currentPath.toLowerCase());
        if(isCurrentPage){
            e.preventDefault();
            mainContent.classList.remove('blurred');
            setTimeout(() =>{
                if(sidebar.classList.contains('active')){
                    mainContent.classList.add('blurred');
                }
            }, 2000);
        }
    }
});


//Check authorisation for user and provide way forward if user is valid or not.
async function checkAuth(){
    //If we already know the user is logged in during this browser tab session, skips fetch.
    const cached = sessionStorage.getItem('currentUser');
    if(cached){
        const user = JSON.parse(cached);
        authChecked = true;
        document.body.classList.remove('login-active');
        document.getElementById('loginPage')?.classList.add('hidden');
        document.getElementById('loginPage')?.classList.remove('active');
    }

    //First time in this tab.
    try{
        const response = await fetch(`${API_URL}/check-auth`,{
            credentials: 'include'
        });
        if(response.ok){
            const data = await response.json();
            currentUser = data.user;
            currentUserRole = currentUser.role || null;
            sessionStorage.setItem('currentUser', JSON.stringify(data.user));
            authChecked = true;

            document.body.classList.remove('login-active');
            document.getElementById('loginPage').classList.add('hidden');
            document.getElementById('loginPage').classList.remove('active');
            showDashboard(data.user);
        }else{
            showLoginOverlay();
        }
    }
    catch(error){
        console.log('Not authenticated.');
        sessionStorage.removeItem('currentUser');
        currentUser = null;
        currentUserRole = null;
        showLoginOverlay();
    }
}

//Call the login container for the user to provide their credentials
function showLoginOverlay(){
    document.body.classList.add('login-active');
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('loginPage').classList.add('active');
    //document.getElementById('dahsboardPage').classList.remove('active');
}

//Hide the login container after credentials' validation
function hideLoginOverlay(){
    document.body.classList.remove('login-active');
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('loginPage').style.display = 'none';
}


//Handle login
async function handleLogin(){
    //Variables to handle credentials provided by the users.
    const username = document.getElementById('loginUsername');
    const password = document.getElementById('loginPassword');
    const errorDiv = document.getElementById('loginError');
    const loadingDiv = document.getElementById('loginLoading');
    const loginBtn = document.getElementById('loginBtn'); 

    errorDiv.classList.remove('show');
    errorDiv.textContent = '';

    //Handle empty username and password fields.
    if(!username || !password){
        errorDiv.textContent = 'Please enter username and password.';
        errorDiv.classList.add('show');
        return;
    }

    loginBtn.disabled = true;
    loadingDiv.style.display = 'block';
    //Making the login request to the server.
    try{
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                username: username.value.trim(), 
                password: password.value})
        });
        const data = await response.json();

        if(response.ok){
            hideLoginOverlay();
            showDashboard(data.user);
        }
        else{
            errorDiv.textContent = data.error || 'Login failed';
            errorDiv.classList.add('show');
        }
    }
    catch(error){
        errorDiv.textContent = 'Connection error. Make sure the server is running.';
        errorDiv.classList.add('show');
    }
    finally{
        loginBtn.disabled = true;
        loadingDiv.style.display = 'none';
    }
}


//Handle logout
async function handleLogout(){
    try{
        const response = await fetch(`${API_URL}/logout`,{
            method: 'POST',
            credentials: 'include'
        });
    }
    catch(error){
        console.error('Logout error: ', error);
    }

    //Reset the input placeholders for re-login
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    //document.getElementById('dashboardPage').classList.remove('active');
    document.getElementById('loginPage').classList.add('active');
}

async function showDashboard(user){
    document.getElementById('loginPage').classList.remove('active');
    //document.getElementById('dashboardPage').classList.remove('active');

    currentUserRole = user.role;
    document.getElementById('welcomeMessage').innerHTML = `Welcome, ${user.username}!`;
    if(user.role === 'admin'){
        document.getElementById('welcomeMessage').innerHTML += `<span class = "admin-badge">ADMIN</span>`;
        document.getElementById('adminSection').style.display = 'block';
        loadUsers();
    }
    document.getElementById('userEmail').textContent = user.email;
    const createdDate = new Date(user.created_at).toLocaleDateString();
    document.getElementById('accountCreated').textContent = createdDate;
    
    const lastLoginDate = user.last_login? new Date(user.last_login).toLocaleString(): 'just now';
}


//Load users from the database
async function loadUsers(){
    try{
        const response = await fetch(`${API_URL}/admin/users`, {
            credentials: 'include',
        });
        if(response.ok){
            const data = await response.json();
            if(data.users.length === 0){
                userListDiv.innerHTML = '<div class="empty-state"><i class="ph ph-users"></i><p>No users yet.</p></div>';
                return;
            }
            userListDiv.innerHTML = data.users.map(user => `
                <div class="user-item">
                    <div class="user-info">
                        <strong>${user.username}</strong>
                        <small>${user.email}</small>
                        <span class="user-role role-${user.role}">${user.role.toUpperCase()}</span>
                    </div>
                    ${user.id !== currentUserId ? `<button class="delete-btn" onclick="deleteUser(${user.id})">Delete</button>` : ''}
                </div>
                `).join('');
        }
    }
    catch(error){
        user.ListDiv.innerHTML = '<div class="error show">Failed to load users</div>';
    }
}

function displayUsers(users){
    const usersList = document.getElementById('userList');
    if(users.length === 0){
        usersList.innerHTML = `
            <div class="empty-state">
                <div class="icon"><i class="ph ph-users"></i>
                    <p>No users found</p>
                </div>
            </div>
        `;
        return;
    }

    userList.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-info">
                <strong>${user.username}<span class="user-role role-${user.role}">${user.role.toUpperCase()}</span></strong>
                <small><i class="ph ph-mailbox"></i> ${user.email}. <i class="ph ph-calendar-blank"></i> Joined ${new Date(user.created_at).toLocaleDateString()}</small>
            </div>
            <button class="delete-btn" onclick="handleDeleteUser(${user.id}, '${user.username}')"><i class="ph ph-trash-simple"></i></button>
        </div>
    `).join('');
}

function isValidEmail(email){
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

async function handleAddUser(){
    const username = document.getElementById('newUsername').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    const errorDiv = document.getElementById('addUserError');
    const successDiv = document.getElementById('addUserSuccess');

    errorDiv.classList.remove('show');
    successDiv.classList.remove('show');

    if(!username || !email || !password){
        errorDiv.textContent = 'All fields are required!';
        errorDiv.classList.add('show');
        return;
    }

    if(username.length < 3){
        errorDiv.textContent = 'Username must be at least 3 characters';
        errorDiv.classList.add('show');
    }

    if(!isValidEmail(email)){
        errorDiv.textContent = 'Please enter a valid email';
        errorDiv.classList.add('show');
        return;
    }

    if(password.length < 6){
        errorDiv.textContent = 'Password must be at leasr 6 characters.';
        errorDiv.classList.add('show');
    }

    if(!['user', 'admin'].includes(role)){
        errorDiv.textContent = 'Invalid role selected';
        errorDiv.classList.add('show');
        return;
    }

    try{
        const response = await fetch(`${API_URL}/admin/register`, {
            method: 'POST',
            headers : {
                'Content-Type' : 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({username, email, password, role})
        });
        
        const data = await response.json();
        if(response.ok){
            successDiv.textContent = 'User "${username}" created successfully.';
            successDiv.classList.add('show');

            document.getElementById('newUsername').value = '';
            document.getElementById('newEmail').value = '';
            document.getElemebtById('newPassword').value = '';
            document.getElementById('newRole').value = '';

            loadUsers();

            setTimeout(() => successDiv.classList.remove('show'), 3000);
        }
        else{
            errorDiv.textContent = data.error || 'Failed to add user.';
            errorDiv.classList.add('show');
        }
    }
    catch(error){
        errorDiv.textContent = 'Connection error';
        errorDiv.classList.add('show');
    }
}

async function handleDeleteUser(userId, username){
    if(!confirm(`Are you sure you want to delete user "${username}"?`)){
        return;
    }
    try{
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if(response.ok){
            loadUsers();
        }
        else{
            alert(data.error || 'Failed to delete user.');
        }
    }
    catch(error){
        alert('Connection error');
    }
}

document.addEventListener('keypress', (e) =>{
    if(e.key === 'Enter' && document.getElementById('loginPage').classList.contains('active')){
        handleLogin();
    }
});