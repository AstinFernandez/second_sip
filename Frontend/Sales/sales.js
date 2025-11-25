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

//Function prevents the browser's default
sidebar.addEventListener('click', (e) => {
    const menuItem = e.target.closest('.menu-item');
    if (!menuItem) return;

    const linkHref = menuItem.getAttribute('href');

    const normalizedCurrent = window.location.pathname === '/' ? '/' : window.location.pathname;
    const normalizedLink = linkHref === '/' ? '/' : linkHref;

    if (normalizedLink.toLowerCase() === normalizedCurrent.toLowerCase()) {
        e.preventDefault(); // ← NOW THIS ACTUALLY RUNS!

        mainContent.classList.remove('blurred');
        if (sidebar.classList.contains('active')) {
            setTimeout(() => {
                mainContent.classList.add('blurred');
            }, 100);
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
    document.getElementById('loginPage').classList.add('active');
}

document.addEventListener('keypress', (e) =>{
    if(e.key === 'Enter' && document.getElementById('loginPage').classList.contains('active')){
        handleLogin();
    }
});