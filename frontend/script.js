// ---------------------------
// Theme (works on every page)
// ---------------------------
// We keep the theme in localStorage so it persists across refreshes and pages.
// The CSS applies dark mode when <body> has the class "theme-dark".
const LIVE_EVENT_THEME_KEY = "liveEventTheme";

function getSavedTheme() {
  // Default to light mode if nothing has been saved yet.
  return localStorage.getItem(LIVE_EVENT_THEME_KEY) || "light";
}

function applyTheme(theme) {
  // Defensive check: theme should be "light" or "dark".
  const isDark = theme === "dark";
  document.body.classList.toggle("theme-dark", isDark);
}

function setTheme(theme) {
  localStorage.setItem(LIVE_EVENT_THEME_KEY, theme);
  applyTheme(theme);
  updateThemeStatusText();
}

function updateThemeStatusText() {
  const status = document.getElementById("theme-status");
  if (!status) return;

  const theme = getSavedTheme();
  status.textContent =
    theme === "dark"
      ? "Dark mode is enabled."
      : "Light mode is enabled.";
}

// Apply the saved theme as soon as this script runs.
applyTheme(getSavedTheme());

const browseButton = document.getElementById("browse-btn");

if (browseButton) {
  browseButton.addEventListener("click", function () {
    window.location.href = "events.html";
  });
}

const createAccountBtn = document.getElementById("create-account-btn");

if (createAccountBtn) {
  createAccountBtn.addEventListener("click", function () {
    window.location.href = "signup.html";
  });
}

const featuredEventsContainer = document.getElementById("featured-events");
const homeSearchInput = document.getElementById("home-search");
const homeFilterSelect = document.getElementById("home-filter");
const featuredEmptyMessage = document.getElementById("featured-empty");

const featuredHomeEvents = [
  {
    title: "Night Market & Live DJs",
    date: "Sat, May 3 · 8:00 PM",
    location: "Student Union Plaza",
    description:
      "Food trucks, student DJs, and lawn games under the string lights.",
    category: "social"
  },
  {
    title: "48-Hour Build Sprint",
    date: "Fri, May 9 · 9:00 AM",
    location: "Innovation Studio",
    description:
      "Team up, sketch an idea, and ship a demo with mentors on-site.",
    category: "tech"
  },
  {
    title: "Career Coffee Chats",
    date: "Wed, May 14 · 2:00 PM",
    location: "Library Atrium",
    description:
      "Speed-style chats with alumni from design, finance, and tech paths.",
    category: "career"
  }
];

function featuredCategoryLabel(category) {
  const labels = {
    social: "Social",
    tech: "Tech",
    career: "Career",
    outdoor: "Outdoor"
  };
  return labels[category] || category;
}

function applyFeaturedFilters() {
  if (
    !featuredEventsContainer ||
    !homeSearchInput ||
    !homeFilterSelect ||
    !featuredEmptyMessage
  ) {
    return;
  }

  const query = homeSearchInput.value.trim().toLowerCase();
  const category = homeFilterSelect.value;
  const cards = featuredEventsContainer.querySelectorAll("[data-featured-card]");
  let visibleCount = 0;

  cards.forEach(function (card) {
    const cardCategory = card.getAttribute("data-category") || "";
    const matchesCategory =
      category === "all" || cardCategory === category;
    const blob = (card.textContent || "").toLowerCase();
    const matchesSearch = query === "" || blob.includes(query);

    if (matchesCategory && matchesSearch) {
      card.classList.remove("is-hidden");
      visibleCount++;
    } else {
      card.classList.add("is-hidden");
    }
  });

  featuredEmptyMessage.classList.toggle("is-hidden", visibleCount > 0);
}

