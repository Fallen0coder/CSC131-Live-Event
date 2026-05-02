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
// When that page loads, we fetch the list of events from the backend API
// and build one card per event. If the request fails, we show a friendly
// error message and log details to the console for debugging.
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

  // Helper: format a date string from the API ("2026-05-15") into something
  // a little friendlier for humans ("May 15, 2026"). If parsing fails for
  // any reason, we just fall back to the original string.
  function formatEventDate(dateString) {
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) return dateString;
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  // Helper: send an RSVP for the given event to the backend, and update
  // the button based on the response.
  function sendRsvp(rsvpButton, event) {
    // Prevent double-clicks while the request is in flight.
    rsvpButton.disabled = true;

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
          alert("You RSVP\u2019d to this event!");
        } else {
          // Server rejected the RSVP (e.g. unknown user/event). Show its
          // message and re-enable the button so the user can try again.
          const message =
            (result.data && result.data.error) ||
            "Could not RSVP. Please try again.";
          alert(message);
          rsvpButton.disabled = false;
        }
      })
      .catch(function (error) {
        // Network failure (server down, no internet, etc.).
        console.error("RSVP request failed:", error);
        alert("Could not reach the server. Please try again later.");
        rsvpButton.disabled = false;
      });
  }

  // Helper: build one event card element from an event object.
  function createEventCard(event) {
    const card = document.createElement("article");
    card.className = "event-card";

    card.innerHTML =
      "<h3>" + event.title + "</h3>" +
      "<p class='event-meta'><strong>Date:</strong> " +
        formatEventDate(event.date) + "</p>" +
      "<p class='event-meta'><strong>Location:</strong> " +
        event.location + "</p>" +
      "<button class='rsvp-btn' type='button'>RSVP</button>";

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

  // Helper: show an error message inside the events container.
  function showErrorMessage(message) {
    eventsContainer.innerHTML =
      "<p class='events-error'>" + message + "</p>";
  }

  // Step 1: ask the backend for the list of events.
  fetch(EVENTS_API_URL)
    .then(function (response) {
      // Step 2: if the server responded with an error status, throw so the
      // .catch() block below handles it like any other failure.
      if (!response.ok) {
        throw new Error("Request failed with status " + response.status);
      }
      return response.json();
    })
    .then(function (events) {
      // Step 3: clear anything currently in the container (just in case)
      // and add one card per event returned by the API.
      eventsContainer.innerHTML = "";

      if (!Array.isArray(events) || events.length === 0) {
        eventsContainer.innerHTML =
          "<p class='events-empty'>No events to show right now.</p>";
        return;
      }

      events.forEach(function (event) {
        const card = createEventCard(event);
        eventsContainer.appendChild(card);
      });
    })
    .catch(function (error) {
      // Step 4: log the technical details for developers, and show a
      // simple, friendly message to the user.
      console.error("Failed to load events:", error);
      showErrorMessage("Could not load events.");
    });
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
