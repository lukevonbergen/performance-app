// Import and Global Setup
import { supabase } from "../utils/supabase.js";
import { MessagingSystem } from "./messaging.js";

// Make supabase globally available
window.supabase = supabase;
window.revenueChart = null;
window.timesChart = null;

// Global Variables and Initial Setup
window.user = JSON.parse(sessionStorage.getItem("user"));
window.selectedPerformer = null;
window.selectedTime = null;

// Authentication Check
if (!window.user || window.user.type !== "venue") {
  window.location.href = "login";
}

// Utility Functions
function formatTime(timeString) {
  if (!timeString) return "Invalid Time";
  const [hours, minutes] = timeString.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
  const formattedMinutes = String(minutes).padStart(2, "0");
  return `${formattedHours}:${formattedMinutes} ${period}`;
}

function calculateTotalCost(startTime, endTime, hourlyRate) {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  const durationHours = (endTotalMinutes - startTotalMinutes) / 60;
  return (durationHours * hourlyRate).toFixed(2);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const day = date.getDate();
  const suffix = (day) => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };
  return `${date.toLocaleDateString("en-GB", { weekday: "long" })} ${day}${suffix(day)} ${date.toLocaleDateString("en-GB", { month: "long" })}`;
}

// Dashboard Functions
async function loadDashboardData() {
  try {
    console.log("Elements check:", {
      totalCost: document.getElementById("totalCost"),
      actsCount: document.getElementById("actsCount"),
      scheduleList: document.getElementById("scheduleList"),
      upcomingEventsList: document.getElementById("upcomingEventsList"),
    });

    const today = new Date().toISOString().split("T")[0];
    const { data: upcomingEvents, error } = await supabase
      .from("performances")
      .select(
        `
                *,
                performers (
                    stage_name
                )
            `,
      )
      .eq("venue_id", window.user.id)
      .gte("date", today)
      .order("date", { ascending: true });

    if (error) throw error;
    updateDashboardUI(upcomingEvents, today);
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    showErrorMessage("Error loading dashboard data");
  }
}

// Dropdown toggle functionality
document.getElementById("userMenuBtn").addEventListener("click", function () {
  document.getElementById("userDropdown").classList.toggle("hidden");
});

// Close dropdown when clicking outside
document.addEventListener("click", function (event) {
  const dropdown = document.getElementById("userDropdown");
  const button = document.getElementById("userMenuBtn");
  if (!button.contains(event.target) && !dropdown.contains(event.target)) {
    dropdown.classList.add("hidden");
  }
});

