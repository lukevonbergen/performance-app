// js/utils/date-formatter.js
export function formatDate(date) {
    return new Date(date).toLocaleDateString();
}

export function formatTime(time) {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}