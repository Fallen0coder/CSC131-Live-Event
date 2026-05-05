// ===========================================================================
// Live Event - frontend script
// ---------------------------------------------------------------------------
// Beginner-friendly notes:
// - This file runs on every page (it's loaded by every HTML file).
// - We use small "if (element)" guards so code that only belongs on one page
//   (like the signup form code) just does nothing on the other pages.
// - All user data is stored in localStorage for now (no real backend).
// ===========================================================================


// ===========================================================================
// 1) THEME (works on every page)
// ===========================================================================
// We keep the theme in localStorage so it persists across refreshes/pages.
// The CSS applies dark mode when <body> has the class "theme-dark".
const LIVE_EVENT_THEME_KEY = "liveEventTheme";

function getSavedTheme() {
  return localStorage.getItem(LIVE_EVENT_THEME_KEY) || "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("theme-dark", isDark);
  // Update the glow indicator on the theme buttons (settings page only).
  highlightSelectedThemeButton(theme);
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
    theme === "dark" ? "Dark mode is enabled." : "Light mode is enabled.";
}

// Add the "is-selected" class to whichever theme button matches the current
// theme. CSS handles the actual glow effect.
function highlightSelectedThemeButton(theme) {
  const lightBtn = document.getElementById("theme-light-btn");
  const darkBtn = document.getElementById("theme-dark-btn");
  if (lightBtn) lightBtn.classList.toggle("is-selected", theme === "light");
  if (darkBtn) darkBtn.classList.toggle("is-selected", theme === "dark");
}

// Apply the saved theme as soon as this script runs (avoids "flash" of wrong theme).
applyTheme(getSavedTheme());


// ===========================================================================
// 2) ACCESSIBILITY MODES (apply on every page)
// ===========================================================================
// Each one toggles a class on <body>. CSS handles the actual visual change.
const A11Y_REDUCE_MOTION_KEY = "liveEventA11yReduceMotion";
const A11Y_LARGE_TEXT_KEY = "liveEventA11yLargeText";
const A11Y_HIGH_CONTRAST_KEY = "liveEventA11yHighContrast";

function applyA11ySettings() {
  document.body.classList.toggle(
    "a11y-reduce-motion",
    localStorage.getItem(A11Y_REDUCE_MOTION_KEY) === "true"
  );
  document.body.classList.toggle(
    "a11y-large-text",
    localStorage.getItem(A11Y_LARGE_TEXT_KEY) === "true"
  );
  document.body.classList.toggle(
    "a11y-high-contrast",
    localStorage.getItem(A11Y_HIGH_CONTRAST_KEY) === "true"
  );
}
applyA11ySettings();


// ===========================================================================
// 3) AUTH HELPERS (login state lives in localStorage)
// ===========================================================================
const LOGGED_IN_KEY = "isLoggedIn";
const CURRENT_USER_KEY = "liveEventCurrentUser"; // JSON of the logged-in user
const USERS_KEY = "liveEventUsers";              // JSON array of all signed-up users

function isLoggedIn() {
  return localStorage.getItem(LOGGED_IN_KEY) === "true";
}

function getAllUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Could not parse stored users:", e);
    return [];
  }
}

function saveAllUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  localStorage.setItem(LOGGED_IN_KEY, "true");
}

function logout() {
  localStorage.removeItem(LOGGED_IN_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  window.location.href = "index.html";
}

// Update the navbar so that Profile/Friends/Login/Logout match the current
// login state.
// - Profile link is only shown when the user is logged in.
// - Friends link is only shown when the user is logged in.
// - Login link is hidden when logged in (they don't need it anymore).
// - Logout button is shown only when logged in.
function refreshNavAuthVisibility() {
  const loggedIn = isLoggedIn();

  const profileLi = document.getElementById("profile-link");
  if (profileLi) profileLi.classList.toggle("is-hidden", !loggedIn);

  const friendsLi = document.getElementById("friends-link");
  if (friendsLi) friendsLi.classList.toggle("is-hidden", !loggedIn);

  const loginLi = document.getElementById("login-link");
  if (loginLi) loginLi.classList.toggle("is-hidden", loggedIn);

  const logoutLi = document.getElementById("nav-logout-li");
  if (logoutLi) logoutLi.classList.toggle("is-hidden", !loggedIn);

  // Homepage: hide the "Create Account" hero button when the user is
  // already logged in (they don't need to create another account).
  const createAccountBtn = document.getElementById("create-account-btn");
  if (createAccountBtn) {
    createAccountBtn.style.display = loggedIn ? "none" : "";
  }
}

// Backwards-compatible alias in case anything else still calls the old name.
function refreshNavLogoutVisibility() {
  refreshNavAuthVisibility();
}

document.addEventListener("DOMContentLoaded", function () {
  refreshNavAuthVisibility();
  const navLogoutBtn = document.getElementById("nav-logout-btn");
  if (navLogoutBtn) {
    navLogoutBtn.addEventListener("click", logout);
  }
});

// Keep nav in sync if another tab logs in/out.
window.addEventListener("storage", function (event) {
  if (event.key === LOGGED_IN_KEY) {
    refreshNavAuthVisibility();
  }
});


// ===========================================================================
// 4) HOMEPAGE: hero buttons + featured event filter
// ===========================================================================
const browseButton = document.getElementById("browse-btn");
if (browseButton) {
  browseButton.addEventListener("click", function () {
    window.location.href = "events.html";
  });
}

const createAccountBtn = document.getElementById("create-account-btn");
if (createAccountBtn) {
  createAccountBtn.addEventListener("click", function () {
    // If they're already logged in, send them to their profile instead.
    window.location.href = isLoggedIn() ? "profile.html" : "signup.html";
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
    const matchesCategory = category === "all" || cardCategory === category;
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


// ===========================================================================
// 5) EVENTS PAGE: load from backend (unchanged from original)
// ===========================================================================
document.addEventListener("DOMContentLoaded", function () {
  const eventsContainer = document.getElementById("events-container");
  if (!eventsContainer) return;

  const EVENTS_API_URL = "http://localhost:3000/api/events";
  const RSVP_API_URL = "http://localhost:3000/api/rsvp";

  // Real user sessions aren't fully built yet. The backend only knows about
  // its seeded demo users (ids 1 and 2). If the logged-in user matches one
  // of those, use their id; otherwise fall back to user 1 so the RSVP demo
  // still works for a freshly-signed-up local account.
  const currentUser = getCurrentUser();
  const userId =
    currentUser && (currentUser.id === 1 || currentUser.id === 2)
      ? currentUser.id
      : 1;

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

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

  function formatEventTime(timeString) {
    if (!timeString) return "";
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
    const parsed = new Date(timeString);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit"
      });
    }
    return timeString;
  }

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
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  function sendRsvp(rsvpButton, event) {
    rsvpButton.disabled = true;
    rsvpButton.textContent = "Saving\u2026";

    fetch(RSVP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId, eventId: event.id })
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          rsvpButton.textContent = "RSVP\u2019d";
          rsvpButton.disabled = true;
          rsvpButton.classList.add("is-rsvped");
          alert("You RSVP\u2019d to this event!");
        } else {
          const message =
            (result.data && result.data.error) ||
            "Could not RSVP. Please try again.";
          alert(message);
          rsvpButton.disabled = false;
          rsvpButton.textContent = "RSVP";
        }
      })
      .catch(function (error) {
        console.error("RSVP request failed:", error);
        alert("Could not reach the server. Please try again later.");
        rsvpButton.disabled = false;
        rsvpButton.textContent = "RSVP";
      });
  }

  function createEventCard(event) {
    const card = document.createElement("article");
    card.className = "event-card";

    const safeTitle = escapeHtml(event.title);
    const formattedDate = escapeHtml(formatEventDate(event.date));
    const formattedTime = escapeHtml(formatEventTime(event.time));
    const safeLocation = escapeHtml(event.location);
    const safeDescription = escapeHtml(event.description);
    const categoryLabel = escapeHtml(formatCategoryLabel(event.category));

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

    const rsvpButton = card.querySelector(".rsvp-btn");
    if (rsvpButton) {
      rsvpButton.addEventListener("click", function (clickEvent) {
        clickEvent.preventDefault();
        sendRsvp(rsvpButton, event);
      });
    }
    return card;
  }

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

  function showEmptyState() {
    eventsContainer.innerHTML =
      "<div class='events-state'>" +
        "<div class='events-state-icon' aria-hidden='true'>\uD83D\uDCC5</div>" +
        "<h3 class='events-state-title'>No events yet</h3>" +
        "<p class='events-state-message'>" +
          "There aren\u2019t any upcoming events right now. Check back soon!" +
        "</p>" +
      "</div>";
  }

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

  function loadEvents() {
    showLoadingState();
    fetch(EVENTS_API_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Request failed with status " + response.status);
        }
        return response.json();
      })
      .then(function (events) {
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
        console.error("Failed to load events:", error);
        showErrorState();
      });
  }

  loadEvents();
});