function updateDashboardUI(upcomingEvents, today) {
  // Retry mechanism for getting elements
  let retryCount = 0;
  const maxRetries = 5;

  const getElements = () => {
    // Try different methods to get totalCostElement
    const totalCostElement =
      document.querySelector("#totalCost") ||
      document.querySelector('p[id="totalCost"]') ||
      document.getElementsByClassName("text-3xl font-bold text-black mt-1")[0];

    const upcomingEventsList = document.getElementById("upcomingEventsList");
    const scheduleList = document.getElementById("scheduleList");
    const actsCount = document.getElementById("actsCount");

    // Debug logging
    console.log("Element check details:", {
      totalCostElement: {
        byId: document.getElementById("totalCost"),
        byQuerySelector: document.querySelector("#totalCost"),
        byClass: document.getElementsByClassName(
          "text-3xl font-bold text-black mt-1",
        )[0],
      },
      actsCount: {
        element: actsCount,
        parent: actsCount?.parentElement,
      },
    });

    if (
      !totalCostElement ||
      !upcomingEventsList ||
      !scheduleList ||
      !actsCount
    ) {
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`Retry ${retryCount} getting elements...`);
        setTimeout(getElements, 200); // Increased timeout to 200ms
        return;
      }
      console.error("Required elements not found after retries:", {
        totalCostElement: !!totalCostElement,
        upcomingEventsList: !!upcomingEventsList,
        scheduleList: !!scheduleList,
        actsCount: !!actsCount,
      });
      return;
    }

    // Update total cost
    const confirmedEvents =
      upcomingEvents?.filter((event) => event.status === "confirmed") || [];
    const totalCost = confirmedEvents.reduce((sum, event) => {
      return (
        sum +
        parseFloat(
          calculateTotalCost(
            event.start_time,
            event.end_time,
            event.booking_rate,
          ),
        )
      );
    }, 0);
    totalCostElement.textContent = `£${totalCost.toFixed(2)}`;

    // Filter out rejected events for upcoming events list
    const activeEvents =
      upcomingEvents?.filter((event) => event.status !== "rejected") || [];

    if (activeEvents.length > 0) {
      upcomingEventsList.innerHTML = activeEvents
        .map(
          (event) => `
                <div class="border-l-4 ${
                  event.status === "confirmed"
                    ? "border-green-500"
                    : event.status === "pending"
                      ? "border-yellow-500"
                      : "border-gray-500"
                } pl-4 py-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-medium text-black">${event.performers.stage_name}</h3>
                            <p class="text-sm text-black">${formatDate(event.date)}</p>
                            <p class="text-sm text-black">${formatTime(event.start_time)} - ${formatTime(event.end_time)}</p>
                            <div class="flex space-x-2 text-sm text-black">
                                <p>Rate: £${event.booking_rate}/hr</p>
                                <span>•</span>
                                <p>Total: £${calculateTotalCost(event.start_time, event.end_time, event.booking_rate)}</p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              event.status === "confirmed"
                                ? "bg-green-500/20 text-green-400"
                                : event.status === "pending"
                                  ? "bg-yellow-500/20 text-yellow-700"
                                  : "bg-gray-500/20 text-gray-400"
                            }">
                                ${event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                            </span>
                            <button 
                                onclick="cancelBooking('${event.id}')"
                                class="mt-2 text-sm text-red-400 hover:text-red-300"
                            >
                                Cancel Booking
                            </button>
                        </div>
                    </div>
                </div>
            `,
        )
        .join("");
    } else {
      upcomingEventsList.innerHTML = `
                <div class="text-center text-gray-500">
                    No upcoming events scheduled
                </div>
            `;
    }

    // Update today's schedule
    updateTodaySchedule(upcomingEvents, today);

    // Update next event instead of acts count
    const nextEvent = upcomingEvents
      ?.filter((event) => event.status === "confirmed" && event.date >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

    // Update UI
    if (nextEvent) {
      document.getElementById("actsCount").innerHTML = `
                <div class="p-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center w-12 h-12">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <div class="ml-5">
                    <p class="text-sm font-medium text-black">Next Event</p>
                    <h3 class="text-lg font-semibold text-black mt-1">${nextEvent.performers.stage_name}</h3>
                    <p class="text-sm text-gray-500">${formatDate(nextEvent.date)}</p>
                    <p class="text-sm text-gray-500">${formatTime(nextEvent.start_time)} - ${formatTime(nextEvent.end_time)}</p>
                </div>
            `;
    } else {
      document.getElementById("actsCount").innerHTML = `
                <div class="p-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center w-12 h-12">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <div class="ml-5">
                    <p class="text-sm font-medium text-black">Next Event</p>
                    <p class="text-lg text-gray-500 mt-1">No upcoming events</p>
                </div>
            `;
    }
  };

  // Start the process
  getElements();
}

function updateTodaySchedule(upcomingEvents, today) {
  // Filter out rejected performances and only show for today
  const todayEvents =
    upcomingEvents?.filter(
      (event) => event.date === today && event.status !== "rejected",
    ) || [];
  const scheduleList = document.getElementById("scheduleList");

  if (todayEvents.length > 0) {
    scheduleList.innerHTML = todayEvents
      .map(
        (event) => `
            <div class="border-l-4 border-blue-500 pl-4">
                <h3 class="font-medium text-black">${event.performers.stage_name}</h3>
                <p class="text-black">${formatTime(event.start_time)} - ${formatTime(event.end_time)}</p>
                <p class="text-sm text-gray-400">Status: ${event.status}</p>
            </div>
        `,
      )
      .join("");
  } else {
    scheduleList.innerHTML = `
            <div class="text-center text-gray-500">
                No performances scheduled for today
            </div>
        `;
  }
}

