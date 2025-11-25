const API_URL = '/api';

(async function() {
    try {
        const response = await fetch(`${API_URL}/check-auth`, {
            credentials: 'include'
        });

        if (!response.ok) {
            redirectToLogin();
        } else {
            const data = await response.json();
            window.currentUser = data.user;
            
            updateUserInfo(data.user);
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        redirectToLogin();
    }
})();

function redirectToLogin() {
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    
    window.location.href = '/index.html';
}

function updateUserInfo(user) {
    const userDisplayElements = document.querySelectorAll('[data-user-name]');
    userDisplayElements.forEach(el => {
        el.textContent = user.username;
    });

    const userEmailElements = document.querySelectorAll('[data-user-email]');
    userEmailElements.forEach(el => {
        el.textContent = user.email;
    });

    if (user.role !== 'admin') {
        const adminOnlyElements = document.querySelectorAll('[data-admin-only]');
        adminOnlyElements.forEach(el => {
            el.style.display = 'none';
        });
    }
}

async function logout() {
    try {
        await fetch(`${API_URL}/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    window.location.href = '/index.html';
}

window.logout = logout;