// ===========================================================================
// 6) LOGIN PAGE  (calls the backend /api/login)
// ---------------------------------------------------------------------------
// Sends the email + password to the backend, which checks the bcrypt hash.
// On success, stores the returned user in localStorage and redirects to the
// profile page.
// ===========================================================================
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("login-form");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const loginMessage = document.getElementById("login-message");
  if (!loginForm || !loginEmail || !loginPassword) return;

  const LOGIN_API_URL = "http://localhost:3000/api/login";

  function showMsg(text, type) {
    if (!loginMessage) {
      alert(text);
      return;
    }
    loginMessage.textContent = text;
    loginMessage.classList.remove("is-success", "is-error");
    if (type) loginMessage.classList.add("is-" + type);
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = loginEmail.value.trim().toLowerCase();
    const password = loginPassword.value;

    if (email === "" || password === "") {
      showMsg("Please fill in both email and password.", "error");
      return;
    }

    showMsg("Logging in\u2026", "info");

    fetch(LOGIN_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    })
      .then(function (response) {
        // Always read the JSON body so we can surface the server's error
        // message verbatim (e.g. "Invalid email or password.").
        return response
          .json()
          .then(function (data) {
            return { ok: response.ok, data: data };
          })
          .catch(function () {
            return { ok: response.ok, data: {} };
          });
      })
      .then(function (result) {
        if (!result.ok) {
          const message =
            (result.data && result.data.error) || "Invalid email or password.";
          showMsg(message, "error");
          return;
        }

        const user = (result.data && result.data.user) || {};

        // Save the logged-in user. We keep the field name `fullName` for
        // the rest of the app, mapping it from the backend's `name` field.
        setCurrentUser({
          id: user.id,
          fullName: user.name,
          username: user.username,
          email: user.email
        });
        localStorage.setItem("username", user.username);

        showMsg("Login successful! Redirecting\u2026", "success");
        setTimeout(function () {
          window.location.href = "profile.html";
        }, 400);
      })
      .catch(function (error) {
        console.error("POST /api/login failed:", error);
        showMsg(
          "Could not reach the server. Please try again later.",
          "error"
        );
      });
  });
});


// ===========================================================================
// 7) SIGNUP PAGE  (calls the backend /api/signup)
// ---------------------------------------------------------------------------
// Sends the new account to the backend, which hashes the password and
// enforces unique email + unique (case-insensitive) username. On success,
// stores the returned user in localStorage and redirects to the profile
// page so the user can fill in details/hobbies.
// ===========================================================================
document.addEventListener("DOMContentLoaded", function () {
  const signupForm = document.getElementById("signup-form");
  const fullNameInput = document.getElementById("signup-fullname");
  const usernameInput = document.getElementById("signup-username");
  const emailInput = document.getElementById("signup-email");
  const passwordInput = document.getElementById("signup-password");
  const confirmInput = document.getElementById("signup-confirm");
  const signupMessage = document.getElementById("signup-message");

  if (
    !signupForm ||
    !fullNameInput ||
    !usernameInput ||
    !emailInput ||
    !passwordInput ||
    !confirmInput
  ) {
    return;
  }

  const SIGNUP_API_URL = "http://localhost:3000/api/signup";

  function showMsg(text, type) {
    if (!signupMessage) {
      alert(text);
      return;
    }
    signupMessage.textContent = text;
    signupMessage.classList.remove("is-success", "is-error");
    if (type) signupMessage.classList.add("is-" + type);
  }

  signupForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const fullName = fullNameInput.value.trim();
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (
      fullName === "" ||
      username === "" ||
      email === "" ||
      password === "" ||
      confirmPassword === ""
    ) {
      showMsg("Please fill in every field.", "error");
      return;
    }

    if (password.length < 6) {
      showMsg("Password should be at least 6 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showMsg("Passwords do not match.", "error");
      return;
    }

    showMsg("Creating account\u2026", "info");

    fetch(SIGNUP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fullName,
        username: username,
        email: email,
        password: password
      })
    })
      .then(function (response) {
        // Always read the JSON body so we can surface the backend's exact
        // error message (e.g. "Username is already taken.",
        // "That email is already registered.").
        return response
          .json()
          .then(function (data) {
            return { ok: response.ok, data: data };
          })
          .catch(function () {
            return { ok: response.ok, data: {} };
          });
      })
      .then(function (result) {
        if (!result.ok) {
          const message =
            (result.data && result.data.error) || "Could not create account.";
          showMsg(message, "error");
          return;
        }

        const user = (result.data && result.data.user) || {};

        // Save the logged-in user. The backend returns `name`, but the
        // rest of the app uses `fullName` — map it here.
        setCurrentUser({
          id: user.id,
          fullName: user.name,
          username: user.username,
          email: user.email
        });
        localStorage.setItem("username", user.username);

        showMsg("Account created! Redirecting to your profile\u2026", "success");
        setTimeout(function () {
          window.location.href = "profile.html";
        }, 500);
      })
      .catch(function (error) {
        console.error("POST /api/signup failed:", error);
        showMsg(
          "Could not reach the server. Please try again later.",
          "error"
        );
      });
  });
});