// Search and Booking Functions
async function searchPerformers(date, startTime) {
  try {
    const searchDateTime = new Date(`${date}T${startTime}`);
    const performanceType = document.getElementById("performanceType").value;

    // Get existing bookings
    const { data: existingBookings, error: bookingsError } = await supabase
      .from("performances")
      .select("performer_id")
      .eq("date", date)
      .eq("start_time", startTime + ":00");

    if (bookingsError) throw bookingsError;

    const bookedPerformerIds =
      existingBookings?.map((booking) => booking.performer_id) || [];

    // Build query for available performers
    let query = supabase
      .from("performer_availability")
      .select(
        `
                *,
                performers (
                    id,
                    stage_name,
                    performance_type
                )
            `,
      )
      .eq("date", date);

    // Add performance type filter if selected
    if (performanceType) {
      query = query.eq("performers.performance_type", performanceType);
    }

    const { data: availability, error } = await query;

    if (error) throw error;

    updateSearchResults(
      availability,
      bookedPerformerIds,
      startTime,
      searchDateTime,
    );
  } catch (error) {
    console.error("Error searching performers:", error);
    showErrorMessage("Error searching for performers. Please try again.");
  }
}

function updateSearchResults(
  availability,
  bookedPerformerIds,
  startTime,
  searchDateTime,
) {
  const availablePerformers = (availability || []).filter((slot) => {
    if (bookedPerformerIds.includes(slot.performer_id)) return false;

    const requestedTime = parseInt(startTime.split(":")[0]);
    const slotStart = parseInt(slot.start_time.split(":")[0]);
    const slotEnd = parseInt(slot.end_time.split(":")[0]);

    return requestedTime >= slotStart && requestedTime < slotEnd;
  });

  const resultsDiv = document.getElementById("searchResults");

  if (availablePerformers.length > 0) {
    resultsDiv.innerHTML = availablePerformers
      .map(
        (slot) => `
            <div class="border rounded-lg p-4 flex justify-between items-center bg-black/20 backdrop-blur-lg">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <h3 class="font-medium text-black">${slot.performers.stage_name}</h3>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400">
                            ${slot.performers.performance_type}
                        </span>
                    </div>
                    <p class="text-sm text-black">Available ${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}</p>
                    <div class="flex space-x-2 text-sm text-black">
                        <p>Rate: £${slot.rate_per_hour}/hr</p>
                        <span>•</span>
                        <p>Total: £${calculateTotalCost(slot.start_time, slot.end_time, slot.rate_per_hour)}</p>
                    </div>
                </div>
                <button 
                    onclick="openBookingModal('${slot.performer_id}', '${slot.performers.stage_name.replace(/'/g, "\\'")}', ${slot.rate_per_hour}, '${searchDateTime.toISOString()}', '${slot.performers.performance_type}')"
                    class="px-4 py-2 bg-gray-900 text-white rounded-lg"
                >
                    Book Now
                </button>
            </div>
        `,
      )
      .join("");
  } else {
    resultsDiv.innerHTML = `
            <div class="text-center text-gray-500">
                No performers available at this time
            </div>
        `;
  }
}

// Calendar Class Definition
class Calendar {
  constructor() {
    this.currentDate = new Date();
    this.events = [];
    this.container = document.getElementById("calendar-container");
    this.initialize();
  }

  async initialize() {
    await this.loadEvents();
    this.render();
    this.setupEventListeners();
  }

  async loadEvents() {
    const startOfMonth = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      0,
    );

