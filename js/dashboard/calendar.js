

// Add this to your switch statement in the tab loading logic:
case 'calendar':
    if (!window.calendarInstance) {
        window.calendarInstance = new Calendar();
    } else {
        await window.calendarInstance.loadEvents();
        window.calendarInstance.render();
    }
    break;