// ===========================================================================
// 8) PROFILE PAGE
// ---------------------------------------------------------------------------
// - Loads profile data from localStorage on page load.
// - Renders the read-only "display" view by default.
// - "Edit profile" swaps to inputs (CSS handles the visual swap via the
//   body.is-editing-profile class).
// - "Save profile" persists to localStorage and re-renders the display.
// - Hobby chips are rendered from a static list of 100+ options. The user
//   can pick up to 8.
// ===========================================================================
const HOBBIES_LIST = [
  "Basketball","Soccer","Football","Baseball","Volleyball","Tennis","Running",
  "Gym","Yoga","Hiking","Camping","Skateboarding","Biking","Swimming",
  "Rock Music","Rap","Hip-Hop","R&B","Pop","Country","Jazz","EDM","Concerts",
  "Festivals","Karaoke","Dancing","DJ Sets","Guitar","Piano","Drums","Singing",
  "Anime","Gaming","Board Games","Chess","Movies","Horror","Comedy","Action",
  "Documentaries","Netflix","YouTube","TikTok","Photography","Videography",
  "Editing","Drawing","Painting","Digital Art","Fashion","Sneakers","Makeup",
  "Hair Styling","Thrifting","Cooking","Baking","Sushi","Pizza","Tacos",
  "Coffee","Boba","Burgers","BBQ","Vegan Food","Spicy Food","Desserts",
  "Reading","Writing","Coding","AI","Business","Marketing","Finance",
  "Investing","Entrepreneurship","Volunteering","Student Clubs","Networking",
  "Career Events","Study Groups","Museums","Art Shows","Theater",
  "Stand-up Comedy","Cars","Travel","Road Trips","Beach","Picnics","Dogs",
  "Cats","Gardening","Meditation","Astrology","Podcasts","Fitness Classes",
  "Parties","Campus Events","Food Trucks","Arcades","Bowling","Escape Rooms",
  "Trivia"
];
const MAX_HOBBIES = 8;
const PROFILE_KEY = "liveEventProfile";

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not parse stored profile:", e);
  }
  // Fall back to the logged-in user's basics if no profile saved yet.
  const user = getCurrentUser();
  return {
    fullName: (user && user.fullName) || "",
    username: (user && user.username) || "",
    email: (user && user.email) || "",
    school: "",
    location: "",
    bio: "",
    hobbies: []
  };
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