    try {
      const { data, error } = await supabase
        .from("performances")
        .select(
          `
                    *,
                    performers (
                        stage_name,
                        performance_type
                    )
                `,
        )
        .eq("venue_id", window.user.id)
        .eq("status", "confirmed")
        .gte("date", startOfMonth.toISOString())
        .lte("date", endOfMonth.toISOString());

      if (error) throw error;
      this.events = data || [];
    } catch (error) {
      console.error("Error loading calendar events:", error);
    }
  }

  formatTime(timeString) {
    const [hours, minutes] = timeString.split(":");
    const period = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes} ${period}`;
  }

  getDaysInMonth() {
    return new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      0,
    ).getDate();
  }

  getFirstDayOfMonth() {
    return new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth(),
      1,
    ).getDay();
  }

  async previousMonth() {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() - 1,
    );
    await this.loadEvents();
    this.render();
  }

  async nextMonth() {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
    );
    await this.loadEvents();
    this.render();
  }

  setupEventListeners() {
    const prevButton = this.container.querySelector(".prev-month");
    const nextButton = this.container.querySelector(".next-month");

    prevButton?.addEventListener("click", () => this.previousMonth());
    nextButton?.addEventListener("click", () => this.nextMonth());
  }

  render() {
    const daysInMonth = this.getDaysInMonth();
    const firstDay = this.getFirstDayOfMonth();
    let html = ''; // Declare the html variable here at the start

    // Add the month title and navigation
    html += `
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold text-black">
                ${this.currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <div class="flex space-x-2">
                <button class="prev-month p-2 rounded-lg hover:bg-black/5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                </button>
                <button class="next-month p-2 rounded-lg hover:bg-black/5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>

        <div class="grid grid-cols-7 text-sm font-medium text-black border-b border-black/10">
            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => 
                `<div class="p-2 text-center">${day}</div>`
            ).join('')}
        </div>
        <div class="grid grid-cols-7">
    `;

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="h-32 bg-black/5 border border-black/10"></div>`;
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day).toISOString().split('T')[0];
        const dayEvents = this.events.filter(event => event.date === date);
        const isToday = date === new Date().toISOString().split('T')[0];

        html += `
            <div class="h-32 bg-white border border-black/10 p-2">
                <div class="font-medium text-sm mb-1 relative">
                    ${isToday ? 
                        `<div class="inline-flex relative">
                            ${day}
                            <div class="absolute -top-1 -right-1.5 w-2 h-2 bg-red-500 rounded-full"></div>
                        </div>` : 
                        day
                    }
                </div>
                <div class="space-y-1">
                    ${dayEvents.map(event => `
                        <div class="text-xs p-1 rounded bg-indigo-500/10 border border-indigo-500/20">
                            <div class="font-medium text-black">${event.performers.stage_name}</div>
                            <div class="text-black/70">
                                ${this.formatTime(event.start_time)} - ${this.formatTime(event.end_time)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    html += `</div>`;
    this.container.innerHTML = html;
    this.setupEventListeners();
    }
}

// Modal Functions
window.openBookingModal = async function (
  performerId,
  performerName,
  rate,
  startTime,
) {
  console.log("Opening modal with:", {
    performerId,
    performerName,
    rate,
    startTime,
  });

  window.selectedPerformer = {
    id: performerId,
    name: performerName,
    rate: rate,
  };
  window.selectedTime = startTime;

  const date = new Date(startTime).toISOString().split("T")[0];
  console.log("Fetching availability for date:", date);

  const { data: slot, error } = await supabase
    .from("performer_availability")
    .select("start_time, end_time, rate_per_hour")
    .eq("performer_id", performerId)
    .eq("date", date)
    .single();

  if (error) {
    console.error("Error fetching availability:", error);
    return;
  }

  console.log("Retrieved slot:", slot);

  // Show the modal
  const modal = document.getElementById("bookingModal");
  modal.classList.remove("hidden");

  updateBookingModal(performerName, startTime, slot);
};

