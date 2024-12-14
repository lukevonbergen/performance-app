// js/utils/session.js
export function getCurrentUser() {
    return JSON.parse(sessionStorage.getItem('user'));
}

export function setCurrentUser(user) {
    sessionStorage.setItem('user', JSON.stringify(user));
}

export function clearSession() {
    sessionStorage.removeItem('user');
}