document.addEventListener("DOMContentLoaded", function () {
  const profileMain = document.querySelector(".profile-main");
  if (!profileMain) return; // Not on the profile page.

  const editBtn = document.getElementById("profile-edit-btn");
  const saveBtn = document.getElementById("profile-save-btn");
  const cancelBtn = document.getElementById("profile-cancel-btn");
  const messageEl = document.getElementById("profile-message");

  // Edit-mode inputs
  const inFullName = document.getElementById("profile-fullname");
  const inUsername = document.getElementById("profile-username");
  const inEmail = document.getElementById("profile-email");
  const inSchool = document.getElementById("profile-school");
  const inLocation = document.getElementById("profile-location");
  const inBio = document.getElementById("profile-bio");

  // Display elements
  const displayFullName = document.getElementById("display-fullname");
  const displayFullName2 = document.getElementById("display-fullname-2");
  const displayUsername = document.getElementById("display-username");
  const displayUsername2 = document.getElementById("display-username-2");
  const displayEmail = document.getElementById("display-email");
  const displaySchool = document.getElementById("display-school");
  const displaySchoolMeta = document.getElementById("display-school-meta");
  const displayLocation = document.getElementById("display-location");
  const displayLocationMeta = document.getElementById("display-location-meta");
  const displayBio = document.getElementById("display-bio");
  const displayHobbies = document.getElementById("display-hobbies");
  const displayHobbiesEmpty = document.getElementById("display-hobbies-empty");
  const avatarEl = document.getElementById("profile-avatar");

  // Hobby chip selector
  const hobbyGrid = document.getElementById("hobby-grid");
  const hobbyCounter = document.getElementById("hobby-counter");

  // We keep a working copy of the selected hobbies while in edit mode so
  // "Cancel" can throw away unsaved changes.
  let workingHobbies = [];

  function setMessage(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text || "";
    messageEl.classList.remove("is-success", "is-error");
    if (type) messageEl.classList.add("is-" + type);
  }

  function setText(el, value, fallback) {
    if (!el) return;
    if (value && String(value).trim() !== "") {
      el.textContent = value;
      el.classList.remove("is-empty");
    } else {
      el.textContent = fallback;
      el.classList.add("is-empty");
    }
  }

  function renderDisplay(profile) {
    setText(displayFullName, profile.fullName, "Your Name");
    setText(displayFullName2, profile.fullName, "Not set");
    const usernameStr = profile.username ? "@" + profile.username : "@username";
    setText(displayUsername, usernameStr, "@username");
    setText(
      displayUsername2,
      profile.username ? "@" + profile.username : "",
      "Not set"
    );
    setText(displayEmail, profile.email, "Not set");
    setText(displaySchool, profile.school, "Not set");
    setText(displayLocation, profile.location, "Not set");
    setText(displaySchoolMeta, profile.school, "School not set");
    setText(displayLocationMeta, profile.location, "Location not set");
    setText(displayBio, profile.bio, "Tell others a little about yourself.");

    // Avatar = first letter of full name (or "U")
    if (avatarEl) {
      const initial =
        (profile.fullName || profile.username || "U").trim().charAt(0) || "U";
      avatarEl.textContent = initial.toUpperCase();
    }

    // Render hobby pills
    if (displayHobbies) {
      displayHobbies.innerHTML = "";
      const hobbies = Array.isArray(profile.hobbies) ? profile.hobbies : [];
      if (hobbies.length === 0) {
        if (displayHobbiesEmpty) displayHobbiesEmpty.classList.remove("is-hidden");
      } else {
        if (displayHobbiesEmpty) displayHobbiesEmpty.classList.add("is-hidden");
        hobbies.forEach(function (name) {
          const span = document.createElement("span");
          span.className = "hobby-pill";
          span.textContent = name;
          displayHobbies.appendChild(span);
        });
      }
    }

    // Honor the "show hobbies" privacy toggle (from settings).
    const showHobbies = localStorage.getItem("liveEventPrivacyShowHobbies");
    const hobbiesCard = displayHobbies && displayHobbies.closest(".profile-card-block");
    if (hobbiesCard && showHobbies === "false") {
      hobbiesCard.style.display = "none";
    }
  }

  function fillEditInputs(profile) {
    if (inFullName) inFullName.value = profile.fullName || "";
    if (inUsername) inUsername.value = profile.username || "";
    if (inEmail) inEmail.value = profile.email || "";
    if (inSchool) inSchool.value = profile.school || "";
    if (inLocation) inLocation.value = profile.location || "";
    if (inBio) inBio.value = profile.bio || "";

    workingHobbies = Array.isArray(profile.hobbies) ? profile.hobbies.slice() : [];
    renderHobbyChips();
  }

  function renderHobbyChips() {
    if (!hobbyGrid) return;
    hobbyGrid.innerHTML = "";

    HOBBIES_LIST.forEach(function (hobby) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hobby-chip";
      btn.textContent = hobby;
      btn.setAttribute("data-hobby", hobby);

      const isSelected = workingHobbies.indexOf(hobby) !== -1;
      if (isSelected) btn.classList.add("is-selected");

      // Visually disable unselected chips when we're at the cap.
      if (!isSelected && workingHobbies.length >= MAX_HOBBIES) {
        btn.classList.add("is-disabled");
      }

      btn.addEventListener("click", function () {
        toggleHobby(hobby);
      });

      hobbyGrid.appendChild(btn);
    });

    updateHobbyCounter();
  }

  function toggleHobby(hobby) {
    const idx = workingHobbies.indexOf(hobby);
    if (idx !== -1) {
      // Always allow deselect.
      workingHobbies.splice(idx, 1);
    } else {
      // Block selecting more than the max.
      if (workingHobbies.length >= MAX_HOBBIES) {
        setMessage(
          "You can only pick " + MAX_HOBBIES + " hobbies. Deselect one first.",
          "error"
        );
        return;
      }
      workingHobbies.push(hobby);
      setMessage("", "");
    }
    renderHobbyChips();
  }

  function updateHobbyCounter() {
    if (!hobbyCounter) return;
    hobbyCounter.textContent = workingHobbies.length + "/" + MAX_HOBBIES + " selected";
    hobbyCounter.classList.toggle("is-full", workingHobbies.length >= MAX_HOBBIES);
  }

  function enterEditMode() {
    document.body.classList.add("is-editing-profile");
    fillEditInputs(loadProfile());
    setMessage("", "");
  }

  function exitEditMode() {
    document.body.classList.remove("is-editing-profile");
  }

  function handleSave() {
    const profile = {
      fullName: (inFullName && inFullName.value.trim()) || "",
      username: (inUsername && inUsername.value.trim()) || "",
      email: (inEmail && inEmail.value.trim()) || "",
      school: (inSchool && inSchool.value.trim()) || "",
      location: (inLocation && inLocation.value.trim()) || "",
      bio: (inBio && inBio.value.trim()) || "",
      hobbies: workingHobbies.slice()
    };

    if (profile.fullName === "" || profile.username === "") {
      setMessage("Full name and username are required.", "error");
      return;
    }

    saveProfile(profile);

    // Also keep the "current user" header info in sync.
    const current = getCurrentUser();
    if (current) {
      current.fullName = profile.fullName;
      current.username = profile.username;
      current.email = profile.email;
      setCurrentUser(current);
    }

    renderDisplay(profile);
    exitEditMode();
    setMessage("Profile saved.", "success");
  }

  // Wire up the buttons.
  if (editBtn) editBtn.addEventListener("click", enterEditMode);
  if (saveBtn) saveBtn.addEventListener("click", handleSave);
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () {
      exitEditMode();
      setMessage("", "");
    });
  }

  // Initial render.
  const initial = loadProfile();
  renderDisplay(initial);
  // Pre-populate the edit inputs too so opening "Edit" feels instant.
  fillEditInputs(initial);
});