function updateBookingModal(performerName, startTime, slot, performanceType) {
  document.getElementById("bookingDetails").innerHTML = `
        <div class="grid gap-4">
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-3">
                    <div class="p-2 bg-indigo-100 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Performer</p>
                        <p class="font-medium text-gray-900">${performerName}</p>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400 mt-1">
                            ${performanceType}
                        </span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-gray-50 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <div class="p-2 bg-indigo-100 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Date</p>
                            <p class="font-medium text-gray-900">${new Date(startTime).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-gray-50 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <div class="p-2 bg-indigo-100 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Time</p>
                            <p class="font-medium text-gray-900">${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-gray-50 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <div class="p-2 bg-indigo-100 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Rate</p>
                            <p class="font-medium text-gray-900">£${slot.rate_per_hour}/hr</p>
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-gray-50 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <div class="p-2 bg-indigo-100 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4M20 12a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v4a2 2 0 002 2M20 12v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4" />
                            </svg>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Total Cost</p>
                            <p class="font-medium text-gray-900">£${calculateTotalCost(slot.start_time, slot.end_time, slot.rate_per_hour)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.closeBookingModal = function () {
  document.getElementById("bookingModal").classList.add("hidden");
  window.selectedPerformer = null;
  window.selectedTime = null;
};

window.confirmBooking = async function () {
  try {
    const date = new Date(window.selectedTime).toISOString().split("T")[0];
    const startTime = document.getElementById("searchStartTime").value;

    const { data: availabilitySlot, error: slotError } = await supabase
      .from("performer_availability")
      .select("end_time")
      .eq("performer_id", window.selectedPerformer.id)
      .eq("date", date)
      .single();

    if (slotError) throw slotError;

    const bookingData = {
      venue_id: window.user.id,
      performer_id: window.selectedPerformer.id,
      date: date,
      start_time: startTime + ":00",
      end_time: availabilitySlot.end_time,
      booking_rate: window.selectedPerformer.rate,
      status: "pending",
    };

    const { error } = await supabase.from("performances").insert([bookingData]);

    if (error) throw error;

    handleSuccessfulBooking();
  } catch (error) {
    console.error("Error creating booking:", error);
    showErrorMessage("Error creating booking. Please try again.");
  }
};

function handleSuccessfulBooking() {
  closeBookingModal();
  showSuccessMessage(
    "Booking submitted successfully! Awaiting performer confirmation.",
  );
  loadDashboardData();
  document.getElementById("searchForm").dispatchEvent(new Event("submit"));
}

// Notification Functions
function showSuccessMessage(message) {
  showNotification(message, "success");
}

function showErrorMessage(message) {
  showNotification(message, "error");
}

function showNotification(message, type) {
  const isSuccess = type === "success";
  const div = document.createElement("div");
  div.className = `fixed bottom-4 right-4 ${isSuccess ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"} px-6 py-3 rounded-lg z-50 flex items-center`;
  div.innerHTML = `
        <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isSuccess ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"}" />
        </svg>
        ${message}
    `;
  document.body.appendChild(div);

  setTimeout(() => {
    div.style.transition = "opacity 0.5s ease-in-out";
    div.style.opacity = "0";
    setTimeout(() => div.remove(), 500);
  }, 3000);
}

// Reports Functions
async function loadReportsData() {
  try {
    const { data: performances, error } = await supabase
      .from("performances")
      .select(
        `
                *,
                performers (
                    stage_name
                )
            `,
      )
      .eq("venue_id", window.user.id);

    if (error) throw error;

    const {
      totalConfirmedCost,
      confirmedCount,
      monthlyCosts,
      performerStats,
      timeStats,
    } = processReportsData(performances);

    updateReportsSummary(
      totalConfirmedCost,
      performances.length,
      confirmedCount,
    );
    createCostChart(monthlyCosts);
    createTimesChart(timeStats);
    updateTopPerformersTable(performerStats);
  } catch (error) {
    console.error("Error loading reports data:", error);
  }
}

function processReportsData(performances) {
  let totalConfirmedCost = 0;
  let confirmedCount = 0;
  const monthlyCosts = {};
  const performerStats = {};
  const timeStats = {};

  performances.forEach((booking) => {
    const hours =
      (new Date(`2000/01/01 ${booking.end_time}`) -
        new Date(`2000/01/01 ${booking.start_time}`)) /
      3600000;
    const cost = hours * booking.booking_rate;

    if (booking.status === "confirmed") {
      totalConfirmedCost += cost;
      confirmedCount++;

      const month = new Date(booking.date).toLocaleString("default", {
        month: "short",
      });
      monthlyCosts[month] = (monthlyCosts[month] || 0) + cost;
    }

    updatePerformerStats(performerStats, booking, cost);
    updateTimeStats(timeStats, booking);
  });

  return {
    totalConfirmedCost,
    confirmedCount,
    monthlyCosts,
    performerStats,
    timeStats,
  };
}

function updatePerformerStats(performerStats, booking, cost) {
  const performerName = booking.performers.stage_name;
  if (!performerStats[performerName]) {
    performerStats[performerName] = { bookings: 0, cost: 0 };
  }
  performerStats[performerName].bookings++;
  performerStats[performerName].cost += cost;
}

function updateTimeStats(timeStats, booking) {
  const hour = booking.start_time.split(":")[0];
  timeStats[hour] = (timeStats[hour] || 0) + 1;
}

function updateReportsSummary(
  totalConfirmedCost,
  totalBookings,
  confirmedCount,
) {
  document.getElementById("reportsTotalCost").textContent =
    `£${totalConfirmedCost.toFixed(2)}`;
  document.getElementById("totalBookings").textContent = totalBookings;
  document.getElementById("confirmedBookings").textContent = confirmedCount;
  document.getElementById("confirmationRate").textContent =
    `${((confirmedCount / totalBookings) * 100).toFixed(1)}%`;
}

function createCostChart(monthlyCosts) {
  const ctx = document.getElementById("revenueChart");

  // Destroy existing chart if it exists
  if (window.revenueChart) {
    window.revenueChart.destroy();
  }

  window.revenueChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Object.keys(monthlyCosts),
      datasets: [
        {
          label: "Cost",
          data: Object.values(monthlyCosts),
          borderColor: "#4F46E5",
          backgroundColor: "rgba(79, 70, 229, 0.1)",
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
          },
          ticks: {
            color: "rgba(0, 0, 0, 0.7)",
          },
        },
        x: {
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
          },
          ticks: {
            color: "rgba(0, 0, 0, 0.7)",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "rgba(0, 0, 0, 0.7)",
          },
        },
      },
    },
  });
}

