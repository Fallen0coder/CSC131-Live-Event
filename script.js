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

const eventsList = document.getElementById("events-list");

const sampleEvents = [
  {
    title: "Samay's Birthday Party",
    date: "May 2, 2026 - 7:00 PM",
    location: "Student Center Hall",
    description: "Enjoy live performances from student bands and local artists."
  },
  {
    title: "Tech Club Hackathon",
    date: "May 6, 2026 - 10:00 AM",
    location: "Engineering Lab",
    description: "Build creative projects with teammates and win fun prizes."
  },
  {
    title: "Career Networking Fair",
    date: "May 9, 2026 - 1:00 PM",
    location: "Main Gym",
    description: "Meet recruiters, explore internships, and grow your network."
  },
  {
    title: "Outdoor Movie Evening",
    date: "May 12, 2026 - 8:00 PM",
    location: "Campus Lawn",
    description: "Bring a blanket and relax with friends under the stars."
  },
  {
    title: "Spring Sports Festival",
    date: "May 15, 2026 - 11:00 AM",
    location: "Athletics Field",
    description: "Join friendly games, team challenges, and fitness activities."
  },
  {
    title: "Cars and Coffee",
    date: "June 2, 2026 - 11:00 PM",
    location: "Old Town Sacramento",
    description: "Join us for a nice morning cup of coffee and look at exotic cars."
  }
];

if (eventsList) {
  sampleEvents.forEach(function (event) {
    const card = document.createElement("article");
    card.className = "event-card";

    card.innerHTML =
      "<h3>" + event.title + "</h3>" +
      "<p class='event-meta'><strong>Date:</strong> " + event.date + "</p>" +
      "<p class='event-meta'><strong>Location:</strong> " + event.location + "</p>" +
      "<p class='event-description'>" + event.description + "</p>" +
      "<button class='rsvp-btn'>RSVP</button>";

    const rsvpButton = card.querySelector(".rsvp-btn");
    if (rsvpButton) {
      rsvpButton.addEventListener("click", function () {
        alert("You RSVP’d to this event!");
      });
    }

    eventsList.appendChild(card);
  });
}

const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");

if (loginForm && loginEmail && loginPassword) {
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (email === "" || password === "") {
      alert("Please fill all fields");
    } else {
      alert("Login successful (demo)");
      localStorage.setItem("liveEventLoggedIn", "true");
      window.location.href = "events.html";
    }
  });
}

const signupForm = document.getElementById("signup-form");
const signupFullname = document.getElementById("signup-fullname");
const signupEmailField = document.getElementById("signup-email");
const signupPasswordField = document.getElementById("signup-password");
const signupConfirmField = document.getElementById("signup-confirm");

if (
  signupForm &&
  signupFullname &&
  signupEmailField &&
  signupPasswordField &&
  signupConfirmField
) {
  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const fullName = signupFullname.value.trim();
    const email = signupEmailField.value.trim();
    const password = signupPasswordField.value;
    const confirmPassword = signupConfirmField.value;

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

    alert("Account created (demo)");
    localStorage.setItem("liveEventLoggedIn", "true");
    window.location.href = "profile.html";
  });
}

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