// ===========================================================================
// 8b) PROFILE PAGE: user search ("Find people")
// ---------------------------------------------------------------------------
// Lets the user type a username on the profile page and see matching public
// profiles from the backend (GET /api/users/search?username=...).
// - Calls the backend with fetch().
// - Builds result cards safely using textContent (so usernames/bios with
//   special characters like <, &, etc. can never inject HTML).
// - Shows "No users found" when the API returns an empty array.
// - Logs and surfaces a friendly message if the request fails.
// - The "Add Friend" button POSTs to /api/friends/request to actually
//   create the request on the backend, and mirrors successful requests
//   into localStorage (`liveEventOutgoingFriendRequests`) so the Friends
//   page's Outgoing section picks them up automatically.
// ===========================================================================
document.addEventListener("DOMContentLoaded", function () {
  const searchForm = document.getElementById("user-search-form");
  const searchInput = document.getElementById("user-search-input");
  const searchButton = document.getElementById("user-search-btn");
  const resultsContainer = document.getElementById("user-search-results");
  const messageEl = document.getElementById("user-search-message");

  // No-op on any page that doesn't have the search UI (events, settings, etc.).
  if (!searchForm || !searchInput || !resultsContainer) return;

  const SEARCH_API_URL = "http://localhost:3000/api/users/search";

  function setSearchMessage(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text || "";
    messageEl.classList.remove("is-info", "is-error");
    if (type) messageEl.classList.add("is-" + type);
  }

  function clearResults() {
    resultsContainer.innerHTML = "";
  }

  function showEmptyResultsState(text) {
    clearResults();
    const empty = document.createElement("p");
    empty.className = "user-search-empty";
    empty.textContent = text;
    resultsContainer.appendChild(empty);
  }

  function initialFor(user) {
    const source = user.displayName || user.username || "U";
    const ch = String(source).trim().charAt(0);
    return (ch || "U").toUpperCase();
  }

  function buildAvatar(user) {
    const avatar = document.createElement("div");
    avatar.className = "user-result-avatar";

    const url = user.profilePicture && String(user.profilePicture).trim();
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = ""; // Decorative; the name is shown right next to it.
      // If the image fails to load, fall back to the initial letter.
      img.addEventListener("error", function () {
        avatar.innerHTML = "";
        avatar.textContent = initialFor(user);
      });
      avatar.appendChild(img);
    } else {
      avatar.textContent = initialFor(user);
    }
    return avatar;
  }

  // -------------------------------------------------------------------------
  // Friend request helpers
  // -------------------------------------------------------------------------
  // Endpoint that creates a new friend request on the backend.
  const FRIEND_REQUEST_API_URL = "http://localhost:3000/api/friends/request";

  // Returns true if we already sent the given user a request earlier (we
  // remember outgoing requests in localStorage so the Friends page can show
  // them in its Outgoing section).
  function hasOutgoingTo(receiverLower) {
    if (!receiverLower) return false;
    return getOutgoingFriendRequests().some(function (entry) {
      return (
        String(entry.receiverUsername || "").toLowerCase() === receiverLower
      );
    });
  }

  // Add this receiver to the localStorage outgoing list (case-insensitive,
  // no duplicates). Safe to call after a successful POST OR after the
  // backend tells us a request already exists.
  function rememberOutgoing(receiverUsername) {
    const lower = String(receiverUsername || "").toLowerCase();
    if (!lower) return;
    const list = getOutgoingFriendRequests();
    const exists = list.some(function (entry) {
      return String(entry.receiverUsername || "").toLowerCase() === lower;
    });
    if (!exists) {
      list.push({
        receiverUsername: lower,
        createdAt: new Date().toISOString(),
      });
      setOutgoingFriendRequests(list);
    }
  }

  // Click handler for the "Add Friend" button on a search result card.
  // Sends POST /api/friends/request and updates the button + message based
  // on what the backend says.
  function sendFriendRequest(user, button) {
    const me = getCurrentUser();
    const senderUsername =
      me && me.username ? String(me.username).trim() : "";
    const receiverUsername =
      user && user.username ? String(user.username).trim() : "";

    // Must be logged in to send requests.
    if (senderUsername === "") {
      setSearchMessage(
        "Please log in to send friend requests.",
        "error"
      );
      return;
    }

    // Defensive: receiver must have a username.
    if (receiverUsername === "") {
      setSearchMessage(
        "This user has no username — can't send a request.",
        "error"
      );
      return;
    }

    // Friendly self-request guard so we don't even hit the backend.
    if (senderUsername.toLowerCase() === receiverUsername.toLowerCase()) {
      button.disabled = true;
      button.textContent = "That's you";
      setSearchMessage(
        "You can't send a friend request to yourself.",
        "error"
      );
      return;
    }

    // In-flight UI: show the request is being sent.
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Sending\u2026";
    setSearchMessage("Sending friend request\u2026", "info");

    fetch(FRIEND_REQUEST_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderUsername: senderUsername,
        receiverUsername: receiverUsername,
      }),
    })
      .then(function (response) {
        // Always try to read the JSON body so we can show the server's
        // exact error message (e.g. "You are already friends...",
        // "A pending friend request to this user already exists.").
        return response
          .json()
          .then(function (data) {
            return { ok: response.ok, data: data };
          })
          .catch(function () {
            return { ok: response.ok, data: {} };
          });
      })
      .then(function (result) {
        if (result.ok) {
          // Success → "Request Sent", and remember it locally so the
          // Friends page's Outgoing section picks it up.
          button.textContent = "Request Sent";
          button.disabled = true;
          setSearchMessage(
            "Friend request sent to @" + receiverUsername + ".",
            "success"
          );
          rememberOutgoing(receiverUsername);
          return;
        }

        // Non-OK response — translate the backend error string into a
        // friendly button label + message. The strings here match the
        // ones the backend sends today.
        const serverError =
          (result.data && result.data.error) ||
          "Could not send friend request.";
        const lower = serverError.toLowerCase();

        if (lower.indexOf("yourself") !== -1) {
          button.textContent = "That's you";
          button.disabled = true;
          setSearchMessage(
            "You can't send a friend request to yourself.",
            "error"
          );
        } else if (lower.indexOf("already friends") !== -1) {
          button.textContent = "Already friends";
          button.disabled = true;
          setSearchMessage(
            "You're already friends with @" + receiverUsername + ".",
            "info"
          );
        } else if (lower.indexOf("pending friend request") !== -1) {
          button.textContent = "Request Sent";
          button.disabled = true;
          setSearchMessage(
            "You've already sent @" + receiverUsername + " a friend request.",
            "info"
          );
          // Keep our local mirror in sync with the backend.
          rememberOutgoing(receiverUsername);
        } else {
          // Unknown error — restore the button so the user can retry,
          // and surface the server's message verbatim.
          button.disabled = false;
          button.textContent = originalText;
          setSearchMessage(serverError, "error");
        }
      })
      .catch(function (error) {
        console.error("POST /api/friends/request failed:", error);
        button.disabled = false;
        button.textContent = originalText;
        setSearchMessage(
          "Could not reach the server. Please try again later.",
          "error"
        );
      });
  }

  function buildResultCard(user) {
    const card = document.createElement("article");
    card.className = "user-result-card";

    card.appendChild(buildAvatar(user));

    const info = document.createElement("div");
    info.className = "user-result-info";

    const name = document.createElement("p");
    name.className = "user-result-name";
    name.textContent =
      user.displayName && String(user.displayName).trim() !== ""
        ? user.displayName
        : user.username || "Unknown";
    info.appendChild(name);

    const handle = document.createElement("p");
    handle.className = "user-result-handle";
    handle.textContent = user.username ? "@" + user.username : "";
    info.appendChild(handle);

    if (user.bio && String(user.bio).trim() !== "") {
      const bio = document.createElement("p");
      bio.className = "user-result-bio";
      bio.textContent = user.bio;
      info.appendChild(bio);
    }

    card.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "user-result-actions";

    const addFriendBtn = document.createElement("button");
    addFriendBtn.type = "button";
    addFriendBtn.className = "btn btn-primary user-add-friend-btn";
    addFriendBtn.textContent = "Add Friend";

    // Pre-flight UI hints so the user doesn't have to click to find out:
    //   1. If the result IS the logged-in user, label it "That's you".
    //   2. If we already sent this user a request earlier in the session
    //      (cached in localStorage), label it "Request Sent".
    const receiverLower = (user.username || "").toLowerCase();
    const me = getCurrentUser();
    const myUsernameLower =
      me && me.username ? String(me.username).toLowerCase() : "";

    if (receiverLower && myUsernameLower && receiverLower === myUsernameLower) {
      addFriendBtn.disabled = true;
      addFriendBtn.textContent = "That's you";
    } else if (receiverLower && hasOutgoingTo(receiverLower)) {
      addFriendBtn.disabled = true;
      addFriendBtn.textContent = "Request Sent";
    }

    addFriendBtn.addEventListener("click", function () {
      sendFriendRequest(user, addFriendBtn);
    });
    actions.appendChild(addFriendBtn);

    card.appendChild(actions);
    return card;
  }

  function renderResults(users) {
    clearResults();
    if (!Array.isArray(users) || users.length === 0) {
      showEmptyResultsState("No users found");
      return;
    }
    users.forEach(function (user) {
      resultsContainer.appendChild(buildResultCard(user));
    });
  }

  function performUserSearch() {
    const raw = searchInput.value.trim();
    if (raw === "") {
      setSearchMessage("Type a username to search.", "info");
      clearResults();
      return;
    }

    setSearchMessage("Searching\u2026", "info");
    if (searchButton) searchButton.disabled = true;

    const url = SEARCH_API_URL + "?username=" + encodeURIComponent(raw);

    fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Request failed with status " + response.status);
        }
        return response.json();
      })
      .then(function (users) {
        setSearchMessage("", "");
        renderResults(users);
      })
      .catch(function (error) {
        console.error("User search failed:", error);
        setSearchMessage(
          "Could not search users. Make sure the backend server is running, then try again.",
          "error"
        );
        clearResults();
      })
      .finally(function () {
        if (searchButton) searchButton.disabled = false;
      });
  }

  // Submitting the form (Search button OR Enter key) triggers the search.
  searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    performUserSearch();
  });
});