function createTimesChart(timeStats) {
  const ctx = document.getElementById("timesChart");

  // Destroy existing chart if it exists
  if (window.timesChart) {
    window.timesChart.destroy();
  }

  window.timesChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(timeStats)
        .sort()
        .map((hour) => `${hour}:00`),
      datasets: [
        {
          label: "Bookings",
          data: Object.keys(timeStats)
            .sort()
            .map((hour) => timeStats[hour]),
          backgroundColor: "#0EA5E9",
          hoverBackgroundColor: "#0284C7",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
          },
          ticks: {
            color: "rgba(0, 0, 0, 0.7)",
          },
        },
        x: {
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
          },
          ticks: {
            color: "rgba(0, 0, 0, 0.7)",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "rgba(0, 0, 0, 0.7)",
          },
        },
      },
    },
  });
}

function updateTopPerformersTable(performerStats) {
  const tableBody = document.getElementById("topPerformersTable");
  const performers = Object.entries(performerStats)
    .sort((a, b) => b[1].bookings - a[1].bookings)
    .slice(0, 5);

  tableBody.innerHTML = performers
    .map(
      ([name, stats]) => `
        <tr class="border-t border-white/10">
            <td class="py-4">${name}</td>
            <td class="py-4">${stats.bookings}</td>
            <td class="py-4">£${stats.cost.toFixed(2)}</td>
            <td class="py-4">9.2</td>
        </tr>
    `,
    )
    .join("");
}

// Settings Functions
async function loadSettings() {
  try {
    const { data: venue, error } = await supabase
      .from("venues")
      .select("*")
      .eq("id", window.user.id)
      .single();

    if (error) throw error;

    // Populate form fields
    document.getElementById("settingsFirstName").value = venue.first_name;
    document.getElementById("settingsLastName").value = venue.last_name;
    document.getElementById("settingsVenueName").value = venue.venue_name;
    document.getElementById("settingsEmail").value = venue.email;
    document.getElementById("settingsAddressLine1").value = venue.address_line1;
    document.getElementById("settingsAddressLine2").value =
      venue.address_line2 || "";
    document.getElementById("settingsCity").value = venue.city;
    document.getElementById("settingsCounty").value = venue.county || "";
    document.getElementById("settingsPostcode").value = venue.postcode;
  } catch (error) {
    console.error("Error loading settings:", error);
    showErrorMessage("Error loading settings. Please try again.");
  }
}