if (featuredEventsContainer) {
  featuredHomeEvents.forEach(function (event) {
    const card = document.createElement("article");
    card.className = "featured-card";
    card.setAttribute("data-featured-card", "true");
    card.setAttribute("data-category", event.category);

    card.innerHTML =
      "<span class='featured-badge'>" +
      featuredCategoryLabel(event.category) +
      "</span>" +
      "<h3>" +
      event.title +
      "</h3>" +
      "<p class='event-meta'><strong>Date:</strong> " +
      event.date +
      "</p>" +
      "<p class='event-meta'><strong>Location:</strong> " +
      event.location +
      "</p>" +
      "<p class='event-description'>" +
      event.description +
      "</p>" +
      "<button type='button' class='featured-view-btn'>View Details</button>";

    const detailsButton = card.querySelector(".featured-view-btn");
    if (detailsButton) {
      detailsButton.addEventListener("click", function () {
        alert(
          'Demo: details for "' +
            event.title +
            '" would open here (no backend yet).'
        );
      });
    }

    featuredEventsContainer.appendChild(card);
  });

  if (homeSearchInput && homeFilterSelect) {
    homeSearchInput.addEventListener("input", applyFeaturedFilters);
    homeFilterSelect.addEventListener("change", applyFeaturedFilters);
  }

  applyFeaturedFilters();
}

