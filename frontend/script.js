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

// Show the navbar "Log out" button only when the user is logged in.
function refreshNavLogoutVisibility() {
  const li = document.getElementById("nav-logout-li");
  if (!li) return;
  li.classList.toggle("is-hidden", !isLoggedIn());
}

document.addEventListener("DOMContentLoaded", function () {
  refreshNavLogoutVisibility();
  const navLogoutBtn = document.getElementById("nav-logout-btn");
  if (navLogoutBtn) {
    navLogoutBtn.addEventListener("click", logout);
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
// 6) LOGIN PAGE  (demo, localStorage-based)
// ---------------------------------------------------------------------------
// We try to match against an account that was created via the signup form.
// For convenience we also accept the two seeded backend demo users
// (alice@example.com / bob@example.com with password "password123") so the
// login flow works even before the user signs up.
// ===========================================================================
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("login-form");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const loginMessage = document.getElementById("login-message");
  if (!loginForm || !loginEmail || !loginPassword) return;

  function showMsg(text, type) {
    if (!loginMessage) {
      alert(text);
      return;
    }
    loginMessage.textContent = text;
    loginMessage.classList.remove("is-success", "is-error");
    if (type) loginMessage.classList.add("is-" + type);
  }

  // Fallback "seed" accounts so demo login works without signing up first.
  const DEMO_ACCOUNTS = [
    {
      id: 1,
      fullName: "Alice Demo",
      username: "alice",
      email: "alice@example.com",
      password: "password123"
    },
    {
      id: 2,
      fullName: "Bob Demo",
      username: "bob",
      email: "bob@example.com",
      password: "password123"
    }
  ];

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = loginEmail.value.trim().toLowerCase();
    const password = loginPassword.value;

    if (email === "" || password === "") {
      showMsg("Please fill in both email and password.", "error");
      return;
    }

    // 1) Look for a user we already created via signup.
    const allUsers = getAllUsers();
    let matched = allUsers.find(function (u) {
      return u.email && u.email.toLowerCase() === email && u.password === password;
    });

    // 2) Fall back to demo accounts.
    if (!matched) {
      matched = DEMO_ACCOUNTS.find(function (u) {
        return u.email.toLowerCase() === email && u.password === password;
      });
    }

    if (!matched) {
      showMsg("Invalid email or password.", "error");
      return;
    }

    // Success: remember the user and head to their profile.
    setCurrentUser({
      id: matched.id,
      fullName: matched.fullName,
      username: matched.username,
      email: matched.email
    });

    showMsg("Login successful! Redirecting…", "success");
    setTimeout(function () {
      window.location.href = "profile.html";
    }, 400);
  });
});


// ===========================================================================
// 7) SIGNUP PAGE  (demo, localStorage-based)
// ---------------------------------------------------------------------------
// Saves the new user into the "liveEventUsers" array, simulates a login,
// and redirects to the profile page so the user can fill in details/hobbies.
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

    // Make sure the email/username isn't already taken in localStorage.
    const allUsers = getAllUsers();
    const emailTaken = allUsers.some(function (u) {
      return u.email && u.email.toLowerCase() === email.toLowerCase();
    });
    if (emailTaken) {
      showMsg("That email is already registered. Try logging in.", "error");
      return;
    }
    const usernameTaken = allUsers.some(function (u) {
      return u.username && u.username.toLowerCase() === username.toLowerCase();
    });
    if (usernameTaken) {
      showMsg("That username is taken. Pick another.", "error");
      return;
    }

    // Build the new user object. We give them an id that won't collide
    // with the demo seed users (1, 2).
    const newUser = {
      id: Date.now(),
      fullName: fullName,
      username: username,
      email: email,
      password: password,
      createdAt: new Date().toISOString()
    };

    allUsers.push(newUser);
    saveAllUsers(allUsers);

    // Pre-fill the profile so the user sees their info on profile.html.
    const initialProfile = {
      fullName: fullName,
      username: username,
      email: email,
      school: "",
      location: "",
      bio: "",
      hobbies: []
    };
    localStorage.setItem("liveEventProfile", JSON.stringify(initialProfile));

    // Simulate login and head to the profile page.
    setCurrentUser({
      id: newUser.id,
      fullName: newUser.fullName,
      username: newUser.username,
      email: newUser.email
    });

    showMsg("Account created! Redirecting to your profile…", "success");
    setTimeout(function () {
      window.location.href = "profile.html";
    }, 500);
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