async function updateSettings(formData) {
  try {
    const { error } = await supabase
      .from("venues")
      .update({
        first_name: formData.firstName,
        last_name: formData.lastName,
        venue_name: formData.venueName,
        email: formData.email,
        address_line1: formData.addressLine1,
        address_line2: formData.addressLine2 || null,
        city: formData.city,
        county: formData.county || null,
        postcode: formData.postcode,
      })
      .eq("id", window.user.id);

    if (error) throw error;

    // Update session storage with new data
    const user = JSON.parse(sessionStorage.getItem("user"));
    user.first_name = formData.firstName;
    user.venue_name = formData.venueName;
    sessionStorage.setItem("user", JSON.stringify(user));

    // Update UI elements
    document.getElementById("venueName").textContent = formData.venueName;
    document.getElementById("welcomeMessage").textContent =
      `Welcome back, ${formData.firstName}`;

    showSuccessMessage("Settings updated successfully");
  } catch (error) {
    console.error("Error updating settings:", error);
    showErrorMessage("Error updating settings. Please try again.");
  }
}

// Cancellation Functions
window.cancelBooking = async function (bookingId) {
  try {
    // First get the booking details
    const { data: booking, error: fetchError } = await supabase
      .from("performances")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      throw fetchError;
    }

    // Delete the performance
    const { error: deleteError } = await supabase
      .from("performances")
      .delete()
      .eq("id", bookingId)
      .eq("venue_id", window.user.id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      throw deleteError;
    }

    // Create new availability for the performer
    const availabilityData = {
      performer_id: booking.performer_id,
      date: booking.date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      rate_per_hour: booking.booking_rate,
    };

    console.log("Creating new availability:", availabilityData);

    // Re-insert the availability
    const { error: availError } = await supabase
      .from("performer_availability")
      .insert([availabilityData]);

    if (availError) {
      console.error("Availability error:", availError);
      throw availError;
    }

    await loadDashboardData();
    showSuccessMessage("Booking cancelled successfully");
  } catch (error) {
    console.error("Error cancelling booking:", error);
    showErrorMessage("Error cancelling booking: " + error.message);
  }
};

// Function to safely show a tab
function showTab(tabId) {
  // Hide all tab content first
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.add("hidden");
  });

  // Get the target tab element
  const tabElement = document.getElementById(`${tabId}-tab`);
  if (tabElement) {
    tabElement.classList.remove("hidden");
    return true;
  }

  // If tab not found, show dashboard as fallback
  const dashboardTab = document.getElementById("dashboard-tab");
  if (dashboardTab) {
    dashboardTab.classList.remove("hidden");
    saveActiveTab("dashboard");
    return false;
  }
}

// Update the setActiveTab function
function setActiveTab(tabId) {
  // Remove active class from all tabs
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("bg-white/5", "bg-white/10");
  });

  // Add active class to current tab button if it exists
  const activeTab = document.querySelector(`[data-tab="${tabId}"]`);
  if (activeTab) {
    activeTab.classList.add("bg-white/5");
  }

  // Show the correct tab content
  showTab(tabId);
}

// Tab persistence functions
function saveActiveTab(tabId) {
  localStorage.setItem("activeTab", tabId);
}

function getActiveTab() {
  return localStorage.getItem("activeTab") || "dashboard"; // Default to dashboard if no tab is stored
}

// Authentication Functions
window.logout = function () {
  sessionStorage.removeItem("user");
  localStorage.removeItem("activeTab"); // Clear stored tab on logout
  window.location.href = "login";
};

async function generateVenueQR(venueId) {
  const ratingUrl = `${window.location.origin}/rate/venue/${venueId}`;
  try {
    const qr = await new Promise((resolve, reject) => {
      QRCode.toDataURL(
        ratingUrl,
        {
          width: 512,
          height: 512,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
        (err, url) => {
          if (err) reject(err);
          resolve(url);
        },
      );
    });
    return qr;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw error;
  }
}

async function displayVenueQR() {
  const qrCode = await generateVenueQR(window.user.id); // Generate QR code using user ID
  const qrImage = document.getElementById("venueQR");
  const downloadButton = document.getElementById("downloadQR");

  // Set the QR code image source
  qrImage.src = qrCode;

  // Set the download button functionality
  downloadButton.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = qrCode; // Use the generated QR code data URL
    link.download = "venue-qr-code.png"; // File name for the download
    link.click();
  });
}