// ---------------------------
// Events page: load from backend
// ---------------------------
// The events page has a container element with id="events-container".
// When that page loads, we:
//   1. Show animated loading "skeleton" cards while the request is in flight.
//   2. Fetch the list of events from the backend API.
//   3. Build a real card per event (title, date, time, location, description,
//      category, RSVP button).
//   4. Show a friendly error state with a "Try again" button if anything
//      goes wrong, and log the technical details to the console.
document.addEventListener("DOMContentLoaded", function () {
  // Look for the events container. If it isn't on the page (because the user
  // is on a different page like Home or Login), we simply do nothing.
  const eventsContainer = document.getElementById("events-container");
  if (!eventsContainer) return;

  // The backend exposes the events list at this URL.
  const EVENTS_API_URL = "http://localhost:3000/api/events";
  // The backend RSVP endpoint. Each click on a card's RSVP button posts here.
  const RSVP_API_URL = "http://localhost:3000/api/rsvp";

  // Real user sessions aren't fully built yet, so for now we hard-code a
  // demo user. Once login is wired up end-to-end we can replace this with
  // the actual logged-in user's id.
  const userId = 1;

  // Helper: escape any characters that have a special meaning in HTML.
  // We use this for any string that comes from the API before placing it
  // inside .innerHTML, so a future event title with "<" or "&" can't break
  // the page.
  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Helper: format a date string from the API ("2026-05-15") into something
  // a little friendlier for humans ("May 15, 2026"). If parsing fails for
  // any reason, we just fall back to the original string.
  function formatEventDate(dateString) {
    if (!dateString) return "";
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) return dateString;
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  // Helper: format a time value ("18:30" or "2026-05-15T18:30:00") into
  // a short human time like "6:30 PM". If parsing fails, return the raw
  // value so we never lose information.
  function formatEventTime(timeString) {
    if (!timeString) return "";

    // Common short form first: "HH:MM" or "HH:MM:SS".
    const shortMatch = /^(\d{1,2}):(\d{2})/.exec(timeString);
    if (shortMatch) {
      const hour = Number(shortMatch[1]);
      const minute = Number(shortMatch[2]);
      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit"
        });
      }
    }

    // Otherwise try to parse it as a full date-time.
    const parsed = new Date(timeString);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit"
      });
    }

    return timeString;
  }

  // Helper: turn a category code ("tech") into a nicer label ("Tech").
  function formatCategoryLabel(category) {
    if (!category) return "";
    const known = {
      social: "Social",
      tech: "Tech",
      career: "Career",
      outdoor: "Outdoor",
      music: "Music",
      sports: "Sports"
    };
    if (known[category]) return known[category];
    // Fallback: capitalize the first letter so unknown categories still
    // look tidy in the badge.
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  // Helper: send an RSVP for the given event to the backend, and update
  // the button based on the response.
  function sendRsvp(rsvpButton, event) {
    // Prevent double-clicks while the request is in flight.
    rsvpButton.disabled = true;
    rsvpButton.textContent = "Saving\u2026";

    fetch(RSVP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: userId,
        eventId: event.id
      })
    })
      .then(function (response) {
        // Read the JSON body either way so we can show the backend's
        // error message when something goes wrong.
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          // Success: update the button so the user sees their RSVP stuck.
          rsvpButton.textContent = "RSVP\u2019d";
          rsvpButton.disabled = true;
          rsvpButton.classList.add("is-rsvped");
          alert("You RSVP\u2019d to this event!");
        } else {
          // Server rejected the RSVP (e.g. unknown user/event). Show its
          // message and re-enable the button so the user can try again.
          const message =
            (result.data && result.data.error) ||
            "Could not RSVP. Please try again.";
          alert(message);
          rsvpButton.disabled = false;
          rsvpButton.textContent = "RSVP";
        }
      })
      .catch(function (error) {
        // Network failure (server down, no internet, etc.).
        console.error("RSVP request failed:", error);
        alert("Could not reach the server. Please try again later.");
        rsvpButton.disabled = false;
        rsvpButton.textContent = "RSVP";
      });
  }

  // Helper: build one event card element from an event object.
  // The card supports title, date, time, location, description, category
  // and an RSVP button. Any field that the backend doesn't send yet is
  // simply skipped, so the same card works for both today's data and the
  // richer data coming later.
  function createEventCard(event) {
    const card = document.createElement("article");
    card.className = "event-card";

    const safeTitle = escapeHtml(event.title);
    const formattedDate = escapeHtml(formatEventDate(event.date));
    const formattedTime = escapeHtml(formatEventTime(event.time));
    const safeLocation = escapeHtml(event.location);
    const safeDescription = escapeHtml(event.description);
    const categoryLabel = escapeHtml(formatCategoryLabel(event.category));

    // Build the inner HTML piece by piece. Optional fields are only
    // included if the backend actually returned them.
    let html = "<div class='event-card-header'>";
    html += "<h3>" + safeTitle + "</h3>";
    if (categoryLabel) {
      html += "<span class='event-card-category'>" + categoryLabel + "</span>";
    }
    html += "</div>";

    html += "<div class='event-card-meta'>";
    if (formattedDate) {
      html +=
        "<p class='event-meta-row'>" +
          "<span class='event-meta-icon' aria-hidden='true'>\uD83D\uDCC5</span>" +
          "<span><strong>Date:</strong> " + formattedDate + "</span>" +
        "</p>";
    }
    if (formattedTime) {
      html +=
        "<p class='event-meta-row'>" +
          "<span class='event-meta-icon' aria-hidden='true'>\u23F0</span>" +
          "<span><strong>Time:</strong> " + formattedTime + "</span>" +
        "</p>";
    }
    if (safeLocation) {
      html +=
        "<p class='event-meta-row'>" +
          "<span class='event-meta-icon' aria-hidden='true'>\uD83D\uDCCD</span>" +
          "<span><strong>Location:</strong> " + safeLocation + "</span>" +
        "</p>";
    }
    html += "</div>";

    if (safeDescription) {
      html += "<p class='event-description'>" + safeDescription + "</p>";
    }

    html += "<button class='rsvp-btn' type='button'>RSVP</button>";

    card.innerHTML = html;

    // Wire the RSVP button up to the backend.
    const rsvpButton = card.querySelector(".rsvp-btn");
    if (rsvpButton) {
      rsvpButton.addEventListener("click", function (clickEvent) {
        // Stop any default behavior just in case (e.g. if a future
        // version puts this button inside a form).
        clickEvent.preventDefault();
        sendRsvp(rsvpButton, event);
      });
    }

    return card;
  }

  // Helper: show animated "skeleton" placeholder cards while we wait for
  // the API. They share the .events-grid layout so the page doesn't jump
  // when the real cards arrive.
  function showLoadingState() {
    const SKELETON_COUNT = 3;
    let html = "";
    for (let i = 0; i < SKELETON_COUNT; i++) {
      html +=
        "<div class='event-card skeleton-card' aria-hidden='true'>" +
          "<div class='skeleton-line title'></div>" +
          "<div class='skeleton-line short'></div>" +
          "<div class='skeleton-line short'></div>" +
          "<div class='skeleton-line long'></div>" +
          "<div class='skeleton-line long'></div>" +
          "<div class='skeleton-line button'></div>" +
        "</div>";
    }
    eventsContainer.innerHTML =
      "<p class='events-loading-text' role='status'>Loading events\u2026</p>" + html;
  }

  // Helper: show a "no events yet" empty state.
  function showEmptyState() {
    eventsContainer.innerHTML =
      "<div class='events-state'>" +
        "<div class='events-state-icon' aria-hidden='true'>\uD83D\uDCC5</div>" +
        "<h3 class='events-state-title'>No events yet</h3>" +
        "<p class='events-state-message'>" +
          "There aren\u2019t any upcoming events right now. " +
          "Check back soon!" +
        "</p>" +
      "</div>";
  }

  // Helper: show a friendly error state with a "Try again" button that
  // re-runs the fetch when clicked.
  function showErrorState() {
    eventsContainer.innerHTML =
      "<div class='events-state is-error'>" +
        "<div class='events-state-icon' aria-hidden='true'>\u26A0\uFE0F</div>" +
        "<h3 class='events-state-title'>We couldn\u2019t load events</h3>" +
        "<p class='events-state-message'>" +
          "Could not load events. Please make sure the backend server is " +
          "running, then try again." +
        "</p>" +
        "<button type='button' class='events-retry-btn'>Try again</button>" +
      "</div>";

    const retryButton = eventsContainer.querySelector(".events-retry-btn");
    if (retryButton) {
      retryButton.addEventListener("click", function () {
        loadEvents();
      });
    }
  }

  // The main loader. Pulled out into a function so the "Try again" button
  // can call it without duplicating logic.
  function loadEvents() {
    // Step 1: show the loading skeletons immediately.
    showLoadingState();

    // Step 2: ask the backend for the list of events.
    fetch(EVENTS_API_URL)
      .then(function (response) {
        // If the server responded with an error status, throw so the
        // .catch() block below handles it like any other failure.
        if (!response.ok) {
          throw new Error("Request failed with status " + response.status);
        }
        return response.json();
      })
      .then(function (events) {
        // Step 3: replace the loading skeletons with real cards.
        eventsContainer.innerHTML = "";

        if (!Array.isArray(events) || events.length === 0) {
          showEmptyState();
          return;
        }

        events.forEach(function (event) {
          const card = createEventCard(event);
          eventsContainer.appendChild(card);
        });
      })
      .catch(function (error) {
        // Step 4: log the technical details for developers, and show a
        // simple, friendly state to the user with a retry button.
        console.error("Failed to load events:", error);
        showErrorState();
      });
  }

  // Kick everything off.
  loadEvents();
});