// ===========================================================================
// 8c) FRIENDS PAGE  (friends.html)
// ---------------------------------------------------------------------------
// Loads three lists and lets the user accept/deny incoming friend requests:
//   1. My friends             →  GET /api/friends/:username
//   2. Incoming requests      →  GET /api/friends/requests/:username
//   3. Outgoing requests      →  read from localStorage (key below)
//
// Why outgoing comes from localStorage:
//   The backend only has an endpoint for INCOMING pending requests. To keep
//   the page working without changing the backend, we mirror outgoing
//   requests on the client whenever this app sends one. Future code (e.g.
//   wiring the profile-page "Add Friend" button to the backend) can append
//   to this same key, and the entries will show up here automatically.
//   Format:   [{ receiverUsername: "alice", createdAt: "<iso>" }, ...]
//
// Auth: only logged-in users can see this page. If they aren't logged in
// we redirect to login.html before doing anything else.
// ===========================================================================
const OUTGOING_FRIEND_REQUESTS_KEY_PREFIX = "liveEventOutgoingFriendRequests";

function getOutgoingFriendRequestsKey() {
  const currentUser = getCurrentUser();
  const myUsername =
    currentUser && currentUser.username
      ? String(currentUser.username).trim().toLowerCase()
      : "";

  if (myUsername === "") return null;
  return OUTGOING_FRIEND_REQUESTS_KEY_PREFIX + ":" + myUsername;
}

function getOutgoingFriendRequests() {
  try {
    const key = getOutgoingFriendRequestsKey();
    if (!key) return [];
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Could not parse outgoing friend requests:", e);
    return [];
  }
}

function setOutgoingFriendRequests(list) {
  const key = getOutgoingFriendRequestsKey();
  if (!key) return;
  localStorage.setItem(
    key,
    JSON.stringify(Array.isArray(list) ? list : [])
  );
}