// Call the display function on page load or when the venue settings page is ready
document.addEventListener("DOMContentLoaded", async function () {
  // Wait for page to be fully loaded
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Initialize UI elements first
  document.getElementById("venueName").textContent = window.user.venue_name;
  document.getElementById("welcomeMessage").textContent =
    `Welcome back, ${window.user.first_name}`;
  if (document.getElementById("searchDate")) {
    document.getElementById("searchDate").min = new Date()
      .toISOString()
      .split("T")[0];
  }

  // Get and set the active tab
  const storedTab = getActiveTab();
  setActiveTab(storedTab);

  // Show initial tab content
  document.getElementById(`${storedTab}-tab`).classList.remove("hidden");

    // Load initial data
    try {
        await loadDashboardData();
        
        // Load data based on active tab
        switch(storedTab) {
            case 'reports':
                await loadReportsData();
                break;
            case 'settings':
                await loadSettings();
                break;
            case 'dashboard':
                // Already loaded
                break;
            case 'calendar':
                if (!window.calendarInstance) {
                    window.calendarInstance = new Calendar();
                } else {
                    await window.calendarInstance.loadEvents();
                    window.calendarInstance.render();
                }
                break;
        }
    } catch (error) {
        console.error('Error loading initial data:', error);
}

  // Generate and display QR code
  try {
    if (document.getElementById("venueQR")) {
      const qrCode = await generateVenueQR(window.user.id);
      const qrImage = document.getElementById("venueQR");
      qrImage.src = qrCode;
    }
  } catch (error) {
    console.error("Error generating QR code:", error);
  }

  // Set up navigation handlers
  // In your tab switching logic where you handle other tabs
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", async () => {
      const tabId = link.getAttribute("data-tab");
      saveActiveTab(tabId);
      setActiveTab(tabId);

      // Hide all tabs and show selected
      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.add("hidden");
      });
      document.getElementById(`${tabId}-tab`).classList.remove("hidden");

      // Load tab data
      try {
        switch (tabId) {
          case "reports":
            await loadReportsData();
            break;
          case "settings":
            await loadSettings();
            break;
          case "dashboard":
            await loadDashboardData();
            break;
          case "messages":
            if (!window.messagingSystem) {
              window.messagingSystem = new MessagingSystem(
                window.user,
                supabase,
                showErrorMessage,
              );
            } else {
              await window.messagingSystem.loadConversations();
            }
            break;
        }
      } catch (error) {
        console.error("Error loading tab data:", error);
      }
    });
  });

  // Form handlers
  document
    .getElementById("searchForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const date = document.getElementById("searchDate").value;
      const startTime = document.getElementById("searchStartTime").value;
      await searchPerformers(date, startTime);
    });

  // Settings form handler
  document
    .getElementById("settingsForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = {
        firstName: document.getElementById("settingsFirstName").value,
        lastName: document.getElementById("settingsLastName").value,
        venueName: document.getElementById("settingsVenueName").value,
        email: document.getElementById("settingsEmail").value,
        addressLine1: document.getElementById("settingsAddressLine1").value,
        addressLine2: document.getElementById("settingsAddressLine2").value,
        city: document.getElementById("settingsCity").value,
        county: document.getElementById("settingsCounty").value,
        postcode: document.getElementById("settingsPostcode").value,
      };
      await updateSettings(formData);
    });

  document
    .querySelector('[data-tab="calendar"]')
    .addEventListener("click", () => {
      if (!window.calendarInstance) {
        window.calendarInstance = new Calendar();
      }
    });

  // Auto-refresh setup
  setInterval(async () => {
    const activeTab = getActiveTab();
    try {
      switch (activeTab) {
        case "dashboard":
          await loadDashboardData();
          break;
        case "reports":
          await loadReportsData();
          break;
        case "calendar":
          if (!window.calendarInstance) {
            window.calendarInstance = new Calendar();
          } else {
            await window.calendarInstance.loadEvents();
            window.calendarInstance.render();
          }
          break;
        case "messages":
          if (window.messagingSystem) {
            await window.messagingSystem.loadConversations();
          }
          break;
      }
    } catch (error) {
      console.error("Error in auto-refresh:", error);
    }
  }, 60000);
});