// ---------------------------
// Login page: send credentials to backend
// ---------------------------
// When the user submits the login form, we POST their email and password
// to the backend. If the backend confirms the credentials, we send the
// user to the events page; otherwise we show whatever error message the
// backend returned.
document.addEventListener("DOMContentLoaded", function () {
  // Find the login form and inputs. If we're not on the login page, stop.
  const loginForm = document.getElementById("login-form");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");

  if (!loginForm || !loginEmail || !loginPassword) {
    return;
  }

  // The backend login endpoint.
  const LOGIN_API_URL = "http://localhost:3000/api/login";

  loginForm.addEventListener("submit", function (event) {
    // Stop the browser from doing the default form submit (which reloads).
    event.preventDefault();

    // Step 1: read what the user typed.
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    // Step 2: simple client-side check before hitting the network.
    if (email === "" || password === "") {
      alert("Please fill all fields");
      return;
    }

    // Step 3: send the credentials to the backend as JSON.
    // The backend expects: { email, password }
    fetch(LOGIN_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    })
      .then(function (response) {
        // Read the JSON body whether the request succeeded or failed,
        // so we can show the backend's error message when needed.
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          // Step 4a: success. Remember a simple "logged in" flag and
          // send the user to the events page.
          localStorage.setItem("liveEventLoggedIn", "true");
          alert("Login successful");
          window.location.href = "events.html";
        } else {
          // Step 4b: the server rejected the login (e.g. wrong password).
          // Show its message to the user.
          const message =
            (result.data && result.data.error) ||
            "Login failed. Please try again.";
          alert(message);
        }
      })
      .catch(function (error) {
        // Step 5: network failure (server down, no internet, etc.).
        console.error("Login request failed:", error);
        alert("Could not reach the server. Please try again later.");
      });
  });
});