document.addEventListener("DOMContentLoaded", function () {
  const friendsPage = document.getElementById("friends-page");
  if (!friendsPage) return; // Not on the friends page — bail.

  // Auth gate: friends.html is for logged-in users only.
  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  const currentUser = getCurrentUser();
  const myUsername =
    currentUser && currentUser.username ? String(currentUser.username) : "";

  // Defensive fallback: if there's no username on the saved user, send them
  // to login so they can sign in fresh.
  if (myUsername.trim() === "") {
    window.location.replace("login.html");
    return;
  }

  const FRIENDS_API_URL = "http://localhost:3000/api/friends";
  const REQUESTS_API_URL = "http://localhost:3000/api/friends/requests";
  const ACCEPT_API_URL = "http://localhost:3000/api/friends/accept";
  const DENY_API_URL = "http://localhost:3000/api/friends/deny";

  const subtitleEl = document.getElementById("friends-subtitle");
  const pageMessageEl = document.getElementById("friends-page-message");
  const friendsListEl = document.getElementById("friends-list");
  const incomingListEl = document.getElementById("incoming-requests");
  const outgoingListEl = document.getElementById("outgoing-requests");

  if (subtitleEl) {
    subtitleEl.textContent =
      "Signed in as @" + myUsername + ".";
  }

  // -------------------------------------------------------------------------
  // Small DOM helpers
  // -------------------------------------------------------------------------
  function setPageMessage(text, type) {
    if (!pageMessageEl) return;
    pageMessageEl.textContent = text || "";
    pageMessageEl.classList.remove("is-info", "is-error", "is-success");
    if (type) pageMessageEl.classList.add("is-" + type);
  }

  function renderEmptyInto(container, text) {
    container.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "friend-empty";
    empty.textContent = text;
    container.appendChild(empty);
  }

  function renderLoadingInto(container) {
    container.innerHTML = "";
    const loading = document.createElement("p");
    loading.className = "friend-loading";
    loading.textContent = "Loading\u2026";
    container.appendChild(loading);
  }

  function initialFor(profile) {
    const source =
      (profile && (profile.displayName || profile.username)) || "U";
    const ch = String(source).trim().charAt(0);
    return (ch || "U").toUpperCase();
  }

  // Build a circular avatar (image if profilePicture is set, else initial).
  function buildAvatar(profile) {
    const avatar = document.createElement("div");
    avatar.className = "user-result-avatar";

    const url =
      profile && profile.profilePicture
        ? String(profile.profilePicture).trim()
        : "";

    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.addEventListener("error", function () {
        avatar.innerHTML = "";
        avatar.textContent = initialFor(profile);
      });
      avatar.appendChild(img);
    } else {
      avatar.textContent = initialFor(profile);
    }
    return avatar;
  }

  // Build the shared name + handle + bio block used by every card.
  function buildInfoBlock(profile) {
    const info = document.createElement("div");
    info.className = "user-result-info";

    const name = document.createElement("p");
    name.className = "user-result-name";
    name.textContent =
      profile.displayName && String(profile.displayName).trim() !== ""
        ? profile.displayName
        : profile.username || "Unknown";
    info.appendChild(name);

    const handle = document.createElement("p");
    handle.className = "user-result-handle";
    handle.textContent = profile.username ? "@" + profile.username : "";
    info.appendChild(handle);

    if (profile.bio && String(profile.bio).trim() !== "") {
      const bio = document.createElement("p");
      bio.className = "user-result-bio";
      bio.textContent = profile.bio;
      info.appendChild(bio);
    }

    return info;
  }

  // -------------------------------------------------------------------------
  // 1) MY FRIENDS
  // -------------------------------------------------------------------------
  function buildFriendCard(friend) {
    const card = document.createElement("article");
    card.className = "user-result-card friend-card";
    card.appendChild(buildAvatar(friend));
    card.appendChild(buildInfoBlock(friend));
    return card;
  }

  function renderFriends(friends) {
    if (!Array.isArray(friends) || friends.length === 0) {
      renderEmptyInto(
        friendsListEl,
        "You don't have any friends yet. Try searching on the profile page."
      );
      return;
    }
    friendsListEl.innerHTML = "";
    friends.forEach(function (friend) {
      friendsListEl.appendChild(buildFriendCard(friend));
    });
  }

  // After loading the real friends list, drop any localStorage outgoing
  // entries whose receiver is now a friend (the request was accepted).
  function cleanUpOutgoingAfterFriendsLoad(friends) {
    if (!Array.isArray(friends) || friends.length === 0) return;
    const friendUsernamesLower = friends
      .map(function (f) {
        return f && f.username ? String(f.username).toLowerCase() : "";
      })
      .filter(Boolean);
    const before = getOutgoingFriendRequests();
    const after = before.filter(function (entry) {
      const lower = String(entry.receiverUsername || "").toLowerCase();
      return friendUsernamesLower.indexOf(lower) === -1;
    });
    if (after.length !== before.length) {
      setOutgoingFriendRequests(after);
    }
  }

  function loadFriends() {
    renderLoadingInto(friendsListEl);
    const url = FRIENDS_API_URL + "/" + encodeURIComponent(myUsername);

    fetch(url)
      .then(function (response) {
        // 404 just means the user hasn't been created on the backend yet —
        // treat it as "no friends" rather than a hard error.
        if (response.status === 404) return [];
        if (!response.ok) {
          throw new Error("Request failed with status " + response.status);
        }
        return response.json();
      })
      .then(function (friends) {
        renderFriends(friends);
        cleanUpOutgoingAfterFriendsLoad(friends);
        // Re-render outgoing in case we removed accepted entries.
        renderOutgoing();
      })
      .catch(function (error) {
        console.error("Failed to load friends:", error);
        renderEmptyInto(
          friendsListEl,
          "Could not load your friends. Make sure the backend server is running."
        );
      });
  }

  // -------------------------------------------------------------------------
  // 2) INCOMING REQUESTS
  // -------------------------------------------------------------------------
  function buildIncomingCard(request) {
    const card = document.createElement("article");
    card.className = "user-result-card friend-card friend-card--incoming";

    const sender = request.sender || {
      username: request.senderUsername,
      displayName: "",
      profilePicture: "",
      bio: "",
    };

    card.appendChild(buildAvatar(sender));
    card.appendChild(buildInfoBlock(sender));

    const actions = document.createElement("div");
    actions.className = "user-result-actions friend-actions";

    const acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.className = "btn btn-primary friend-action-btn friend-accept-btn";
    acceptBtn.textContent = "Accept";
    acceptBtn.addEventListener("click", function () {
      handleRespondToRequest(
        request.senderUsername,
        myUsername,
        "accept",
        acceptBtn,
        denyBtn
      );
    });

    const denyBtn = document.createElement("button");
    denyBtn.type = "button";
    denyBtn.className = "btn btn-secondary friend-action-btn friend-deny-btn";
    denyBtn.textContent = "Deny";
    denyBtn.addEventListener("click", function () {
      handleRespondToRequest(
        request.senderUsername,
        myUsername,
        "deny",
        acceptBtn,
        denyBtn
      );
    });

    actions.appendChild(acceptBtn);
    actions.appendChild(denyBtn);
    card.appendChild(actions);

    return card;
  }

  function renderIncoming(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      renderEmptyInto(
        incomingListEl,
        "No incoming friend requests right now."
      );
      return;
    }
    incomingListEl.innerHTML = "";
    requests.forEach(function (request) {
      incomingListEl.appendChild(buildIncomingCard(request));
    });
  }

  function loadIncomingRequests() {
    renderLoadingInto(incomingListEl);
    const url =
      REQUESTS_API_URL + "/" + encodeURIComponent(myUsername);

    fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Request failed with status " + response.status);
        }
        return response.json();
      })
      .then(function (requests) {
        renderIncoming(requests);
      })
      .catch(function (error) {
        console.error("Failed to load incoming requests:", error);
        renderEmptyInto(
          incomingListEl,
          "Could not load incoming requests. Make sure the backend server is running."
        );
      });
  }

  // -------------------------------------------------------------------------
  // Accept / Deny handler — calls the backend, then refreshes the lists.
  // -------------------------------------------------------------------------
  function handleRespondToRequest(
    senderUsername,
    receiverUsername,
    action,
    acceptBtn,
    denyBtn
  ) {
    const url = action === "accept" ? ACCEPT_API_URL : DENY_API_URL;

    if (acceptBtn) acceptBtn.disabled = true;
    if (denyBtn) denyBtn.disabled = true;
    setPageMessage(
      action === "accept"
        ? "Accepting friend request\u2026"
        : "Denying friend request\u2026",
      "info"
    );

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderUsername: senderUsername,
        receiverUsername: receiverUsername,
      }),
    })
      .then(function (response) {
        return response
          .json()
          .then(function (data) {
            return { ok: response.ok, data: data };
          })
          .catch(function () {
            return { ok: response.ok, data: {} };
          });
      })
      .then(function (result) {
        if (result.ok) {
          setPageMessage(
            action === "accept"
              ? "Friend request accepted."
              : "Friend request denied.",
            "success"
          );
          // Reload incoming + (if accepted) friends list.
          loadIncomingRequests();
          if (action === "accept") {
            loadFriends();
          }
        } else {
          const message =
            (result.data && result.data.error) ||
            "Could not update the friend request.";
          setPageMessage(message, "error");
          if (acceptBtn) acceptBtn.disabled = false;
          if (denyBtn) denyBtn.disabled = false;
        }
      })
      .catch(function (error) {
        console.error("Friend request action failed:", error);
        setPageMessage(
          "Could not reach the server. Please try again later.",
          "error"
        );
        if (acceptBtn) acceptBtn.disabled = false;
        if (denyBtn) denyBtn.disabled = false;
      });
  }

  // -------------------------------------------------------------------------
  // 3) OUTGOING REQUESTS  (read from localStorage)
  // -------------------------------------------------------------------------
  function buildOutgoingCard(entry) {
    const card = document.createElement("article");
    card.className = "user-result-card friend-card friend-card--outgoing";

    const profile = {
      username: entry.receiverUsername || "",
      displayName: "",
      profilePicture: "",
      bio: "",
    };

    card.appendChild(buildAvatar(profile));
    card.appendChild(buildInfoBlock(profile));

    const actions = document.createElement("div");
    actions.className = "user-result-actions friend-actions";

    const pendingBadge = document.createElement("span");
    pendingBadge.className = "friend-pending-badge";
    pendingBadge.textContent = "Pending";
    actions.appendChild(pendingBadge);

    card.appendChild(actions);
    return card;
  }

  function renderOutgoing() {
    const outgoing = getOutgoingFriendRequests();
    if (!Array.isArray(outgoing) || outgoing.length === 0) {
      renderEmptyInto(
        outgoingListEl,
        "You haven't sent any friend requests yet."
      );
      return;
    }
    outgoingListEl.innerHTML = "";
    outgoing.forEach(function (entry) {
      outgoingListEl.appendChild(buildOutgoingCard(entry));
    });
  }

  // -------------------------------------------------------------------------
  // Initial load
  // -------------------------------------------------------------------------
  loadFriends();
  loadIncomingRequests();
  renderOutgoing();
});


// ===========================================================================
// 9) SETTINGS PAGE
// ---------------------------------------------------------------------------
// All toggles persist to localStorage. Theme buttons highlight whichever
// theme is currently active.
// ===========================================================================
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

// Make sure the buttons reflect the saved theme on page load.
highlightSelectedThemeButton(getSavedTheme());
updateThemeStatusText();

// Helper: load/save a checkbox toggle using localStorage.
// `onChange` is an optional callback that runs after we save the new value.
function bindToggleToLocalStorage(elementId, storageKey, defaultValue, onChange) {
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
    if (typeof onChange === "function") onChange(toggle.checked);
  });
}

// Notifications (the original three + the three new ones)
bindToggleToLocalStorage("notif-email", "liveEventNotifEmail", true);
bindToggleToLocalStorage("notif-reminders", "liveEventNotifReminders", true);
bindToggleToLocalStorage("notif-friend-invites", "liveEventNotifFriendInvites", true);
bindToggleToLocalStorage("notif-rsvp-updates", "liveEventNotifRsvpUpdates", true);
bindToggleToLocalStorage("notif-nearby", "liveEventNotifNearby", false);

// Privacy
bindToggleToLocalStorage("privacy-public-profile", "liveEventPrivacyPublicProfile", true);
bindToggleToLocalStorage("privacy-show-hobbies", "liveEventPrivacyShowHobbies", true);
bindToggleToLocalStorage("privacy-show-attended", "liveEventPrivacyShowAttended", true);
bindToggleToLocalStorage("privacy-allow-messages", "liveEventPrivacyAllowMessages", true);

// Accessibility — we re-apply the body classes whenever they change so the
// effect is visible immediately.
bindToggleToLocalStorage("a11y-reduce-motion", A11Y_REDUCE_MOTION_KEY, false, applyA11ySettings);
bindToggleToLocalStorage("a11y-large-text", A11Y_LARGE_TEXT_KEY, false, applyA11ySettings);
bindToggleToLocalStorage("a11y-high-contrast", A11Y_HIGH_CONTRAST_KEY, false, applyA11ySettings);


// ——— Password reset / change (demo) ———
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
    if (newPassword.length < 6) {
      showSettingsMessage(passwordMessage, "New password should be at least 6 characters.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showSettingsMessage(passwordMessage, "New password and confirmation do not match.", "error");
      return;
    }

    // Demo: update the password on the currently-logged-in user (if any).
    const current = getCurrentUser();
    if (current) {
      const allUsers = getAllUsers();
      const idx = allUsers.findIndex(function (u) { return u.id === current.id; });
      if (idx !== -1) {
        if (allUsers[idx].password !== currentPassword) {
          showSettingsMessage(passwordMessage, "Current password is incorrect.", "error");
          return;
        }
        allUsers[idx].password = newPassword;
        saveAllUsers(allUsers);
      }
    }

    showSettingsMessage(passwordMessage, "Password updated successfully (demo).", "success");
    passwordForm.reset();
  });
}


// ——— Account tools: clear preferences + download user data ———
const clearPrefsBtn = document.getElementById("clear-prefs-btn");
const downloadDataBtn = document.getElementById("download-data-btn");
const toolsMessage = document.getElementById("tools-message");

// Keys related to user preferences (NOT login or profile data).
const PREFERENCE_KEYS = [
  LIVE_EVENT_THEME_KEY,
  "liveEventNotifEmail",
  "liveEventNotifReminders",
  "liveEventNotifFriendInvites",
  "liveEventNotifRsvpUpdates",
  "liveEventNotifNearby",
  "liveEventPrivacyPublicProfile",
  "liveEventPrivacyShowHobbies",
  "liveEventPrivacyShowAttended",
  "liveEventPrivacyAllowMessages",
  A11Y_REDUCE_MOTION_KEY,
  A11Y_LARGE_TEXT_KEY,
  A11Y_HIGH_CONTRAST_KEY
];

if (clearPrefsBtn && toolsMessage) {
  clearPrefsBtn.addEventListener("click", function () {
    const ok = confirm(
      "Reset theme, notifications, privacy, and accessibility settings to their defaults?"
    );
    if (!ok) return;
    PREFERENCE_KEYS.forEach(function (key) {
      localStorage.removeItem(key);
    });
    // Re-apply defaults visually.
    applyTheme(getSavedTheme());
    applyA11ySettings();
    showSettingsMessage(toolsMessage, "Preferences cleared. Reload to update toggles.", "success");
  });
}

if (downloadDataBtn && toolsMessage) {
  downloadDataBtn.addEventListener("click", function () {
    // Bundle every Live Event-related localStorage entry into one JSON file.
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      data[key] = localStorage.getItem(key);
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "live-event-data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSettingsMessage(toolsMessage, "Your data was downloaded as JSON.", "success");
  });
}


// ——— Danger zone: delete account (simulated) ———
const deleteAccountBtn = document.getElementById("delete-account-btn");
const deleteMessage = document.getElementById("delete-message");

if (deleteAccountBtn && deleteMessage) {
  deleteAccountBtn.addEventListener("click", function () {
    const confirmed = confirm(
      "Are you sure you want to delete your account? This is a demo and will only clear localStorage values."
    );
    if (!confirmed) return;

    // Remove the currently-logged-in user from the saved users list.
    const current = getCurrentUser();
    if (current) {
      const remaining = getAllUsers().filter(function (u) { return u.id !== current.id; });
      saveAllUsers(remaining);
    }

    // Clear demo "account" + settings + profile data.
    const keysToRemove = PREFERENCE_KEYS.concat([
      LOGGED_IN_KEY,
      CURRENT_USER_KEY,
      PROFILE_KEY,
      "liveEventProfileReady" // legacy key from the old profile flow
    ]);
    keysToRemove.forEach(function (key) {
      localStorage.removeItem(key);
    });

    applyTheme(getSavedTheme());
    applyA11ySettings();
    refreshNavLogoutVisibility();

    showSettingsMessage(
      deleteMessage,
      "Account deleted (simulated). Demo data was cleared from localStorage — no server changes were made.",
      "success"
    );
  });
}