// ---------------------------
// Signup page: send new account to backend
// ---------------------------
// When the user submits the signup form, we send their info to the backend
// API instead of just pretending it worked. The backend will create the
// account (or return an error like "email already registered") and we react
// based on the response.
document.addEventListener("DOMContentLoaded", function () {
  // Find the signup form and its input fields. If the form isn't on this
  // page (because the user is on Home, Events, etc.), we just stop here.
  const signupForm = document.getElementById("signup-form");
  const signupFullname = document.getElementById("signup-fullname");
  const signupEmailField = document.getElementById("signup-email");
  const signupPasswordField = document.getElementById("signup-password");
  const signupConfirmField = document.getElementById("signup-confirm");

  if (
    !signupForm ||
    !signupFullname ||
    !signupEmailField ||
    !signupPasswordField ||
    !signupConfirmField
  ) {
    return;
  }

  // The backend signup endpoint.
  const SIGNUP_API_URL = "http://localhost:3000/api/signup";

  signupForm.addEventListener("submit", function (event) {
    // Stop the browser from doing its default form submit (which would
    // reload the page).
    event.preventDefault();

    // Step 1: read the values the user typed in.
    const fullName = signupFullname.value.trim();
    const email = signupEmailField.value.trim();
    const password = signupPasswordField.value;
    const confirmPassword = signupConfirmField.value;

    // Step 2: simple client-side checks before we even hit the network.
    if (
      fullName === "" ||
      email === "" ||
      password === "" ||
      confirmPassword === ""
    ) {
      alert("Please fill all fields");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    // Step 3: send the data to the backend as JSON.
    // The backend expects: { name, email, password }
    fetch(SIGNUP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: fullName,
        email: email,
        password: password
      })
    })
      .then(function (response) {
        // Try to read the JSON body either way (success or error) so we
        // can show the backend's error message when something goes wrong.
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          // Step 4a: success path. Tell the user and send them to login.
          alert("Account created successfully");
          window.location.href = "login.html";
        } else {
          // Step 4b: the server responded but rejected the signup
          // (e.g. duplicate email or missing fields). Show its message.
          const message =
            (result.data && result.data.error) ||
            "Sign up failed. Please try again.";
          alert(message);
        }
      })
      .catch(function (error) {
        // Step 5: network failure (server down, no internet, etc.).
        console.error("Signup request failed:", error);
        alert("Could not reach the server. Please try again later.");
      });
  });
});

const profileForm = document.getElementById("profile-form");
const profileFullName = document.getElementById("profile-fullname");
const profileBio = document.getElementById("profile-bio");
const profileInterests = document.getElementById("profile-interests");
const profileSchool = document.getElementById("profile-school");
const profileLocation = document.getElementById("profile-location");

if (
  profileForm &&
  profileFullName &&
  profileBio &&
  profileInterests &&
  profileSchool &&
  profileLocation
) {
  profileForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const fullName = profileFullName.value.trim();
    const bio = profileBio.value.trim();
    const interests = profileInterests.value.trim();
    const school = profileSchool.value.trim();
    const location = profileLocation.value.trim();

    if (
      fullName === "" ||
      bio === "" ||
      interests === "" ||
      school === "" ||
      location === ""
    ) {
      alert("Please fill all fields");
      return;
    }

    alert("Profile saved (demo)");
    localStorage.setItem("liveEventProfileReady", "true");
    window.location.href = "events.html";
  });
}

// ---------------------------
// Settings page interactions
// ---------------------------

// Appearance buttons
const themeLightBtn = document.getElementById("theme-light-btn");
const themeDarkBtn = document.getElementById("theme-dark-btn");

if (themeLightBtn) {
  themeLightBtn.addEventListener("click", function () {
    setTheme("light");
  });
}

if (themeDarkBtn) {
  themeDarkBtn.addEventListener("click", function () {
    setTheme("dark");
  });
}

// If we're on the settings page, show the initial theme status text.
updateThemeStatusText();

// Helper to load/save a checkbox toggle using localStorage.
function bindToggleToLocalStorage(elementId, storageKey, defaultValue) {
  const toggle = document.getElementById(elementId);
  if (!toggle) return;

  const saved = localStorage.getItem(storageKey);
  if (saved === null) {
    toggle.checked = Boolean(defaultValue);
  } else {
    toggle.checked = saved === "true";
  }

  toggle.addEventListener("change", function () {
    localStorage.setItem(storageKey, String(toggle.checked));
  });
}

// Notifications
bindToggleToLocalStorage("notif-email", "liveEventNotifEmail", true);
bindToggleToLocalStorage("notif-reminders", "liveEventNotifReminders", true);
bindToggleToLocalStorage("notif-campus", "liveEventNotifCampusUpdates", false);

// Privacy
bindToggleToLocalStorage("privacy-public-profile", "liveEventPrivacyPublicProfile", true);
bindToggleToLocalStorage("privacy-show-interests", "liveEventPrivacyShowInterests", true);

// Apply the "Show interests" privacy setting on the profile page.
// This is still a demo, but it demonstrates how a setting can affect other pages.
const showInterestsSetting = localStorage.getItem("liveEventPrivacyShowInterests");
const profileInterestsField = document.getElementById("profile-interests");
if (profileInterestsField && showInterestsSetting === "false") {
  // Hide the entire field row if the user chose not to show interests.
  const wrapper = profileInterestsField.closest(".form-field");
  if (wrapper) wrapper.style.display = "none";
}

// Password reset / change (demo)
const passwordForm = document.getElementById("password-form");
const currentPasswordInput = document.getElementById("current-password");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const passwordMessage = document.getElementById("password-message");

function showSettingsMessage(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove("is-success", "is-error");
  if (type === "success") element.classList.add("is-success");
  if (type === "error") element.classList.add("is-error");
}

if (
  passwordForm &&
  currentPasswordInput &&
  newPasswordInput &&
  confirmPasswordInput &&
  passwordMessage
) {
  passwordForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const currentPassword = currentPasswordInput.value.trim();
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (currentPassword === "" || newPassword === "" || confirmPassword === "") {
      showSettingsMessage(passwordMessage, "Please fill all password fields.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showSettingsMessage(passwordMessage, "New password and confirmation do not match.", "error");
      return;
    }

    // Demo success: in a real app, you'd send this to a backend.
    showSettingsMessage(passwordMessage, "Password updated successfully (demo).", "success");
    passwordForm.reset();
  });
}

// Danger zone: delete account (simulated)
const deleteAccountBtn = document.getElementById("delete-account-btn");
const deleteMessage = document.getElementById("delete-message");

if (deleteAccountBtn && deleteMessage) {
  deleteAccountBtn.addEventListener("click", function () {
    const confirmed = confirm(
      "Are you sure you want to delete your account? This is a demo and will only clear localStorage values."
    );

    if (!confirmed) return;

    // Clear demo "account" and settings data.
    const keysToRemove = [
      "liveEventLoggedIn",
      "liveEventProfileReady",
      LIVE_EVENT_THEME_KEY,
      "liveEventNotifEmail",
      "liveEventNotifReminders",
      "liveEventNotifCampusUpdates",
      "liveEventPrivacyPublicProfile",
      "liveEventPrivacyShowInterests"
    ];

    keysToRemove.forEach(function (key) {
      localStorage.removeItem(key);
    });

    // After clearing, fall back to light mode visually.
    applyTheme(getSavedTheme());

    showSettingsMessage(
      deleteMessage,
      "Account deleted (simulated). Demo data was cleared from localStorage — no server changes were made.",
      "success"
    );
  });
}
