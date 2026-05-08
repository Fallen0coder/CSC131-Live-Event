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
  // "Reduce animations" adds BOTH classes so CSS can match the coursework spec
  // (body.reduce-animations) and older rules (.a11y-reduce-motion).
  var reduceMotion = localStorage.getItem(A11Y_REDUCE_MOTION_KEY) === "true";
  document.body.classList.toggle("a11y-reduce-motion", reduceMotion);
  document.body.classList.toggle("reduce-animations", reduceMotion);

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


// ---------------------------------------------------------------------------
// Read a user's chosen image file as a Base64 data URL (matches what MongoDB stores).
// We return a Promise so the form waits for THIS to finish BEFORE fetch() —
// otherwise the POST can fire while FileReader is still running (image would save as empty).
// ---------------------------------------------------------------------------
function readLocalImageFileAsDataURL(file) {
  return new Promise(function (resolve, reject) {
    if (!file) {
      resolve("");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = function () {
      reject(new Error("Could not read the image file."));
    };
    reader.readAsDataURL(file);
  });
}


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

// Returns true if the logged-in user is an admin (per the cached role on
// the user object). The backend ALWAYS re-checks role on admin-only
// routes — this helper just decides whether to show or hide UI.
function isCurrentUserAdmin() {
  const user = getCurrentUser();
  return !!(user && user.role === "admin");
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

  // Events page: only show the "Add Event" button when a user is logged in.
  const addEventBtn = document.getElementById("add-event-btn");
  if (addEventBtn) addEventBtn.classList.toggle("is-hidden", !loggedIn);

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

// ===========================================================================
// HOMEPAGE: Featured Events
//
// We pull the live list of events from the backend and show the first 3 as
// "Featured Events" cards on the homepage. Previously this section used a
// hardcoded array of demo events — those have been removed so the homepage
// always reflects what's actually in the database.
//
// API:  GET http://localhost:3000/api/events  -> JSON array of events
// Each event object on the backend has:
//   { id, title, category, date, time, location, description, ... }
//
// User-visible states handled below:
//   - "Loading featured events…" while the request is in flight
//   - 3 cards once the events arrive
//   - "No featured events available." when the backend returns an empty list
//   - "Could not load featured events." if the request fails
//   - "No events match your search." when the homepage filter hides every card
// ===========================================================================
const FEATURED_EVENTS_API_URL = "http://localhost:3000/api/events";

const featuredEventsContainer = document.getElementById("featured-events");
const featuredEmptyMessage = document.getElementById("featured-empty");
const homeSearchInput = document.getElementById("home-search");
const homeFilterSelect = document.getElementById("home-filter");

// Friendly text for the category badge (e.g. "social" -> "Social"). If
// the category isn't one we know about, we just title-case it so the
// badge still reads nicely.
function featuredCategoryLabel(category) {
  if (!category) return "";
  const labels = {
    social: "Social",
    tech: "Tech",
    career: "Career",
    outdoor: "Outdoor",
    music: "Music",
    sports: "Sports"
  };
  const key = String(category).toLowerCase();
  if (labels[key]) return labels[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// Format a date string (e.g. "2026-05-14") into "May 14, 2026". If the
// browser can't parse it, we just show the raw value so we never lose
// information.
function featuredFormatDate(dateString) {
  if (!dateString) return "";
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) return String(dateString);
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// Format a "HH:MM" time (e.g. "14:00") into a 12-hour string ("2:00 PM").
function featuredFormatTime(timeString) {
  if (!timeString) return "";
  const match = /^(\d{1,2}):(\d{2})/.exec(String(timeString));
  if (match) {
    const d = new Date();
    d.setHours(Number(match[1]), Number(match[2]), 0, 0);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit"
      });
    }
  }
  return String(timeString);
}

// Escape any user-supplied text we're going to drop into innerHTML so a
// malicious title/description can't smuggle in <script> tags.
function featuredEscape(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Trim a long description down to a teaser length so cards stay tidy.
function featuredTrim(text, max) {
  if (!text) return "";
  const s = String(text);
  if (s.length <= max) return s;
  return s.substring(0, max - 1).replace(/\s+$/, "") + "\u2026";
}

// Show a single status message inside the featured section. Passing an
// empty string hides the message element.
function setFeaturedStatus(message) {
  if (!featuredEmptyMessage) return;
  featuredEmptyMessage.textContent = message || "";
  featuredEmptyMessage.classList.toggle("is-hidden", !message);
}

// Build a single Featured Event card matching the existing homepage
// design (badge, title, date/time/location meta rows, description, and
// a "View Details" button that takes the user to events.html).
function buildFeaturedCard(event) {
  const card = document.createElement("article");
  card.className = "featured-card";
  card.setAttribute("data-featured-card", "true");
  card.setAttribute(
    "data-category",
    String(event.category || "").toLowerCase()
  );

  const categoryText = featuredEscape(featuredCategoryLabel(event.category));
  const titleText = featuredEscape(event.title || "Untitled event");
  const dateText = featuredEscape(featuredFormatDate(event.date));
  const timeText = featuredEscape(featuredFormatTime(event.time));
  const locationText = featuredEscape(event.location || "");
  const descriptionText = featuredEscape(
    featuredTrim(event.description || "", 140)
  );

  let html = "";
  if (categoryText) {
    html += "<span class='featured-badge'>" + categoryText + "</span>";
  }
  html += "<h3>" + titleText + "</h3>";
  if (dateText) {
    html +=
      "<p class='event-meta'><strong>Date:</strong> " + dateText + "</p>";
  }
  if (timeText) {
    html +=
      "<p class='event-meta'><strong>Time:</strong> " + timeText + "</p>";
  }
  if (locationText) {
    html +=
      "<p class='event-meta'><strong>Location:</strong> " +
      locationText +
      "</p>";
  }
  if (descriptionText) {
    html +=
      "<p class='event-description'>" + descriptionText + "</p>";
  }
  html +=
    "<button type='button' class='featured-view-btn'>View Details</button>";
  card.innerHTML = html;

  // The "View Details" button takes the user to the full Events page so
  // they can RSVP / read the long description / etc. We deliberately
  // don't pass an event id in the URL — the Events page just shows the
  // full list, which is the simplest way to keep both pages in sync.
  const viewBtn = card.querySelector(".featured-view-btn");
  if (viewBtn) {
    viewBtn.addEventListener("click", function () {
      window.location.href = "events.html";
    });
  }

  return card;
}

// Render up to 3 featured cards from a real backend events array.
function renderFeaturedEvents(events) {
  if (!featuredEventsContainer) return;
  featuredEventsContainer.innerHTML = "";

  if (!Array.isArray(events) || events.length === 0) {
    setFeaturedStatus("No featured events available.");
    return;
  }

  events.forEach(function (event) {
    featuredEventsContainer.appendChild(buildFeaturedCard(event));
  });
  setFeaturedStatus("");
  // Re-run the homepage search/filter once the cards exist so any text
  // already typed in the search box is respected immediately.
  applyFeaturedFilters();
}

// Honor the homepage search box + category dropdown. Hides any cards
// that don't match and shows a "no results" message when nothing is
// visible. Safe to call when the cards haven't been rendered yet.
function applyFeaturedFilters() {
  if (
    !featuredEventsContainer ||
    !homeSearchInput ||
    !homeFilterSelect ||
    !featuredEmptyMessage
  ) {
    return;
  }

  const cards = featuredEventsContainer.querySelectorAll(
    "[data-featured-card]"
  );
  if (cards.length === 0) return;

  const query = homeSearchInput.value.trim().toLowerCase();
  const category = homeFilterSelect.value;
  let visibleCount = 0;

  cards.forEach(function (card) {
    const cardCategory = card.getAttribute("data-category") || "";
    const matchesCategory = category === "all" || cardCategory === category;
    const blob = (card.textContent || "").toLowerCase();
    const matchesSearch = query === "" || blob.indexOf(query) !== -1;

    if (matchesCategory && matchesSearch) {
      card.classList.remove("is-hidden");
      visibleCount++;
    } else {
      card.classList.add("is-hidden");
    }
  });

  if (visibleCount === 0) {
    setFeaturedStatus("No events match your search.");
  } else {
    setFeaturedStatus("");
  }
}

// Fetch the list of events from the backend, take the first 3, and
// render them as featured cards. Network/parse errors fall through to
// a friendly "Could not load…" message instead of leaving a blank grid.
function loadFeaturedEvents() {
  if (!featuredEventsContainer) return;

  setFeaturedStatus("Loading featured events\u2026");
  featuredEventsContainer.innerHTML = "";

  fetch(FEATURED_EVENTS_API_URL)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Request failed with status " + response.status);
      }
      return response.json();
    })
    .then(function (events) {
      const list = Array.isArray(events) ? events.slice(0, 3) : [];
      renderFeaturedEvents(list);
    })
    .catch(function (error) {
      console.error("Failed to load featured events:", error);
      featuredEventsContainer.innerHTML = "";
      setFeaturedStatus("Could not load featured events.");
    });
}

// Only run this on pages that actually have the featured-events grid
// (i.e. index.html). Other pages will just skip the whole block.
if (featuredEventsContainer) {
  if (homeSearchInput && homeFilterSelect) {
    homeSearchInput.addEventListener("input", applyFeaturedFilters);
    homeFilterSelect.addEventListener("change", applyFeaturedFilters);
  }
  loadFeaturedEvents();
}


// ===========================================================================
// 5) EVENTS PAGE: load from backend (unchanged from original)
// ===========================================================================
document.addEventListener("DOMContentLoaded", function () {
  const eventsContainer = document.getElementById("events-container");
  if (!eventsContainer) return;

  const EVENTS_API_URL = "http://localhost:3000/api/events";
  const RSVP_API_URL = "http://localhost:3000/api/rsvp";
  // Used to ask the backend "which events has the logged-in user already
  // RSVP'd to?" so we can pre-mark those buttons as green/disabled
  // immediately on page load (instead of resetting them to blue every
  // time the page reloads). See fetchMyRsvpedEventIds() below.
  const RSVPS_API_URL = "http://localhost:3000/api/rsvps";
  // Used to fetch the attendee count + first 3 profile pictures for each
  // event card's avatar stack. See loadEventAttendees() below.
  const RSVPS_EVENT_API_URL = "http://localhost:3000/api/rsvps/event";

  // -------------------------------------------------------------------------
  // In-page banner (replaces alert() popups for RSVP feedback).
  // The element lives in events.html; we only manipulate it from JS here.
  // -------------------------------------------------------------------------
  const eventsBanner = document.getElementById("events-banner");
  let eventsBannerHideTimer = null;

  // Show a status message at the top of the events page. `type` controls
  // the color: "success" (green), "error" (red), or "info" (blue). The
  // banner auto-hides after 4 seconds. Calling this again before the
  // timer expires replaces the message and resets the timer.
  function showEventsBanner(message, type) {
    if (!eventsBanner) {
      // Fallback so messages aren't silently dropped if the markup is
      // missing for some reason.
      console.log("[events banner]", type || "info", message);
      return;
    }

    if (eventsBannerHideTimer) {
      clearTimeout(eventsBannerHideTimer);
      eventsBannerHideTimer = null;
    }

    eventsBanner.textContent = message || "";

    eventsBanner.classList.remove("is-success", "is-error", "is-info");
    if (type) {
      eventsBanner.classList.add("is-" + type);
    }

    // Force the entrance animation to replay every time we show a
    // banner, even if a previous banner is still visible. The double
    // toggle + reflow trick reliably restarts the CSS animation so the
    // user notices the new message.
    eventsBanner.classList.add("is-hidden");
    void eventsBanner.offsetWidth;
    eventsBanner.classList.remove("is-hidden");

    eventsBannerHideTimer = setTimeout(function () {
      eventsBanner.classList.add("is-hidden");
      eventsBannerHideTimer = null;
    }, 4000);
  }

  // We deliberately do NOT cache the user at page load. The user might log
  // in / out in another tab, so we re-read getCurrentUser() inside sendRsvp
  // every time the button is clicked. See sendRsvp() below.

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Only allow real image data URLs in <img src="..."> — never pass through
  // random strings from the network, which could trick the browser into
  // running javascript: URLs or other nasty schemes.
  function getSanitizedEventImageSrc(raw) {
    if (!raw || typeof raw !== "string") return "";
    const s = raw.trim();
    // Browser data URLs typically look like: data:image/jpeg;base64,... — but
    // some formats add extra MIME parameters; keep prefix check permissive so
    // valid stored images survive a reload.
    if (/^data:image\/.+;base64,/i.test(s)) {
      return s;
    }
    return "";
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

  // -------------------------------------------------------------------------
  // RSVP button click flow
  //
  // The RSVP button has TWO roles depending on its current visual state:
  //   • Blue "RSVP"   → clicking SAVES a new RSVP via POST /api/rsvp
  //   • Green "RSVP'd" → clicking CANCELS via DELETE /api/rsvp
  //
  // We tell the two states apart with the .is-rsvped CSS class (the same
  // class that swaps the gradient from blue to green in style.css). The
  // top-level sendRsvp() function is just a small router that picks
  // saveRsvp() or cancelRsvp() based on which state the button is in.
  // -------------------------------------------------------------------------

  // Puts the button into the green "RSVP'd" state. Stays ENABLED so the
  // user can click it again to cancel — that's how we add cancel support
  // without a separate Cancel button. We share this helper between the
  // initial page-load pre-marking, the save-success path, and the
  // already-RSVP'd path so they all end up looking identical.
  function markAsRsvped(button) {
    button.textContent = "RSVP\u2019d";
    button.disabled = false;
    button.classList.add("is-rsvped");
  }

  // Restores the button to the blue "RSVP" state. Used after a successful
  // cancel and after genuine save errors (so the user can try again).
  function resetRsvpButton(button) {
    button.disabled = false;
    button.textContent = "RSVP";
    button.classList.remove("is-rsvped");
  }

  // Tiny in-flight indicator. Disable the button to block double-clicks
  // and show a transient label like "Saving…" or "Canceling…".
  function setRsvpInFlight(button, text) {
    button.disabled = true;
    button.textContent = text;
  }

  // Returns true if the server's message clearly says the user has
  // already RSVP'd — e.g. "You have already RSVP'd to this event."
  // We check the text (case-insensitive) so we still do the right
  // thing if the backend ever changes the HTTP status for this case
  // (today it returns 200, but a future version might return 409).
  function looksLikeAlreadyRsvped(message) {
    if (!message) return false;
    return String(message).toLowerCase().indexOf("already") !== -1;
  }

  // Reads a fetch Response into { ok, data } without throwing on bodies
  // that aren't valid JSON. Used by both saveRsvp and cancelRsvp.
  function readRsvpResponse(response) {
    return response
      .json()
      .then(function (data) {
        return { ok: response.ok, data: data };
      })
      .catch(function () {
        return { ok: response.ok, data: {} };
      });
  }

  // Top-level click handler wired up in createEventCard(). Always re-reads
  // the logged-in user at click time so we react to fresh logins/logouts
  // (including from another tab). Then delegates to save vs cancel.
  function sendRsvp(rsvpButton, event) {
    const user = getCurrentUser();
    if (!user || !user.id) {
      showEventsBanner("Please log in to RSVP.", "error");
      return;
    }

    if (rsvpButton.classList.contains("is-rsvped")) {
      cancelRsvp(rsvpButton, event, user);
    } else {
      saveRsvp(rsvpButton, event, user);
    }
  }

  // POST /api/rsvp — saves a brand-new RSVP. On success the button turns
  // green and a "You RSVP'd to this event!" banner pops up. On error the
  // button reverts so the user can try again.
  function saveRsvp(rsvpButton, event, user) {
    setRsvpInFlight(rsvpButton, "Saving\u2026");

    fetch(RSVP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, eventId: event.id })
    })
      .then(readRsvpResponse)
      .then(function (result) {
        const data = result.data || {};
        const serverText = data.message || data.error || "";

        if (result.ok) {
          // Either a brand-new RSVP (HTTP 201) or the backend's "you have
          // already RSVP'd" response (HTTP 200). Both should end up green.
          markAsRsvped(rsvpButton);
          if (looksLikeAlreadyRsvped(serverText)) {
            showEventsBanner(
              "You\u2019re already RSVP\u2019d to this event.",
              "info"
            );
          } else {
            showEventsBanner("You RSVP\u2019d to this event!", "success");
          }
          return;
        }

        // Defensive: if a future backend change ever returned a non-2xx
        // status for the already-RSVP'd case, still end up green.
        if (looksLikeAlreadyRsvped(serverText)) {
          markAsRsvped(rsvpButton);
          showEventsBanner(
            "You\u2019re already RSVP\u2019d to this event.",
            "info"
          );
          return;
        }

        // Anything else is a real error — reset and let the user try again.
        resetRsvpButton(rsvpButton);
        showEventsBanner(
          serverText || "Something went wrong. Please try again.",
          "error"
        );
      })
      .catch(function (error) {
        // Network failure or unexpected JSON parse error. We can't tell
        // from here whether the RSVP was saved or not, so the safest
        // thing is to restore the button so the user can retry.
        console.error("RSVP save failed:", error);
        resetRsvpButton(rsvpButton);
        showEventsBanner(
          "Something went wrong. Please try again.",
          "error"
        );
      });
  }

  // DELETE /api/rsvp — cancels the user's RSVP for this event. On success
  // the button turns blue again. On error the button stays green so the
  // user can retry the cancellation.
  function cancelRsvp(rsvpButton, event, user) {
    setRsvpInFlight(rsvpButton, "Canceling\u2026");

    fetch(RSVP_API_URL, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, eventId: event.id })
    })
      .then(readRsvpResponse)
      .then(function (result) {
        const data = result.data || {};
        const serverText = data.message || data.error || "";

        if (result.ok) {
          // The backend treats both "found and deleted" and "nothing to
          // delete" as success (it's idempotent). Either way we end up
          // with no RSVP, so we revert to the blue button.
          resetRsvpButton(rsvpButton);
          showEventsBanner("Your RSVP was canceled.", "success");
          return;
        }

        // Real error — keep the button green so the user can try again.
        markAsRsvped(rsvpButton);
        showEventsBanner(
          serverText || "Something went wrong. Please try again.",
          "error"
        );
      })
      .catch(function (error) {
        console.error("RSVP cancel failed:", error);
        // Same reasoning as above — keep it green so the click can retry.
        markAsRsvped(rsvpButton);
        showEventsBanner(
          "Something went wrong. Please try again.",
          "error"
        );
      });
  }

  // `rsvpedEventIds` is an optional Set of event IDs the logged-in user
  // has already RSVP'd to. When the event we're rendering is in that set,
  // we render its button in the "RSVP'd" green/disabled state right away
  // so it stays green across page reloads. Defaults to an empty Set so
  // older callers/tests that don't pass it still work.
  // Fallback solid colours for avatar dots when a user has no uploaded photo.
  // Indexed by avatar position so the colour is stable across renders.
  var AVATAR_COLORS = ["#a78bfa", "#34d399", "#fb923c"];

  // Returns true when the string looks like a safe data-URL image we can
  // put in a background-image (same rule as getSanitizedEventImageSrc).
  function isSafeDataUrl(s) {
    return typeof s === "string" && /^data:image\/.+;base64,/i.test(s.trim());
  }

  // Build and inject the attendee avatar stack into an existing card element.
  // `data` is the JSON body returned by GET /api/rsvps/event/:eventId.
  function renderAttendeesRow(container, data) {
    if (!container) return;
    var count = (data && typeof data.count === "number") ? data.count : 0;
    var attendees = (data && Array.isArray(data.attendees)) ? data.attendees : [];

    if (count === 0) {
      container.innerHTML = "";
      return;
    }

    var stackHtml = "<div class='event-avatar-stack'>";
    for (var i = 0; i < attendees.length; i++) {
      var a = attendees[i];
      var style = "";
      if (
        a &&
        a.profilePictureType === "uploaded" &&
        isSafeDataUrl(a.profilePicture)
      ) {
        var escaped = a.profilePicture.replace(/'/g, "%27");
        style =
          "background-image:url('" + escaped + "');";
      } else {
        style = "background-color:" + (AVATAR_COLORS[i] || "#a78bfa") + ";";
      }
      stackHtml += "<div class='event-avatar' style='" + style + "'></div>";
    }
    stackHtml += "</div>";

    var overflowHtml = "";
    if (count > 3) {
      overflowHtml =
        "<span class='event-avatar-overflow'>+" + (count - 3) + "</span>";
    }

    var countHtml =
      "<span class='event-attendees-count'>" +
      count +
      " going</span>";

    container.innerHTML = stackHtml + overflowHtml + countHtml;
  }

  // Fetch attendee data for a single event and populate its card's
  // .event-attendees-row placeholder. Silently no-ops on network error so
  // the rest of the card still works fine.
  function loadEventAttendees(card, eventId) {
    if (!card || !eventId) return;
    var row = card.querySelector(".event-attendees-row");
    if (!row) return;

    fetch(RSVPS_EVENT_API_URL + "/" + encodeURIComponent(eventId))
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (data) {
        if (data) renderAttendeesRow(row, data);
      })
      .catch(function (err) {
        console.warn("Could not load attendees for event " + eventId + ":", err);
      });
  }

  function createEventCard(event, rsvpedEventIds) {
    const card = document.createElement("article");
    card.className = "event-card";

    const safeTitle = escapeHtml(event.title);
    const formattedDate = escapeHtml(formatEventDate(event.date));
    const formattedTime = escapeHtml(formatEventTime(event.time));
    const safeLocation = escapeHtml(event.location);
    const safeDescription = escapeHtml(event.description);
    const categoryLabel = escapeHtml(formatCategoryLabel(event.category));
    // creatorUsername is optional — older seeded events don't have it.
    // We only render the "Created by" line when a non-empty username exists.
    const safeCreator = escapeHtml(event.creatorUsername || "");

    const imgSrc = getSanitizedEventImageSrc(event.eventImage);

    let html = "<div class='event-card-media'>";
    if (imgSrc) {
      // src is validated by getSanitizedEventImageSrc (data:image/*;base64,...)
      // Escape single quotes only so the attribute stays well-formed.
      html +=
        "<img class='event-card-image' src='" +
        imgSrc.replace(/'/g, "%27") +
        "' alt='' loading='lazy' />";
    } else {
      html +=
        "<div class='event-card-image-placeholder' aria-hidden='true'>" +
          "<span class='event-card-image-placeholder-icon'>\uD83D\uDDBC\uFE0F</span>" +
          "<span class='event-card-image-placeholder-text'>No image</span>" +
        "</div>";
    }
    html += "</div>";

    html += "<div class='event-card-header'>";
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

    if (safeCreator) {
      html +=
        "<p class='event-creator'>" +
          "<span class='event-meta-icon' aria-hidden='true'>\uD83D\uDC64</span>" +
          "<span>Created by <strong>@" + safeCreator + "</strong></span>" +
        "</p>";
    }

    // Attendee avatar stack — populated asynchronously by loadEventAttendees()
    // after the card is appended to the DOM.
    html += "<div class='event-attendees-row'></div>";

    html += "<div class='event-card-actions'>";
    html += "<button class='rsvp-btn' type='button'>RSVP</button>";
    // "View Details" opens a read-only modal with the full event info
    // (image, description, creator, "X going" count, etc.). It never
    // touches the backend, so it's safe to show for every event — even
    // ones the user can't edit or delete.
    html +=
      "<button class='event-view-btn' type='button'>View Details</button>";
    // Edit + Delete buttons. Shown when the logged-in user either:
    //   • created this event (case-insensitive username match), OR
    //   • has role === "admin"
    // We re-check on every render (rather than caching once at page
    // load) so the buttons react immediately if the user just unlocked
    // or exited admin mode in another tab. The backend ALSO re-verifies
    // ownership/role in MongoDB before honoring any change, so this UI
    // gate is purely cosmetic.
    if (event.id && canManageEvent(event)) {
      html +=
        "<button class='event-edit-btn' type='button'>Edit</button>" +
        "<button class='event-delete-btn' type='button'>Delete</button>";
    }
    html += "</div>";
    card.innerHTML = html;

    const rsvpButton = card.querySelector(".rsvp-btn");
    if (rsvpButton) {
      // If the logged-in user has already RSVP'd to this event (per the
      // /api/rsvps/:username response loaded once at page load), pre-mark
      // the button so it shows up green immediately. We deliberately
      // leave it ENABLED — clicking it again now CANCELS the RSVP via
      // DELETE /api/rsvp (handled inside sendRsvp → cancelRsvp). This
      // matches the exact state markAsRsvped() applies after a click,
      // so clicks and reloads look identical.
      if (
        rsvpedEventIds &&
        event.id &&
        rsvpedEventIds.has(event.id)
      ) {
        markAsRsvped(rsvpButton);
      }

      rsvpButton.addEventListener("click", function (clickEvent) {
        clickEvent.preventDefault();
        sendRsvp(rsvpButton, event);
      });
    }

    // "View Details" — opens the read-only details modal for this card.
    const viewBtn = card.querySelector(".event-view-btn");
    if (viewBtn) {
      viewBtn.addEventListener("click", function (clickEvent) {
        clickEvent.preventDefault();
        openEventDetailsModal(event);
      });
    }

    // Edit + Delete buttons. The same canManageEvent() check guards
    // both the rendering and the click handlers — so even if someone
    // re-adds the buttons via DevTools, they still hit the same gate.
    const editBtn = card.querySelector(".event-edit-btn");
    if (editBtn) {
      editBtn.addEventListener("click", function (clickEvent) {
        clickEvent.preventDefault();
        openEditEventModal(event, card);
      });
    }
    const deleteBtn = card.querySelector(".event-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", function (clickEvent) {
        clickEvent.preventDefault();
        deleteEvent(event, card, deleteBtn);
      });
    }
    return card;
  }

  // Returns true if the *currently logged-in* user is allowed to edit or
  // delete this event in the UI. The backend ALWAYS re-checks this rule
  // against MongoDB, so this helper is purely for showing/hiding buttons.
  // Allowed when:
  //   - the user is admin, OR
  //   - the user's username matches event.creatorUsername (case-insensitive)
  function canManageEvent(event) {
    const user = getCurrentUser();
    if (!user || !user.username) return false;
    if (user.role === "admin") return true;
    const me = String(user.username).trim().toLowerCase();
    const creator = String(event.creatorUsername || "").trim().toLowerCase();
    return creator !== "" && creator === me;
  }

  // DELETE /api/events/:id
  // Anyone may try to call this, but the backend only honors it when
  // the requester is the event's creator OR has role === "admin" in
  // MongoDB. We send the logged-in user's username + role from
  // localStorage so the backend can do its own check.
  function deleteEvent(event, card, button) {
    const user = getCurrentUser();
    if (!user || !user.username) {
      showEventsBanner("Please log in to delete events.", "error");
      return;
    }
    if (!event || !event.id) return;

    if (!canManageEvent(event)) {
      showEventsBanner("You can only modify events you created.", "error");
      return;
    }

    const ok = confirm(
      "Delete this event? This removes it for everyone and cannot be undone."
    );
    if (!ok) return;

    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = "Deleting\u2026";

    fetch(EVENTS_API_URL + "/" + encodeURIComponent(event.id), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user.username,
        email: user.email || "",
        // role is informational — the backend re-reads it from MongoDB.
        role: user.role || "user",
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
        if (!result.ok) {
          // Use the backend's exact error wording — that includes
          // "You can only modify events you created." for 403s.
          const message =
            (result.data && result.data.error) || "Could not delete event.";
          showEventsBanner(message, "error");
          button.disabled = false;
          button.textContent = originalLabel;
          return;
        }

        if (card && card.parentNode) {
          card.parentNode.removeChild(card);
        }
        showEventsBanner("Event deleted.", "success");
      })
      .catch(function (err) {
        console.error("DELETE /api/events/:id failed:", err);
        showEventsBanner(
          "Could not reach the server. Please try again later.",
          "error"
        );
        button.disabled = false;
        button.textContent = originalLabel;
      });
  }

  // -------------------------------------------------------------------------
  // View Details modal (read-only)
  // -------------------------------------------------------------------------
  // The markup lives in events.html (#event-details-overlay). When a user
  // clicks the "View Details" button on any event card we fill the body
  // with that event's full info (image, title, category, date, time,
  // location, description, creator, attendee count) and reveal the
  // overlay. The modal closes via the X button, an outside click, or
  // the Escape key.
  //
  // This block is purely client-side except for one tiny GET to fetch
  // the live attendee count from /api/rsvps/event/:id (the same endpoint
  // the card's avatar stack already uses). RSVP / Edit / Delete buttons
  // live on the card itself — never inside this modal — so opening it
  // can never accidentally mutate an event.
  const detailsOverlay = document.getElementById("event-details-overlay");
  const detailsBody = document.getElementById("event-details-body");
  const detailsCloseBtn = document.getElementById("event-details-close-btn");

  // Build the inner HTML of the modal body for one event. All user-
  // supplied text passes through escapeHtml() and the image src is
  // sanitized the same way as the cards (only data:image/*;base64,…).
  function buildEventDetailsHtml(event) {
    const safeTitle = escapeHtml(event.title || "Untitled event");
    const safeLocation = escapeHtml(event.location || "");
    const safeDescription = escapeHtml(event.description || "");
    const safeCreator = escapeHtml(event.creatorUsername || "");
    const categoryLabel = escapeHtml(formatCategoryLabel(event.category));
    const formattedDate = escapeHtml(formatEventDate(event.date));
    const formattedTime = escapeHtml(formatEventTime(event.time));
    const imgSrc = getSanitizedEventImageSrc(event.eventImage);

    let html = "";

    // Hero image (or a friendly placeholder).
    html += "<div class='event-details-image-frame'>";
    if (imgSrc) {
      html +=
        "<img class='event-details-image' src='" +
        imgSrc.replace(/'/g, "%27") +
        "' alt='' />";
    } else {
      html +=
        "<div class='event-details-image-placeholder' aria-hidden='true'>" +
          "<span class='event-details-image-placeholder-icon'>\uD83D\uDDBC\uFE0F</span>" +
          "<span class='event-details-image-placeholder-text'>No image</span>" +
        "</div>";
    }
    html += "</div>";

    // Title row (title + category badge).
    html += "<div class='event-details-header'>";
    html += "<h2 class='event-details-title-text'>" + safeTitle + "</h2>";
    if (categoryLabel) {
      html +=
        "<span class='event-details-category'>" + categoryLabel + "</span>";
    }
    html += "</div>";

    // Quick-facts list (date, time, location, creator, going).
    html += "<ul class='event-details-meta-list'>";
    if (formattedDate) {
      html +=
        "<li class='event-details-meta-row'>" +
          "<span class='event-meta-icon' aria-hidden='true'>\uD83D\uDCC5</span>" +
          "<span><strong>Date:</strong> " + formattedDate + "</span>" +
        "</li>";
    }
    if (formattedTime) {
      html +=
        "<li class='event-details-meta-row'>" +
          "<span class='event-meta-icon' aria-hidden='true'>\u23F0</span>" +
          "<span><strong>Time:</strong> " + formattedTime + "</span>" +
        "</li>";
    }
    if (safeLocation) {
      html +=
        "<li class='event-details-meta-row'>" +
          "<span class='event-meta-icon' aria-hidden='true'>\uD83D\uDCCD</span>" +
          "<span><strong>Location:</strong> " + safeLocation + "</span>" +
        "</li>";
    }
    if (safeCreator) {
      html +=
        "<li class='event-details-meta-row'>" +
          "<span class='event-meta-icon' aria-hidden='true'>\uD83D\uDC64</span>" +
          "<span><strong>Created by:</strong> @" + safeCreator + "</span>" +
        "</li>";
    }
    // The going count starts as a friendly loading hint and is replaced
    // by the live number once the GET /api/rsvps/event/:id call returns.
    html +=
      "<li class='event-details-meta-row event-details-going'>" +
        "<span class='event-meta-icon' aria-hidden='true'>\uD83D\uDC65</span>" +
        "<span><strong>Going:</strong> " +
          "<span class='event-details-going-count'>\u2026</span>" +
        "</span>" +
      "</li>";
    html += "</ul>";

    // Full description (no clamping in the modal — show it all).
    if (safeDescription) {
      html +=
        "<div class='event-details-description'>" +
          "<h4 class='event-details-section-heading'>About this event</h4>" +
          "<p>" + safeDescription + "</p>" +
        "</div>";
    }

    return html;
  }

  // Update the "Going: …" line with the real count once it loads.
  function updateGoingCount(count) {
    if (!detailsBody) return;
    const target = detailsBody.querySelector(".event-details-going-count");
    if (!target) return;
    const safe = typeof count === "number" && count >= 0 ? count : 0;
    target.textContent =
      safe + (safe === 1 ? " person going" : " people going");
  }

  function openEventDetailsModal(event) {
    if (!detailsOverlay || !detailsBody || !event) return;

    detailsBody.innerHTML = buildEventDetailsHtml(event);
    detailsOverlay.classList.remove("is-hidden");

    // Reset scroll so long descriptions always start from the top.
    detailsBody.scrollTop = 0;

    // Move keyboard focus to the close button so Esc / Tab navigation
    // feels expected.
    setTimeout(function () {
      if (detailsCloseBtn) detailsCloseBtn.focus();
    }, 0);

    // Fetch the live attendee count for this event and patch it in.
    if (event.id) {
      fetch(RSVPS_EVENT_API_URL + "/" + encodeURIComponent(event.id))
        .then(function (response) {
          if (!response.ok) return null;
          return response.json();
        })
        .then(function (data) {
          if (data && typeof data.count === "number") {
            updateGoingCount(data.count);
          } else {
            updateGoingCount(0);
          }
        })
        .catch(function () {
          // Network/parse problem — keep showing "…" rather than a wrong
          // number. The rest of the modal still works.
        });
    } else {
      updateGoingCount(0);
    }
  }

  function closeEventDetailsModal() {
    if (!detailsOverlay) return;
    detailsOverlay.classList.add("is-hidden");
    if (detailsBody) detailsBody.innerHTML = "";
  }

  // X button closes the modal.
  if (detailsCloseBtn) {
    detailsCloseBtn.addEventListener("click", closeEventDetailsModal);
  }

  // Click on the dark backdrop (but NOT the inner card) closes the modal.
  if (detailsOverlay) {
    detailsOverlay.addEventListener("click", function (clickEvent) {
      if (clickEvent.target === detailsOverlay) {
        closeEventDetailsModal();
      }
    });
  }

  // Escape key closes the details modal — only when it's actually open
  // and only when the edit modal isn't already taking the key (so we
  // don't fight with the existing edit-modal handler).
  document.addEventListener("keydown", function (keyEvent) {
    if (
      keyEvent.key === "Escape" &&
      detailsOverlay &&
      !detailsOverlay.classList.contains("is-hidden")
    ) {
      closeEventDetailsModal();
    }
  });

  // -------------------------------------------------------------------------
  // Edit Event modal
  // -------------------------------------------------------------------------
  // The markup lives in events.html (#edit-event-overlay). Here we wire
  // up the open/close behavior and the form submit, which sends a PUT
  // request to /api/events/:id. The backend uses the same permission
  // helper as DELETE — only the creator or an admin may save changes.

  const editOverlay = document.getElementById("edit-event-overlay");
  const editForm = document.getElementById("edit-event-form");
  const editIdInput = document.getElementById("edit-event-id");
  const editTitleInput = document.getElementById("edit-event-title");
  const editDateInput = document.getElementById("edit-event-date");
  const editTimeInput = document.getElementById("edit-event-time");
  const editLocationInput = document.getElementById("edit-event-location");
  const editCategoryInput = document.getElementById("edit-event-category");
  const editDescriptionInput = document.getElementById("edit-event-description");
  const editImageInput = document.getElementById("edit-event-image");
  const editImageRemoveBtn = document.getElementById(
    "edit-event-image-remove-btn"
  );
  const editImagePreview = document.getElementById("edit-event-image-preview");
  const editImagePlaceholder = document.getElementById(
    "edit-event-image-placeholder"
  );
  const editSubmitBtn = document.getElementById("edit-event-submit-btn");
  const editMessage = document.getElementById("edit-event-message");
  const editCloseBtn = document.getElementById("edit-event-close-btn");
  const editCancelBtn = document.getElementById("edit-event-cancel-btn");

  // Track which DOM card we're editing so the success path can update
  // it in place without a full re-fetch of the events list.
  let editingCard = null;
  // Mirror of the fetched event object for that card (used on save).
  // This fixes a subtle bug: the submit handler must not rely on a
  // variable named `event` from another function's scope.
  let editingEventRef = null;

  // When true, the next PUT includes `eventImage` so the server can update
  // or clear the picture. When false, text fields may change but the image
  // in MongoDB is left alone.
  let editShouldSendImagePatch = false;
  let editImageValueForPut = "";

  function showEditMessage(text, type) {
    if (!editMessage) return;
    editMessage.textContent = text || "";
    editMessage.classList.remove("is-success", "is-error");
    if (type === "success") editMessage.classList.add("is-success");
    if (type === "error") editMessage.classList.add("is-error");
  }

  function syncEditImagePreviewUi(imageString) {
    if (!editImagePreview || !editImagePlaceholder) return;
    const src = getSanitizedEventImageSrc(imageString || "");
    if (src) {
      editImagePreview.src = src;
      editImagePreview.classList.remove("is-hidden");
      editImagePlaceholder.classList.add("is-hidden");
    } else {
      editImagePreview.removeAttribute("src");
      editImagePreview.classList.add("is-hidden");
      editImagePlaceholder.classList.remove("is-hidden");
    }
  }

  // Convert a stored time like "18:00" or "6:00 PM" into the strict
  // "HH:MM" format <input type="time"> requires. If we can't parse it
  // we just leave the input blank so the user can re-enter it.
  function toTimeInputValue(value) {
    if (!value) return "";
    const hhmm = /^(\d{1,2}):(\d{2})/.exec(value);
    if (hhmm) {
      const h = String(Math.min(23, Math.max(0, Number(hhmm[1])))).padStart(2, "0");
      const m = String(Math.min(59, Math.max(0, Number(hhmm[2])))).padStart(2, "0");
      return h + ":" + m;
    }
    const parsed = new Date("1970-01-01T" + value);
    if (!isNaN(parsed.getTime())) {
      const h = String(parsed.getHours()).padStart(2, "0");
      const m = String(parsed.getMinutes()).padStart(2, "0");
      return h + ":" + m;
    }
    return "";
  }

  function openEditEventModal(event, card) {
    if (!editOverlay || !editForm) {
      // Modal markup missing — fall back to a friendly message instead
      // of crashing. (Shouldn't happen on events.html.)
      showEventsBanner("Edit form is unavailable on this page.", "error");
      return;
    }
    if (!canManageEvent(event)) {
      showEventsBanner("You can only modify events you created.", "error");
      return;
    }

    editingCard = card;
    editingEventRef = event;
    editShouldSendImagePatch = false;
    editImageValueForPut = "";
    if (editImageInput) editImageInput.value = "";
    syncEditImagePreviewUi(event.eventImage || "");
    showEditMessage("", null);

    editIdInput.value = event.id || "";
    editTitleInput.value = event.title || "";
    editDateInput.value = event.date || "";
    editTimeInput.value = toTimeInputValue(event.time);
    editLocationInput.value = event.location || "";
    editCategoryInput.value = (event.category || "").toLowerCase();
    editDescriptionInput.value = event.description || "";

    editOverlay.classList.remove("is-hidden");
    // Focus the first field so keyboard users can start typing right away.
    setTimeout(function () { editTitleInput.focus(); }, 0);
  }

  function closeEditEventModal() {
    if (!editOverlay) return;
    editOverlay.classList.add("is-hidden");
    editingCard = null;
    editingEventRef = null;
    editShouldSendImagePatch = false;
    editImageValueForPut = "";
    if (editImageInput) editImageInput.value = "";
    showEditMessage("", null);
  }

  if (editCloseBtn) editCloseBtn.addEventListener("click", closeEditEventModal);
  if (editCancelBtn) editCancelBtn.addEventListener("click", closeEditEventModal);

  // New image picked in the modal: read as Base64 data URL only if it looks
  // like an image MIME type — same idea as add-event.html.
  if (editImageInput) {
    editImageInput.addEventListener("change", function () {
      const file = editImageInput.files && editImageInput.files[0];
      if (!file) return;
      if (!file.type || file.type.indexOf("image/") !== 0) {
        showEditMessage("Please choose an image file (PNG, JPEG, etc.).", "error");
        editImageInput.value = "";
        return;
      }

      const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
      if (file.size > MAX_IMAGE_BYTES) {
        showEditMessage("Please choose an image under 2 MB.", "error");
        editImageInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = function () {
        const result = reader.result;
        if (typeof result !== "string") return;
        editShouldSendImagePatch = true;
        editImageValueForPut = result;
        syncEditImagePreviewUi(result);
        showEditMessage("", null);
      };
      reader.onerror = function () {
        showEditMessage("Could not read that file. Try a different image.", "error");
      };
      reader.readAsDataURL(file);
    });
  }

  if (editImageRemoveBtn) {
    editImageRemoveBtn.addEventListener("click", function () {
      if (editImageInput) editImageInput.value = "";
      editShouldSendImagePatch = true;
      editImageValueForPut = "";
      syncEditImagePreviewUi("");
    });
  }

  // Click the dark backdrop (but not the inner window) to close.
  if (editOverlay) {
    editOverlay.addEventListener("click", function (clickEvent) {
      if (clickEvent.target === editOverlay) {
        closeEditEventModal();
      }
    });
  }

  // Escape key closes the modal too — small UX detail but expected.
  document.addEventListener("keydown", function (keyEvent) {
    if (
      keyEvent.key === "Escape" &&
      editOverlay &&
      !editOverlay.classList.contains("is-hidden")
    ) {
      closeEditEventModal();
    }
  });

  if (editForm) {
    editForm.addEventListener("submit", function (submitEvent) {
      submitEvent.preventDefault();

      const eventId = editIdInput.value;
      if (!eventId) return;

      const user = getCurrentUser();
      if (!user || !user.username) {
        showEditMessage("You must be logged in to edit events.", "error");
        return;
      }

      // Quick client-side checks. The backend re-validates everything,
      // so this is just to give instant feedback.
      const title = editTitleInput.value.trim();
      const date = editDateInput.value.trim();
      const time = editTimeInput.value.trim();
      const location = editLocationInput.value.trim();
      const category = editCategoryInput.value.trim();
      const description = editDescriptionInput.value.trim();

      if (
        title === "" ||
        date === "" ||
        location === "" ||
        description === ""
      ) {
        showEditMessage(
          "Please fill in title, date, location, and description.",
          "error"
        );
        return;
      }

      editSubmitBtn.disabled = true;
      showEditMessage("Saving changes\u2026", null);

      const payload = {
        username: user.username,
        email: user.email || "",
        role: user.role || "user",
        title: title,
        date: date,
        time: time,
        location: location,
        category: category,
        description: description,
      };

      function sendEditPut(finalPayload) {
        return fetch(
          EVENTS_API_URL + "/" + encodeURIComponent(eventId),
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalPayload),
          }
        )
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
            editSubmitBtn.disabled = false;

            if (!result.ok) {
              const message =
                (result.data && result.data.error) || "Could not update event.";
              showEditMessage(message, "error");
              return;
            }

            if (!editingEventRef) {
              showEditMessage(
                "Lost track of this event. Refresh the page.",
                "error"
              );
              return;
            }

            // Replace the in-memory event object's fields so any
            // subsequent click on this card sees the new values.
            const updated = (result.data && result.data.event) || {};
            editingEventRef.title = updated.title || title;
            editingEventRef.date = updated.date || date;
            editingEventRef.time =
              updated.time !== undefined ? updated.time : time;
            editingEventRef.location = updated.location || location;
            editingEventRef.category =
              updated.category !== undefined ? updated.category : category;
            editingEventRef.description = updated.description || description;
            if (updated.eventImage !== undefined) {
              editingEventRef.eventImage = updated.eventImage;
            }
            if (updated.eventImageType !== undefined) {
              editingEventRef.eventImageType = updated.eventImageType;
            }

            // Swap the card in place with a freshly rendered version so
            // the user sees the new values without a full page reload.
            if (editingCard && editingCard.parentNode) {
              const rsvpedSet =
                editingCard.querySelector(".rsvp-btn.is-rsvped") !== null
                  ? new Set([editingEventRef.id])
                  : new Set();
              const newCard = createEventCard(editingEventRef, rsvpedSet);
              editingCard.parentNode.replaceChild(newCard, editingCard);
              if (editingEventRef.id) {
                loadEventAttendees(newCard, editingEventRef.id);
              }
            }

            showEditMessage("Event updated.", "success");
            showEventsBanner("Event updated.", "success");

            // Close the modal after a short pause so the success message
            // is visible for a moment.
            setTimeout(closeEditEventModal, 600);
          })
          .catch(function (err) {
            console.error("PUT /api/events/:id failed:", err);
            editSubmitBtn.disabled = false;
            showEditMessage(
              "Could not reach the server. Please try again later.",
              "error"
            );
          });
      }

      // Image patch: ALWAYS re-read the file from the input before PUT if there
      // is one selected, so Save never beats FileReader.onload.
      let imagePromise = Promise.resolve(null);
      if (editShouldSendImagePatch) {
        const pendingFile =
          editImageInput && editImageInput.files && editImageInput.files[0];
        if (pendingFile) {
          imagePromise = readLocalImageFileAsDataURL(pendingFile);
        }
      }

      imagePromise
        .then(function (freshDataUrlOrNull) {
          if (!editShouldSendImagePatch) {
            return payload;
          }
          const trimmedFromFile =
            typeof freshDataUrlOrNull === "string"
              ? freshDataUrlOrNull.trim()
              : "";
          let imgVal = "";
          if (
            editImageInput &&
            editImageInput.files &&
            editImageInput.files[0]
          ) {
            imgVal = trimmedFromFile;
          } else {
            imgVal = (editImageValueForPut || "").trim();
          }
          payload.eventImage = imgVal;
          payload.eventImageType = imgVal ? "uploaded" : "";
          return payload;
        })
        .then(sendEditPut)
        .catch(function (err) {
          console.warn("Reading edit image:", err);
          editSubmitBtn.disabled = false;
          showEditMessage(
            "Could not read the image file. Choose again or tap Remove.",
            "error"
          );
        });
    });
  }

  function showLoadingState() {
    const SKELETON_COUNT = 3;
    let html = "";
    for (let i = 0; i < SKELETON_COUNT; i++) {
      html +=
        "<div class='event-card skeleton-card' aria-hidden='true'>" +
          "<div class='skeleton-card-media'></div>" +
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

  // Loads the set of event IDs the *currently logged-in user* has already
  // RSVP'd to (via GET /api/rsvps/:username) so the events page can show
  // those buttons in the green "RSVP'd" state right away — even after a
  // page reload.
  //
  // This helper is intentionally forgiving: it ALWAYS resolves to a Set
  // (never rejects), so any of the following scenarios just leave us
  // with an empty Set and the events page still loads normally:
  //   - the user isn't logged in
  //   - the backend doesn't know this user yet (404)
  //   - the backend is unreachable / returns an error
  function fetchMyRsvpedEventIds() {
    const user = getCurrentUser();
    if (!user || !user.username) {
      return Promise.resolve(new Set());
    }

    const url = RSVPS_API_URL + "/" + encodeURIComponent(user.username);

    return fetch(url)
      .then(function (response) {
        // 404 just means there's no backend record for this username
        // (e.g. signed up only on the frontend). Treat as "no RSVPs".
        if (response.status === 404) return [];
        if (!response.ok) {
          throw new Error("Request failed with status " + response.status);
        }
        return response.json();
      })
      .then(function (events) {
        const ids = new Set();
        if (Array.isArray(events)) {
          events.forEach(function (event) {
            if (event && event.id) ids.add(event.id);
          });
        }
        return ids;
      })
      .catch(function (error) {
        // Don't block the page — just log and pretend the user has no
        // RSVPs yet. The button click flow will still work normally
        // because sendRsvp() is wired up regardless.
        console.warn("Could not load my RSVPs:", error);
        return new Set();
      });
  }

  function loadEvents() {
    showLoadingState();

    // Fetch the event list AND the user's already-RSVP'd event IDs in
    // parallel, then render once both are ready. Doing this in parallel
    // (instead of one after the other) keeps the page snappy.
    const eventsPromise = fetch(EVENTS_API_URL).then(function (response) {
      if (!response.ok) {
        throw new Error("Request failed with status " + response.status);
      }
      return response.json();
    });
    const rsvpsPromise = fetchMyRsvpedEventIds();

    Promise.all([eventsPromise, rsvpsPromise])
      .then(function (results) {
        const events = results[0];
        const rsvpedEventIds = results[1];

        eventsContainer.innerHTML = "";
        if (!Array.isArray(events) || events.length === 0) {
          showEmptyState();
          return;
        }
        events.forEach(function (event) {
          const card = createEventCard(event, rsvpedEventIds);
          eventsContainer.appendChild(card);
          if (event.id) {
            loadEventAttendees(card, event.id);
          }
        });
      })
      .catch(function (error) {
        // We only land here if the events fetch itself failed —
        // fetchMyRsvpedEventIds() never rejects. Show the standard
        // error state so the user can retry.
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
        // `role` defaults to "user" if the backend doesn't return one
        // (e.g. an older response shape) so admin-only UI stays hidden.
        setCurrentUser({
          id: user.id,
          fullName: user.name,
          username: user.username,
          email: user.email,
          role: user.role || "user"
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
        // rest of the app uses `fullName` — map it here. New accounts
        // always start with role "user"; admin is unlocked via the
        // Admin Key section in Settings.
        setCurrentUser({
          id: user.id,
          fullName: user.name,
          username: user.username,
          email: user.email,
          role: user.role || "user"
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

// --- Default profile pictures (emoji shown in UI; id sent to the API) ---
// profilePicture in MongoDB stores the `id` string with profilePictureType "default".
var DEFAULT_AVATARS = [
  { id: "heart", emoji: "\u2764\uFE0F", label: "Heart" },
  { id: "tree", emoji: "\uD83C\uDF33", label: "Tree" },
  { id: "star", emoji: "\u2B50", label: "Star" },
  { id: "music", emoji: "\uD83C\uDFB5", label: "Music" },
  { id: "game", emoji: "\uD83C\uDFAE", label: "Game" },
  { id: "book", emoji: "\uD83D\uDCDA", label: "Book" },
  { id: "moon", emoji: "\uD83C\uDF19", label: "Moon" },
  { id: "fire", emoji: "\uD83D\uDD25", label: "Fire" },
];

function getDefaultAvatar(id) {
  if (!id) return null;
  for (var i = 0; i < DEFAULT_AVATARS.length; i++) {
    if (DEFAULT_AVATARS[i].id === id) return DEFAULT_AVATARS[i];
  }
  return null;
}

// Same host as other fetch calls in this file (absolute URL works with file:// opens too).
var PROFILE_API_URL = "http://localhost:3000/api/profile";

function friendlyFetchErrorMessage(err) {
  var looksNetwork =
    err instanceof TypeError ||
    (err &&
      typeof err.message === "string" &&
      /failed to fetch|network|load failed/i.test(err.message));
  if (looksNetwork) {
    return "Could not reach backend. Make sure the server is running.";
  }
  if (err && typeof err.message === "string" && err.message !== "") {
    return err.message;
  }
  return "Could not save profile picture.";
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
  const avatarGridEl = document.getElementById("avatar-grid");
  const avatarMessageEl = document.getElementById("avatar-message");

  // Tracks what MongoDB has for this user's picture (updated after GET / PUT).
  var pictureState = (function readCachedPicture() {
    var u = getCurrentUser();
    return {
      profilePicture: (u && u.profilePicture) || "",
      profilePictureType: (u && u.profilePictureType) || "default",
    };
  })();

  function initialLetterForProfile(profile) {
    var source = (profile && (profile.fullName || profile.username)) || "U";
    var ch = String(source).trim().charAt(0);
    return (ch || "U").toUpperCase();
  }

  // Updates the big circle next to the user's name (matches MongoDB type).
  function renderHeaderAvatar(profile) {
    if (!avatarEl) return;

    avatarEl.classList.remove("has-emoji", "has-image");
    avatarEl.style.backgroundImage = "";

    if (
      pictureState.profilePictureType === "uploaded" &&
      typeof pictureState.profilePicture === "string" &&
      pictureState.profilePicture.trim() !== ""
    ) {
      var safeUrl = pictureState.profilePicture.replace(/"/g, '\\"');
      avatarEl.style.backgroundImage = 'url("' + safeUrl + '")';
      avatarEl.classList.add("has-image");
      avatarEl.textContent = "";
      return;
    }

    if (pictureState.profilePictureType === "default") {
      var def = getDefaultAvatar(pictureState.profilePicture);
      if (def) {
        avatarEl.textContent = def.emoji;
        avatarEl.classList.add("has-emoji");
        return;
      }
    }

    avatarEl.textContent = initialLetterForProfile(profile);
  }

  function setAvatarMessage(text, type) {
    if (!avatarMessageEl) return;
    avatarMessageEl.textContent = text || "";
    avatarMessageEl.classList.remove("is-info", "is-success", "is-error");
    if (type) avatarMessageEl.classList.add("is-" + type);
  }

  function renderAvatarGrid() {
    if (!avatarGridEl) return;
    avatarGridEl.innerHTML = "";

    DEFAULT_AVATARS.forEach(function (av) {
      var tile = document.createElement("button");
      tile.type = "button";
      tile.className = "avatar-tile";
      tile.setAttribute("data-avatar-id", av.id);
      tile.setAttribute("aria-label", "Use " + av.label + " avatar");

      var emojiSpan = document.createElement("span");
      emojiSpan.className = "avatar-tile-emoji";
      emojiSpan.setAttribute("aria-hidden", "true");
      emojiSpan.textContent = av.emoji;

      var labelSpan = document.createElement("span");
      labelSpan.className = "avatar-tile-label";
      labelSpan.textContent = av.label;

      tile.appendChild(emojiSpan);
      tile.appendChild(labelSpan);

      var isSelected =
        pictureState.profilePictureType === "default" &&
        pictureState.profilePicture === av.id;
      tile.setAttribute("aria-pressed", isSelected ? "true" : "false");
      if (isSelected) tile.classList.add("is-selected");

      tile.addEventListener("click", function () {
        handleAvatarPick(av.id);
      });

      avatarGridEl.appendChild(tile);
    });
  }

  function syncPictureToCurrentUser(newState) {
    var current = getCurrentUser();
    if (!current) return;
    current.profilePicture = newState.profilePicture;
    current.profilePictureType = newState.profilePictureType;
    setCurrentUser(current);
  }

  function handleAvatarPick(avatarId) {
    var current = getCurrentUser();
    if (!current || !current.username) {
      setAvatarMessage("Please log in to save a profile picture.", "error");
      return;
    }

    var previousState = {
      profilePicture: pictureState.profilePicture,
      profilePictureType: pictureState.profilePictureType,
    };

    // Preview right away (optimistic), then confirm with the server.
    pictureState = {
      profilePicture: avatarId,
      profilePictureType: "default",
    };
    renderAvatarGrid();
    renderHeaderAvatar(loadProfile());
    setAvatarMessage("Saving\u2026", "info");
    if (avatarGridEl) avatarGridEl.classList.add("is-saving");

    var url =
      PROFILE_API_URL +
      "/" +
      encodeURIComponent(current.username) +
      "/picture";

    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profilePicture: avatarId,
        profilePictureType: "default",
      }),
    })
      .then(function (resp) {
        return resp.json().then(
          function (data) {
            return { ok: resp.ok, data: data };
          },
          function () {
            return { ok: resp.ok, data: {} };
          }
        );
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(
            (result.data && result.data.error) ||
              "Could not save profile picture."
          );
        }

        var savedUser = result.data && result.data.user;
        if (savedUser) {
          pictureState = {
            profilePicture: savedUser.profilePicture || "",
            profilePictureType: savedUser.profilePictureType || "default",
          };
          syncPictureToCurrentUser(pictureState);
        }

        renderAvatarGrid();
        renderHeaderAvatar(loadProfile());
        setAvatarMessage("Profile picture saved.", "success");
      })
      .catch(function (err) {
        console.error("PUT /api/profile/:username/picture failed:", err);
        pictureState = previousState;
        renderAvatarGrid();
        renderHeaderAvatar(loadProfile());
        setAvatarMessage(friendlyFetchErrorMessage(err), "error");
      })
      .then(function () {
        if (avatarGridEl) avatarGridEl.classList.remove("is-saving");
      });
  }

  // Max raw file size before Base64 (~33% larger). Keeps the JSON body
  // under the backend express.json "10mb" limit with room to spare.
  var MAX_PROFILE_UPLOAD_BYTES = 5 * 1024 * 1024;

  var avatarUploadBtn = document.getElementById("avatar-upload-btn");
  var avatarUploadInput = document.getElementById("avatar-upload-input");

  // Sends Base64 data URL to PUT /api/profile/:username/picture.
  // Rolls back pictureState to previousState if the request fails.
  function saveUploadedAvatar(username, base64, previousState, inputEl) {
    setAvatarMessage("Uploading\u2026", "info");
    if (avatarGridEl) avatarGridEl.classList.add("is-saving");

    var url =
      PROFILE_API_URL +
      "/" +
      encodeURIComponent(username) +
      "/picture";

    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profilePicture: base64,
        profilePictureType: "uploaded",
      }),
    })
      .then(function (resp) {
        return resp.json().then(
          function (data) {
            return { ok: resp.ok, data: data };
          },
          function () {
            return { ok: resp.ok, data: {} };
          }
        );
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(
            (result.data && result.data.error) ||
              "Could not save profile picture."
          );
        }

        var savedUser = result.data && result.data.user;
        if (savedUser) {
          pictureState = {
            profilePicture: savedUser.profilePicture || "",
            profilePictureType:
              savedUser.profilePictureType || "default",
          };
          syncPictureToCurrentUser(pictureState);
        }

        renderAvatarGrid();
        renderHeaderAvatar(loadProfile());
        setAvatarMessage("Profile picture uploaded.", "success");
      })
      .catch(function (err) {
        console.error(
          "PUT /api/profile/:username/picture (upload) failed:",
          err
        );
        pictureState = previousState;
        renderAvatarGrid();
        renderHeaderAvatar(loadProfile());
        setAvatarMessage(friendlyFetchErrorMessage(err), "error");
      })
      .then(function () {
        if (avatarGridEl) avatarGridEl.classList.remove("is-saving");
        if (inputEl) inputEl.value = "";
      });
  }

  function handleAvatarUploadChange(event) {
    var input = event.target;
    var file = input.files && input.files[0];
    if (!file) return;

    if (!file.type || file.type.indexOf("image/") !== 0) {
      setAvatarMessage(
        "Please choose an image file (JPG, PNG, GIF, WebP, etc.).",
        "error"
      );
      input.value = "";
      return;
    }

    if (file.size > MAX_PROFILE_UPLOAD_BYTES) {
      setAvatarMessage(
        "That file is too large. Please pick an image under 5 MB.",
        "error"
      );
      input.value = "";
      return;
    }

    var current = getCurrentUser();
    if (!current || !current.username) {
      setAvatarMessage(
        "Please log in to upload a profile picture.",
        "error"
      );
      input.value = "";
      return;
    }

    setAvatarMessage("Reading image\u2026", "info");

    var previousState = {
      profilePicture: pictureState.profilePicture,
      profilePictureType: pictureState.profilePictureType,
    };

    var reader = new FileReader();
    reader.onload = function () {
      var base64 = reader.result;
      if (typeof base64 !== "string" || base64 === "") {
        setAvatarMessage(
          "Could not read that image. Try a different file.",
          "error"
        );
        input.value = "";
        return;
      }

      // Preview immediately (same string we send to the server).
      pictureState = {
        profilePicture: base64,
        profilePictureType: "uploaded",
      };
      renderAvatarGrid();
      renderHeaderAvatar(loadProfile());

      saveUploadedAvatar(current.username, base64, previousState, input);
    };

    reader.onerror = function () {
      console.error("FileReader error:", reader.error);
      setAvatarMessage(
        "Could not read that image. Try a different file.",
        "error"
      );
      input.value = "";
    };

    reader.readAsDataURL(file);
  }

  if (avatarUploadBtn && avatarUploadInput) {
    avatarUploadBtn.addEventListener("click", function () {
      avatarUploadInput.click();
    });
    avatarUploadInput.addEventListener("change", handleAvatarUploadChange);
  }

  function fetchProfilePictureFromServer() {
    var current = getCurrentUser();
    if (!current || !current.username) return;

    var url =
      PROFILE_API_URL + "/" + encodeURIComponent(current.username);

    fetch(url)
      .then(function (resp) {
        if (!resp.ok) return null;
        return resp.json();
      })
      .then(function (data) {
        if (!data || !data.user) return;
        pictureState = {
          profilePicture: data.user.profilePicture || "",
          profilePictureType: data.user.profilePictureType || "default",
        };
        syncPictureToCurrentUser(pictureState);
        renderAvatarGrid();
        renderHeaderAvatar(loadProfile());
      })
      .catch(function (err) {
        console.error("GET /api/profile/:username failed:", err);
      });
  }

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

    // Header avatar: uploaded image, default emoji, or first-letter fallback
    renderHeaderAvatar(profile);

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

  // Profile picture grid + load saved avatar from MongoDB
  renderAvatarGrid();
  fetchProfilePictureFromServer();
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
// - The button toggles "Send Request" / "Cancel Request": POST
//   /api/friends/request to send, DELETE /api/friend-requests/cancel to
//   withdraw a pending request. Outgoing state is mirrored in localStorage
//   (`liveEventOutgoingFriendRequests`) so the Friends page stays in sync.
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
  const FRIEND_REQUEST_CANCEL_API_URL =
    "http://localhost:3000/api/friend-requests/cancel";

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

  // Remove a receiver from the local outgoing list (after cancel or 404).
  function forgetOutgoing(receiverUsername) {
    const lower = String(receiverUsername || "").toLowerCase();
    if (!lower) return;
    const list = getOutgoingFriendRequests();
    const filtered = list.filter(function (entry) {
      return String(entry.receiverUsername || "").toLowerCase() !== lower;
    });
    if (filtered.length !== list.length) {
      setOutgoingFriendRequests(filtered);
    }
  }

  // Sends DELETE /api/friend-requests/cancel and resets the button to
  // "Send Request" when the pending row is removed (or already gone).
  function cancelFriendRequest(user, button) {
    const me = getCurrentUser();
    const senderUsername =
      me && me.username ? String(me.username).trim() : "";
    const receiverUsername =
      user && user.username ? String(user.username).trim() : "";

    if (senderUsername === "") {
      setSearchMessage(
        "Please log in to cancel friend requests.",
        "error"
      );
      return;
    }
    if (receiverUsername === "") {
      setSearchMessage(
        "This user has no username — can't cancel a request.",
        "error"
      );
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Canceling\u2026";
    setSearchMessage("Canceling friend request\u2026", "info");

    fetch(FRIEND_REQUEST_CANCEL_API_URL, {
      method: "DELETE",
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
            return {
              ok: response.ok,
              status: response.status,
              data: data,
            };
          })
          .catch(function () {
            return { ok: response.ok, status: response.status, data: {} };
          });
      })
      .then(function (result) {
        if (result.ok && result.status === 200) {
          forgetOutgoing(receiverUsername);
          button.textContent = "Send Request";
          button.disabled = false;
          setSearchMessage(
            "Friend request to @" + receiverUsername + " canceled.",
            "success"
          );
          return;
        }

        if (result.status === 404) {
          forgetOutgoing(receiverUsername);
          button.textContent = "Send Request";
          button.disabled = false;
          setSearchMessage(
            "No pending request found — you can send a new one.",
            "info"
          );
          return;
        }

        const serverError =
          (result.data && result.data.error) ||
          "Could not cancel friend request.";
        button.disabled = false;
        button.textContent = originalText;
        setSearchMessage(serverError, "error");
      })
      .catch(function (error) {
        console.error("DELETE /api/friend-requests/cancel failed:", error);
        button.disabled = false;
        button.textContent = originalText;
        setSearchMessage(
          "Could not reach the server. Please try again later.",
          "error"
        );
      });
  }

  // Click handler for the friend-request button on a search result card.
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
          rememberOutgoing(receiverUsername);
          button.textContent = "Cancel Request";
          button.disabled = false;
          setSearchMessage(
            "Friend request sent to @" + receiverUsername + ".",
            "success"
          );
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
          rememberOutgoing(receiverUsername);
          button.textContent = "Cancel Request";
          button.disabled = false;
          setSearchMessage(
            "You've already sent @" + receiverUsername + " a friend request.",
            "info"
          );
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
    addFriendBtn.textContent = "Send Request";

    // Pre-flight UI hints so the user doesn't have to click to find out:
    //   1. If the result IS the logged-in user, label it "That's you".
    //   2. If we already sent this user a request (cached in localStorage),
    //      label it "Cancel Request" so they can withdraw it.
    const receiverLower = (user.username || "").toLowerCase();
    const me = getCurrentUser();
    const myUsernameLower =
      me && me.username ? String(me.username).toLowerCase() : "";

    if (receiverLower && myUsernameLower && receiverLower === myUsernameLower) {
      addFriendBtn.disabled = true;
      addFriendBtn.textContent = "That's you";
    } else if (receiverLower && hasOutgoingTo(receiverLower)) {
      addFriendBtn.textContent = "Cancel Request";
    }

    addFriendBtn.addEventListener("click", function () {
      const lower = (user.username || "").toLowerCase();
      if (hasOutgoingTo(lower)) {
        cancelFriendRequest(user, addFriendBtn);
      } else {
        sendFriendRequest(user, addFriendBtn);
      }
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

  var socket = null;
  if (typeof io === "function") {
    socket = io("http://localhost:3000");
    socket.on("connect", function () {
      socket.emit("join", myUsername);
      console.log("[socket] connected and joined", {
        socketId: socket.id,
        username: myUsername,
      });
    });
    socket.on("connect_error", function (err) {
      console.error("[socket] connect_error", err && err.message ? err.message : err);
    });
  }

  const FRIENDS_API_URL = "http://localhost:3000/api/friends";
  const REMOVE_FRIEND_API_URL = "http://localhost:3000/api/friends/remove";
  const REQUESTS_API_URL = "http://localhost:3000/api/friends/requests";
  const ACCEPT_API_URL = "http://localhost:3000/api/friends/accept";
  const DENY_API_URL = "http://localhost:3000/api/friends/deny";
  const GROUP_CHATS_API_URL = "http://localhost:3000/api/groupchats";

  /** Cached friends list for group create / add-member pickers. */
  var friendsListCache = [];

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

    var actions = document.createElement("div");
    actions.className = "user-result-actions friend-actions";
    var msgBtn = document.createElement("button");
    msgBtn.type = "button";
    msgBtn.className = "btn btn-primary friend-action-btn friend-msg-btn";
    msgBtn.textContent = "Message";
    msgBtn.addEventListener("click", function () {
      openChat(friend.username);
    });
    actions.appendChild(msgBtn);

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className =
      "btn btn-secondary friend-action-btn friend-remove-btn";
    removeBtn.textContent = "Remove Friend";
    removeBtn.addEventListener("click", function () {
      var friendUsername =
        friend && friend.username ? String(friend.username).trim() : "";
      if (friendUsername === "") {
        setPageMessage("Could not remove friend — missing username.", "error");
        return;
      }

      var originalLabel = removeBtn.textContent;
      removeBtn.disabled = true;
      msgBtn.disabled = true;
      removeBtn.textContent = "Removing\u2026";
      setPageMessage("", "");

      fetch(REMOVE_FRIEND_API_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernameA: myUsername,
          usernameB: friendUsername,
        }),
      })
        .then(function (response) {
          return response
            .json()
            .then(function (data) {
              return {
                ok: response.ok,
                status: response.status,
                data: data,
              };
            })
            .catch(function () {
              return { ok: response.ok, status: response.status, data: {} };
            });
        })
        .then(function (result) {
          if (result.ok && result.status === 200) {
            card.remove();
            if (friendsListEl.children.length === 0) {
              renderEmptyInto(
                friendsListEl,
                "You don't have any friends yet. Try searching on the profile page."
              );
            }
            setPageMessage(
              "Removed @" + friendUsername + " from your friends.",
              "success"
            );
            return;
          }

          var serverError =
            (result.data && result.data.error) ||
            "Could not remove friend.";
          removeBtn.disabled = false;
          msgBtn.disabled = false;
          removeBtn.textContent = originalLabel;
          setPageMessage(serverError, "error");
        })
        .catch(function (error) {
          console.error("DELETE /api/friends/remove failed:", error);
          removeBtn.disabled = false;
          msgBtn.disabled = false;
          removeBtn.textContent = originalLabel;
          setPageMessage(
            "Could not reach the server. Please try again later.",
            "error"
          );
        });
    });
    actions.appendChild(removeBtn);
    card.appendChild(actions);

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
        friendsListCache = Array.isArray(friends) ? friends.slice() : [];
        renderFriends(friends);
        cleanUpOutgoingAfterFriendsLoad(friends);
        // Re-render outgoing in case we removed accepted entries.
        renderOutgoing();
        refreshGroupCreateMemberCheckboxes();
      })
      .catch(function (error) {
        console.error("Failed to load friends:", error);
        friendsListCache = [];
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
  // 3b) GROUP CHATS
  // -------------------------------------------------------------------------
  const groupChatsListEl = document.getElementById("group-chats-list");
  const groupCreatePanel = document.getElementById("group-create-panel");
  const groupCreateToggleBtn = document.getElementById("group-create-toggle-btn");
  const groupCreateForm = document.getElementById("group-create-form");
  const groupCreateNameInput = document.getElementById("group-create-name");
  const groupCreateMembersEl = document.getElementById("group-create-members");
  const groupCreateCancelBtn = document.getElementById("group-create-cancel-btn");
  const groupCreateSubmitBtn = document.getElementById("group-create-submit");

  const groupChatOverlay = document.getElementById("group-chat-overlay");
  const groupChatTitleEl = document.getElementById("group-chat-title");
  const groupChatCloseBtn = document.getElementById("group-chat-close-btn");
  const groupChatMessagesEl = document.getElementById("group-chat-messages");
  const groupChatForm = document.getElementById("group-chat-form");
  const groupChatInput = document.getElementById("group-chat-input");
  const groupChatSendBtn = document.getElementById("group-chat-send-btn");
  const groupChatMembersListEl = document.getElementById("group-chat-members-list");
  const groupChatAddMemberBtn = document.getElementById("group-chat-add-member-btn");
  const groupChatLeaveBtn = document.getElementById("group-chat-leave-btn");
  const groupChatDeleteBtn = document.getElementById("group-chat-delete-btn");
  const groupChatAddMemberRow = document.getElementById("group-chat-add-member-row");
  const groupChatAddMemberInput = document.getElementById("group-chat-add-member-input");
  const groupChatAddMemberConfirm = document.getElementById("group-chat-add-member-confirm");

  /** @type {{ id: string, name: string, creatorUsername: string, members: string[] } | null} */
  var activeGroupChat = null;

  function renderGroupChatMembers(members) {
    if (!groupChatMembersListEl) return;
    groupChatMembersListEl.innerHTML = "";
    var list = Array.isArray(members) ? members : [];
    if (list.length === 0) {
      var empty = document.createElement("p");
      empty.className = "group-chat-member-row";
      empty.textContent = "No members found.";
      groupChatMembersListEl.appendChild(empty);
      return;
    }
    list.forEach(function (memberUsername) {
      var row = document.createElement("p");
      row.className = "group-chat-member-row";
      row.textContent = "@" + String(memberUsername || "");
      groupChatMembersListEl.appendChild(row);
    });
  }

  function refreshActiveGroupChatDetails() {
    if (!activeGroupChat) return Promise.resolve(null);
    return fetch(GROUP_CHATS_API_URL + "/" + encodeURIComponent(activeGroupChat.id))
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        }).catch(function () {
          return { ok: response.ok, data: {} };
        });
      })
      .then(function (result) {
        if (result.ok && result.data) {
          activeGroupChat.name = result.data.name || activeGroupChat.name;
          activeGroupChat.creatorUsername = String(
            result.data.creatorUsername || activeGroupChat.creatorUsername || ""
          ).toLowerCase();
          activeGroupChat.members = Array.isArray(result.data.members)
            ? result.data.members.slice()
            : [];
          if (groupChatTitleEl) groupChatTitleEl.textContent = activeGroupChat.name;
          if (groupChatDeleteBtn) {
            var showDelete =
              activeGroupChat.creatorUsername === String(myUsername).toLowerCase();
            groupChatDeleteBtn.classList.toggle("is-hidden", !showDelete);
          }
          renderGroupChatMembers(activeGroupChat.members);
        }
        return result;
      })
      .catch(function (err) {
        console.error("Failed to load group details:", err);
        return { ok: false, data: {} };
      });
  }

  function setGroupCreatePanelVisible(show) {
    if (!groupCreatePanel) return;
    if (show) {
      groupCreatePanel.classList.remove("is-hidden");
      groupCreatePanel.setAttribute("aria-hidden", "false");
      refreshGroupCreateMemberCheckboxes();
      if (groupCreateNameInput) groupCreateNameInput.focus();
    } else {
      groupCreatePanel.classList.add("is-hidden");
      groupCreatePanel.setAttribute("aria-hidden", "true");
    }
  }

  function refreshGroupCreateMemberCheckboxes() {
    if (!groupCreateMembersEl) return;
    groupCreateMembersEl.innerHTML = "";
    if (!friendsListCache.length) {
      var empty = document.createElement("p");
      empty.className = "friend-empty";
      empty.textContent =
        "Add friends first — then you can invite them to a group.";
      groupCreateMembersEl.appendChild(empty);
      return;
    }
    friendsListCache.forEach(function (friend, index) {
      var username = friend && friend.username ? String(friend.username) : "";
      if (username === "") return;
      var id = "group-create-member-" + index;
      var label = document.createElement("label");
      label.className = "group-create-member-label";
      label.setAttribute("for", id);
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = id;
      cb.value = username;
      label.appendChild(cb);
      var span = document.createElement("span");
      span.textContent = "@" + username;
      label.appendChild(span);
      groupCreateMembersEl.appendChild(label);
    });
  }

  if (groupCreateToggleBtn) {
    groupCreateToggleBtn.addEventListener("click", function () {
      var hidden =
        groupCreatePanel && groupCreatePanel.classList.contains("is-hidden");
      setGroupCreatePanelVisible(hidden);
    });
  }

  if (groupCreateCancelBtn) {
    groupCreateCancelBtn.addEventListener("click", function () {
      setGroupCreatePanelVisible(false);
      if (groupCreateForm) groupCreateForm.reset();
    });
  }

  if (groupCreateForm) {
    groupCreateForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = groupCreateNameInput
        ? String(groupCreateNameInput.value).trim()
        : "";
      if (name === "") {
        setPageMessage("Please enter a group name.", "error");
        return;
      }

      var selected = [];
      if (groupCreateMembersEl) {
        var boxes = groupCreateMembersEl.querySelectorAll(
          'input[type="checkbox"]:checked'
        );
        boxes.forEach(function (box) {
          if (box.value) selected.push(box.value);
        });
      }

      if (groupCreateSubmitBtn) groupCreateSubmitBtn.disabled = true;
      setPageMessage("Creating group\u2026", "info");

      fetch(GROUP_CHATS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          creatorUsername: myUsername,
          members: selected,
        }),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, status: response.status, data: data };
          }).catch(function () {
            return { ok: response.ok, status: response.status, data: {} };
          });
        })
        .then(function (result) {
          if (result.ok && result.status === 201) {
            setPageMessage("Group chat created.", "success");
            setGroupCreatePanelVisible(false);
            groupCreateForm.reset();
            loadGroupChats();
          } else {
            var err =
              (result.data && result.data.error) ||
              "Could not create group chat.";
            setPageMessage(err, "error");
          }
        })
        .catch(function (err) {
          console.error("POST /api/groupchats failed:", err);
          setPageMessage(
            "Could not reach the server. Please try again later.",
            "error"
          );
        })
        .finally(function () {
          if (groupCreateSubmitBtn) groupCreateSubmitBtn.disabled = false;
        });
    });
  }

  function buildGroupChatCard(chat) {
    var card = document.createElement("article");
    card.className = "user-result-card friend-card group-chat-card";
    card.setAttribute("data-group-id", String(chat.id || ""));
    var info = document.createElement("div");
    info.className = "user-result-info";
    var title = document.createElement("p");
    title.className = "user-result-name";
    title.textContent = chat.name || "Group";
    info.appendChild(title);
    var meta = document.createElement("p");
    meta.className = "user-result-handle group-chat-meta";
    var n = (chat.members && chat.members.length) || 0;
    meta.textContent =
      n + " member" + (n === 1 ? "" : "s");
    info.appendChild(meta);
    card.appendChild(info);
    card.style.cursor = "pointer";
    card.addEventListener("click", function () {
      openGroupChat(chat);
    });
    return card;
  }

  function renderGroupChatList(chats) {
    if (!groupChatsListEl) return;
    if (!Array.isArray(chats) || chats.length === 0) {
      renderEmptyInto(
        groupChatsListEl,
        "You are not in any group chats yet. Create one above."
      );
      return;
    }
    groupChatsListEl.innerHTML = "";
    chats.forEach(function (c) {
      groupChatsListEl.appendChild(buildGroupChatCard(c));
    });
  }

  function loadGroupChats() {
    if (!groupChatsListEl) return;
    renderLoadingInto(groupChatsListEl);
    var url =
      GROUP_CHATS_API_URL + "/" + encodeURIComponent(myUsername);
    fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Request failed with status " + response.status);
        }
        return response.json();
      })
      .then(function (chats) {
        renderGroupChatList(chats);
      })
      .catch(function (error) {
        console.error("Failed to load group chats:", error);
        renderEmptyInto(
          groupChatsListEl,
          "Could not load group chats. Make sure the backend server is running."
        );
      });
  }

  function formatGroupMessageTimestamp(isoString) {
    if (!isoString) return "";
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function renderGroupChatMessages(messages) {
    if (!groupChatMessagesEl) return;
    groupChatMessagesEl.innerHTML = "";

    if (!Array.isArray(messages) || messages.length === 0) {
      var empty = document.createElement("p");
      empty.className = "chat-empty";
      empty.textContent = "No messages yet. Say hello!";
      groupChatMessagesEl.appendChild(empty);
      return;
    }

    var myLower = String(myUsername).toLowerCase();
    messages.forEach(function (msg) {
      var bubble = document.createElement("div");
      var isMine =
        String(msg.senderUsername || "").toLowerCase() === myLower;
      bubble.className =
        "chat-bubble" +
        (isMine ? " chat-bubble--sent" : " chat-bubble--received");

      var senderEl = document.createElement("span");
      senderEl.className = "chat-bubble-sender";
      senderEl.textContent = isMine
        ? "You"
        : "@" + (msg.senderUsername || "?");
      bubble.appendChild(senderEl);

      var textEl = document.createElement("p");
      textEl.className = "chat-bubble-text";
      textEl.textContent = msg.text || "";
      bubble.appendChild(textEl);

      var timeEl = document.createElement("time");
      timeEl.className = "chat-bubble-time group-chat-bubble-time";
      timeEl.dateTime = msg.createdAt ? String(msg.createdAt) : "";
      timeEl.textContent = formatGroupMessageTimestamp(msg.createdAt);
      bubble.appendChild(timeEl);

      groupChatMessagesEl.appendChild(bubble);
    });

    groupChatMessagesEl.scrollTop = groupChatMessagesEl.scrollHeight;
  }

  function loadGroupChatMessages() {
    if (!groupChatMessagesEl || !activeGroupChat) return;
    groupChatMessagesEl.innerHTML =
      "<p class='chat-loading'>Loading\u2026</p>";

    var url =
      GROUP_CHATS_API_URL +
      "/" +
      encodeURIComponent(activeGroupChat.id) +
      "/messages";

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("Status " + response.status);
        return response.json();
      })
      .then(function (messages) {
        renderGroupChatMessages(messages);
      })
      .catch(function (err) {
        console.error("Failed to load group messages:", err);
        groupChatMessagesEl.innerHTML =
          "<p class='chat-empty'>Could not load messages.</p>";
      });
  }

  function closeGroupChat() {
    if (!groupChatOverlay) return;
    groupChatOverlay.classList.add("is-hidden");
    activeGroupChat = null;
    if (groupChatAddMemberRow) {
      groupChatAddMemberRow.classList.add("is-hidden");
    }
    renderGroupChatMembers([]);
    loadGroupChats();
  }

  function openGroupChat(chat) {
    if (!groupChatOverlay || !chat || !chat.id) return;
    closeChat();
    activeGroupChat = {
      id: String(chat.id),
      name: chat.name || "Group",
      creatorUsername: String(chat.creatorUsername || "").toLowerCase(),
      members: Array.isArray(chat.members) ? chat.members.slice() : [],
    };
    if (groupChatTitleEl) {
      groupChatTitleEl.textContent = activeGroupChat.name;
    }
    if (groupChatAddMemberRow) {
      groupChatAddMemberRow.classList.add("is-hidden");
    }
    groupChatOverlay.classList.remove("is-hidden");
    if (socket) {
      socket.emit("join-group", activeGroupChat.id);
    }
    renderGroupChatMembers(activeGroupChat.members);
    refreshActiveGroupChatDetails();
    loadGroupChatMessages();
    if (groupChatDeleteBtn) {
      var showDelete =
        activeGroupChat.creatorUsername === String(myUsername).toLowerCase();
      groupChatDeleteBtn.classList.toggle("is-hidden", !showDelete);
    }
    if (groupChatInput) {
      groupChatInput.value = "";
      groupChatInput.focus();
    }
  }

  if (groupChatCloseBtn) {
    groupChatCloseBtn.addEventListener("click", closeGroupChat);
  }

  if (groupChatOverlay) {
    groupChatOverlay.addEventListener("click", function (e) {
      if (e.target === groupChatOverlay) closeGroupChat();
    });
  }

  if (groupChatAddMemberBtn) {
    groupChatAddMemberBtn.addEventListener("click", function () {
      if (!activeGroupChat) return;
      if (groupChatAddMemberRow) {
        groupChatAddMemberRow.classList.remove("is-hidden");
      }
      if (groupChatAddMemberInput) groupChatAddMemberInput.focus();
    });
  }

  function removeGroupFromDisplayedList(groupId) {
    if (!groupChatsListEl || !groupId) return;
    var cards = groupChatsListEl.querySelectorAll(".group-chat-card");
    cards.forEach(function (card) {
      if (card.getAttribute("data-group-id") === String(groupId)) {
        card.remove();
      }
    });
    if (groupChatsListEl.children.length === 0) {
      renderEmptyInto(
        groupChatsListEl,
        "You are not in any group chats yet. Create one above."
      );
    }
  }

  if (groupChatLeaveBtn) {
    groupChatLeaveBtn.addEventListener("click", function () {
      if (!activeGroupChat) return;
      groupChatLeaveBtn.disabled = true;
      var leaveUsername = myUsername;
      fetch(
        GROUP_CHATS_API_URL +
          "/" +
          encodeURIComponent(activeGroupChat.id) +
          "/messages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderUsername: "system",
            text: leaveUsername + " has left the group",
          }),
        }
      )
        .catch(function (err) {
          // Best effort: still attempt to leave if system message fails.
          console.error("Failed to post leave system message:", err);
        })
        .then(function () {
          return fetch(
        GROUP_CHATS_API_URL +
          "/" +
          encodeURIComponent(activeGroupChat.id) +
          "/members",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: myUsername }),
        }
      );
        })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          }).catch(function () {
            return { ok: response.ok, data: {} };
          });
        })
        .then(function (result) {
          if (result.ok) {
            var removedId = activeGroupChat ? activeGroupChat.id : "";
            closeGroupChat();
            removeGroupFromDisplayedList(removedId);
            setPageMessage("You left the group.", "success");
          } else {
            var err =
              (result.data && result.data.error) || "Could not leave group.";
            setPageMessage(err, "error");
          }
        })
        .catch(function (err) {
          console.error("DELETE /api/groupchats/:id/members failed:", err);
          setPageMessage(
            "Could not reach the server. Please try again later.",
            "error"
          );
        })
        .finally(function () {
          groupChatLeaveBtn.disabled = false;
        });
    });
  }

  if (groupChatDeleteBtn) {
    groupChatDeleteBtn.addEventListener("click", function () {
      if (!activeGroupChat) return;
      groupChatDeleteBtn.disabled = true;
      fetch(
        GROUP_CHATS_API_URL + "/" + encodeURIComponent(activeGroupChat.id),
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: myUsername }),
        }
      )
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          }).catch(function () {
            return { ok: response.ok, data: {} };
          });
        })
        .then(function (result) {
          if (result.ok) {
            var removedId = activeGroupChat ? activeGroupChat.id : "";
            closeGroupChat();
            removeGroupFromDisplayedList(removedId);
            setPageMessage("Group deleted.", "success");
          } else {
            var err =
              (result.data && result.data.error) || "Could not delete group.";
            setPageMessage(err, "error");
          }
        })
        .catch(function (err) {
          console.error("DELETE /api/groupchats/:id failed:", err);
          setPageMessage(
            "Could not reach the server. Please try again later.",
            "error"
          );
        })
        .finally(function () {
          groupChatDeleteBtn.disabled = false;
        });
    });
  }

  if (groupChatAddMemberConfirm) {
    groupChatAddMemberConfirm.addEventListener("click", function () {
      if (!activeGroupChat || !groupChatAddMemberInput) return;
      var username = String(groupChatAddMemberInput.value || "").trim();
      if (username === "") {
        setPageMessage("Choose a friend to add.", "error");
        return;
      }
      groupChatAddMemberConfirm.disabled = true;
      fetch(
        GROUP_CHATS_API_URL +
          "/" +
          encodeURIComponent(activeGroupChat.id) +
          "/members",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username }),
        }
      )
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          }).catch(function () {
            return { ok: response.ok, data: {} };
          });
        })
        .then(function (result) {
          if (result.ok && result.data.group && result.data.group.members) {
            activeGroupChat.members = result.data.group.members.slice();
            setPageMessage("Member added to the group.", "success");
            if (groupChatAddMemberRow) {
              groupChatAddMemberRow.classList.add("is-hidden");
            }
            if (groupChatAddMemberInput) {
              groupChatAddMemberInput.value = "";
            }
            renderGroupChatMembers(activeGroupChat.members);
            refreshActiveGroupChatDetails();
            loadGroupChats();
          } else {
            var err =
              (result.data && result.data.error) || "Could not add member.";
            setPageMessage(err, "error");
          }
        })
        .catch(function (err) {
          console.error("POST group members failed:", err);
          setPageMessage(
            "Could not reach the server. Please try again later.",
            "error"
          );
        })
        .finally(function () {
          groupChatAddMemberConfirm.disabled = false;
        });
    });
  }

  function sendGroupChatMessage(text) {
    if (!activeGroupChat || text === "") return;
    if (groupChatSendBtn) groupChatSendBtn.disabled = true;

    fetch(
      GROUP_CHATS_API_URL +
        "/" +
        encodeURIComponent(activeGroupChat.id) +
        "/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderUsername: myUsername,
          text: text,
        }),
      }
    )
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        }).catch(function () {
          return { ok: response.ok, data: {} };
        });
      })
      .then(function (result) {
        if (result.ok) {
          if (groupChatInput) groupChatInput.value = "";
          loadGroupChatMessages();
        } else {
          var errMsg =
            (result.data && result.data.error) || "Could not send message.";
          alert(errMsg);
        }
      })
      .catch(function (err) {
        console.error("Failed to send group message:", err);
        alert("Could not reach the server. Please try again.");
      })
      .finally(function () {
        if (groupChatSendBtn) groupChatSendBtn.disabled = false;
        if (groupChatInput) groupChatInput.focus();
      });
  }

  if (groupChatForm) {
    groupChatForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = groupChatInput ? groupChatInput.value.trim() : "";
      if (text !== "") sendGroupChatMessage(text);
    });
  }

  // -------------------------------------------------------------------------
  // 4) MESSAGING / CHAT
  // -------------------------------------------------------------------------
  var MESSAGES_API_URL = "http://localhost:3000/api/messages";
  var CONVERSATIONS_API_URL = "http://localhost:3000/api/conversations";
  var MESSAGES_READ_API_URL = "http://localhost:3000/api/messages/read";

  var conversationsListEl = document.getElementById("conversations-list");
  var chatOverlay = document.getElementById("chat-overlay");
  var chatPartnerNameEl = document.getElementById("chat-partner-name");
  var chatMessagesEl = document.getElementById("chat-messages");
  var chatForm = document.getElementById("chat-form");
  var chatInput = document.getElementById("chat-input");
  var chatCloseBtn = document.getElementById("chat-close-btn");

  var activeChatPartner = null;

  // ----- Conversations list ------------------------------------------------

  function formatConvoTime(isoString) {
    if (!isoString) return "";
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short", day: "numeric"
    }) + " " + d.toLocaleTimeString(undefined, {
      hour: "numeric", minute: "2-digit"
    });
  }

  function buildConversationCard(convo) {
    var card = document.createElement("article");
    card.className = "user-result-card friend-card conversation-card";
    card.setAttribute(
      "data-partner",
      String(convo.partner || "").toLowerCase()
    );

    var avatar = document.createElement("div");
    avatar.className = "user-result-avatar";
    var initial = (convo.partner || "U").charAt(0).toUpperCase();
    avatar.textContent = initial;
    card.appendChild(avatar);

    var info = document.createElement("div");
    info.className = "user-result-info";
    var name = document.createElement("p");
    name.className = "user-result-name";
    name.textContent = "@" + convo.partner;
    info.appendChild(name);

    var preview = document.createElement("p");
    preview.className = "convo-preview";
    var last = convo.lastMessage || {};
    var previewText = last.text || "";
    if (previewText.length > 60) previewText = previewText.substring(0, 57) + "...";
    if (last.senderUsername === myUsername.toLowerCase()) {
      previewText = "You: " + previewText;
    }
    preview.textContent = previewText;
    info.appendChild(preview);

    var time = document.createElement("p");
    time.className = "convo-time";
    time.textContent = formatConvoTime(last.createdAt);
    info.appendChild(time);

    card.appendChild(info);

    if (last.senderUsername !== myUsername.toLowerCase() && last.read === false) {
      var badge = document.createElement("span");
      badge.className = "convo-unread-badge";
      badge.textContent = "New";
      card.appendChild(badge);
    }

    card.style.cursor = "pointer";
    card.addEventListener("click", function () {
      openChat(convo.partner);
    });

    return card;
  }

  function upsertConversationFromIncoming(message) {
    if (!conversationsListEl || !message) return;
    var myLower = String(myUsername).toLowerCase();
    var sender = String(message.senderUsername || "").toLowerCase();
    var receiver = String(message.receiverUsername || "").toLowerCase();
    var partner = sender === myLower ? receiver : sender;
    if (!partner) return;

    var selector =
      '.conversation-card[data-partner="' + partner.replace(/"/g, '\\"') + '"]';
    var existing = conversationsListEl.querySelector(selector);

    if (!existing) {
      var convo = {
        partner: partner,
        lastMessage: {
          text: message.text || "",
          createdAt: message.createdAt || new Date().toISOString(),
          senderUsername: sender,
          read: sender === myLower ? true : false,
        },
      };
      var empty = conversationsListEl.querySelector(".friend-empty");
      if (empty) empty.remove();
      conversationsListEl.prepend(buildConversationCard(convo));
      return;
    }

    var preview = existing.querySelector(".convo-preview");
    if (preview) {
      var previewText = String(message.text || "");
      if (previewText.length > 60) previewText = previewText.substring(0, 57) + "...";
      if (sender === myLower) previewText = "You: " + previewText;
      preview.textContent = previewText;
    }

    var time = existing.querySelector(".convo-time");
    if (time) {
      time.textContent = formatConvoTime(message.createdAt);
    }

    var badge = existing.querySelector(".convo-unread-badge");
    if (sender !== myLower) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "convo-unread-badge";
        badge.textContent = "New";
        existing.appendChild(badge);
      }
    } else if (badge) {
      badge.remove();
    }

    conversationsListEl.prepend(existing);
  }

  function loadConversations() {
    if (!conversationsListEl) return;
    renderLoadingInto(conversationsListEl);

    var url = CONVERSATIONS_API_URL + "/" + encodeURIComponent(myUsername);
    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("Status " + response.status);
        return response.json();
      })
      .then(function (convos) {
        if (!Array.isArray(convos) || convos.length === 0) {
          renderEmptyInto(
            conversationsListEl,
            "No conversations yet. Message a friend to get started!"
          );
          return;
        }
        conversationsListEl.innerHTML = "";
        convos.forEach(function (c) {
          conversationsListEl.appendChild(buildConversationCard(c));
        });
      })
      .catch(function (err) {
        console.error("Failed to load conversations:", err);
        renderEmptyInto(
          conversationsListEl,
          "Could not load conversations. Make sure the backend is running."
        );
      });
  }

  // ----- Chat window -------------------------------------------------------

  function formatMessageTime(isoString) {
    if (!isoString) return "";
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(undefined, {
      hour: "numeric", minute: "2-digit"
    });
  }

  function renderChatMessages(messages) {
    if (!chatMessagesEl) return;
    chatMessagesEl.innerHTML = "";

    if (!Array.isArray(messages) || messages.length === 0) {
      var empty = document.createElement("p");
      empty.className = "chat-empty";
      empty.textContent = "No messages yet. Say hello!";
      chatMessagesEl.appendChild(empty);
      return;
    }

    messages.forEach(function (msg) {
      appendDirectMessageBubble(msg);
    });

    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function appendDirectMessageBubble(msg) {
    if (!chatMessagesEl || !msg) return;
    var emptyState = chatMessagesEl.querySelector(".chat-empty");
    if (emptyState) emptyState.remove();

    var myLower = String(myUsername).toLowerCase();
    var senderLower = String(msg.senderUsername || "").toLowerCase();
    var isMine = senderLower === myLower;
    var bubble = document.createElement("div");
    bubble.className =
      "chat-bubble" + (isMine ? " chat-bubble--sent" : " chat-bubble--received");

    var senderEl = document.createElement("span");
    senderEl.className = "chat-bubble-sender";
    senderEl.textContent = isMine ? "You" : "@" + (msg.senderUsername || "?");
    bubble.appendChild(senderEl);

    var textEl = document.createElement("p");
    textEl.className = "chat-bubble-text";
    textEl.textContent = msg.text || "";
    bubble.appendChild(textEl);

    var timeEl = document.createElement("span");
    timeEl.className = "chat-bubble-time";
    timeEl.textContent = formatMessageTime(msg.createdAt);
    bubble.appendChild(timeEl);

    chatMessagesEl.appendChild(bubble);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function loadChatThread(partnerUsername) {
    if (!chatMessagesEl) return;
    chatMessagesEl.innerHTML = "<p class='chat-loading'>Loading...</p>";

    var url =
      MESSAGES_API_URL + "/" +
      encodeURIComponent(myUsername) + "/" +
      encodeURIComponent(partnerUsername);

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("Status " + response.status);
        return response.json();
      })
      .then(function (messages) {
        renderChatMessages(messages);
      })
      .catch(function (err) {
        console.error("Failed to load chat:", err);
        chatMessagesEl.innerHTML =
          "<p class='chat-empty'>Could not load messages.</p>";
      });
  }

  function markMessagesAsRead(partnerUsername) {
    fetch(MESSAGES_READ_API_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderUsername: partnerUsername,
        receiverUsername: myUsername,
      }),
    }).catch(function (err) {
      console.error("Failed to mark messages as read:", err);
    });
  }

  function openChat(partnerUsername) {
    if (!chatOverlay || !chatPartnerNameEl) return;
    closeGroupChat();
    activeChatPartner = partnerUsername;
    chatPartnerNameEl.textContent = "Chat with @" + partnerUsername;
    chatOverlay.classList.remove("is-hidden");

    loadChatThread(partnerUsername);
    markMessagesAsRead(partnerUsername);

    if (chatInput) {
      chatInput.value = "";
      chatInput.focus();
    }
  }

  function closeChat() {
    if (!chatOverlay) return;
    chatOverlay.classList.add("is-hidden");
    activeChatPartner = null;
    loadConversations();
  }

  function sendChatMessage(text) {
    if (!activeChatPartner || text === "") return;
    var sendBtn = document.getElementById("chat-send-btn");
    if (sendBtn) sendBtn.disabled = true;

    fetch(MESSAGES_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderUsername: myUsername,
        receiverUsername: activeChatPartner,
        text: text,
      }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        }).catch(function () {
          return { ok: response.ok, data: {} };
        });
      })
      .then(function (result) {
        if (result.ok) {
          if (chatInput) chatInput.value = "";
          loadChatThread(activeChatPartner);
        } else {
          var errMsg = (result.data && result.data.error) || "Could not send message.";
          alert(errMsg);
        }
      })
      .catch(function (err) {
        console.error("Failed to send message:", err);
        alert("Could not reach the server. Please try again.");
      })
      .finally(function () {
        if (sendBtn) sendBtn.disabled = false;
        if (chatInput) chatInput.focus();
      });
  }

  if (chatCloseBtn) {
    chatCloseBtn.addEventListener("click", closeChat);
  }

  if (chatOverlay) {
    chatOverlay.addEventListener("click", function (e) {
      if (e.target === chatOverlay) closeChat();
    });
  }

  if (chatForm) {
    chatForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = chatInput ? chatInput.value.trim() : "";
      if (text !== "") sendChatMessage(text);
    });
  }

  function handleIncomingDirectMessage(message) {
    if (!message) return;
    console.log("[socket] received newMessage", message);

    var myLower = String(myUsername).toLowerCase();
    var sender = String(message.senderUsername || "").toLowerCase();
    var receiver = String(message.receiverUsername || "").toLowerCase();
    var activePartner = String(activeChatPartner || "").toLowerCase();
    var isForOpenChat =
      activePartner &&
      ((sender === activePartner && receiver === myLower) ||
        (sender === myLower && receiver === activePartner));

    if (isForOpenChat) {
      appendDirectMessageBubble(message);
      if (sender !== myLower) {
        markMessagesAsRead(sender);
      }
    }

    upsertConversationFromIncoming(message);
  }

  function handleIncomingGroupMessage(message) {
    if (!message || !activeGroupChat) return;
    var incomingGroupId = String(message.groupChatId || "");
    if (incomingGroupId === String(activeGroupChat.id)) {
      appendGroupChatMessageBubble(message);
    }
  }

  if (socket) {
    socket.on("newMessage", handleIncomingDirectMessage);
    socket.on("newGroupMessage", handleIncomingGroupMessage);
  }

  // -------------------------------------------------------------------------
  // Initial load
  // -------------------------------------------------------------------------
  loadFriends();
  loadIncomingRequests();
  renderOutgoing();
  loadGroupChats();
  loadConversations();
});


// ===========================================================================
// 8d) PROFILE PAGE: My RSVP'd events
// ---------------------------------------------------------------------------
// Replaces the old hard-coded "Saved events" + "Attended events" placeholder
// rows on profile.html with real data from the backend.
//
// Data flow:
//   1. Read the logged-in user from localStorage (via getCurrentUser()).
//   2. Fetch GET http://localhost:3000/api/rsvps/:username.
//   3. Render one row per event (title + date · time · location), or
//      show "No RSVP'd events yet." for the empty state.
//
// Because we always fetch from the backend on page load, canceling an
// RSVP from the Events page (which calls DELETE /api/rsvp) will remove
// the event from this list on the next refresh — no client-side cache
// to keep in sync.
// ===========================================================================
document.addEventListener("DOMContentLoaded", function () {
  const listEl = document.getElementById("rsvped-events-list");
  if (!listEl) return; // Only the profile page has this container.

  const RSVPS_API_URL = "http://localhost:3000/api/rsvps";

  // Replace the contents of the list with a single status paragraph
  // (used for "Loading…", "No RSVP'd events yet.", login-required, and
  // error states). Styling lives in style.css → .profile-rsvp-empty.
  function setStatusMessage(text) {
    listEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "profile-rsvp-empty";
    p.textContent = text;
    listEl.appendChild(p);
  }

  // Friendly date string. Falls back to the raw input if it can't
  // parse so we never display "Invalid Date".
  function formatRsvpDate(dateString) {
    if (!dateString) return "";
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) return dateString;
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  // Friendly 12-hour time string (e.g. "7:30 PM"). Accepts both
  // "HH:MM" strings and full ISO timestamps. Falls back to the raw
  // input on failure.
  function formatRsvpTime(timeString) {
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
    return timeString;
  }

  // Build one row that visually matches the profile page's existing
  // .event-placeholder-item style (so this section blends in with the
  // rest of the profile cards). Uses textContent everywhere so any
  // user-supplied text is safe from XSS.
  function buildEventRow(event) {
    const item = document.createElement("div");
    item.className = "event-placeholder-item";

    const icon = document.createElement("span");
    icon.className = "event-placeholder-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "\u2605"; // ★

    const text = document.createElement("div");

    const title = document.createElement("p");
    title.className = "event-placeholder-title";
    title.textContent = event.title || "Untitled event";

    // Build "Date · Time · Location" from whichever pieces exist.
    const meta = document.createElement("p");
    meta.className = "event-placeholder-meta";
    const parts = [];
    const dateText = formatRsvpDate(event.date);
    const timeText = formatRsvpTime(event.time);
    if (dateText) parts.push(dateText);
    if (timeText) parts.push(timeText);
    if (event.location) parts.push(event.location);
    meta.textContent = parts.join(" \u00b7 ") || "Details to be announced";

    text.appendChild(title);
    text.appendChild(meta);
    item.appendChild(icon);
    item.appendChild(text);
    return item;
  }

  function renderEvents(events) {
    listEl.innerHTML = "";
    if (!events || events.length === 0) {
      setStatusMessage("No RSVP\u2019d events yet.");
      return;
    }
    events.forEach(function (event) {
      listEl.appendChild(buildEventRow(event));
    });
  }

  // ---- Initial fetch ------------------------------------------------------

  setStatusMessage("Loading your RSVP\u2019d events\u2026");

  const user = getCurrentUser();
  if (!user || !user.username) {
    // Not logged in — keep the section visible but show a friendly hint
    // instead of trying to call the API with an empty username.
    setStatusMessage("Log in to see your RSVP\u2019d events.");
    return;
  }

  const url = RSVPS_API_URL + "/" + encodeURIComponent(user.username);

  fetch(url)
    .then(function (response) {
      // Treat 404 (user not found server-side) as an empty list rather
      // than as an error, so the UI stays calm if a user record is
      // missing for any reason.
      if (response.status === 404) return [];
      if (!response.ok) {
        throw new Error("Server responded " + response.status);
      }
      return response.json();
    })
    .then(function (events) {
      renderEvents(Array.isArray(events) ? events : []);
    })
    .catch(function (err) {
      console.error("Could not load RSVP'd events:", err);
      setStatusMessage(
        "Could not load your RSVP\u2019d events. Please try again later."
      );
    });
});


// ===========================================================================
// 9) SETTINGS PAGE
// ---------------------------------------------------------------------------
// - Each section header is a <button> that expands/collapses its body
//   (accordion-style). Sections start collapsed for a clean look.
// - Theme + notification + privacy + accessibility toggles persist to
//   localStorage (instant client-side preferences).
// - Password change and account deletion go through the real backend
//   (MongoDB + bcrypt) — see /api/settings/change-password and
//   /api/settings/delete-account in server.js.
// ===========================================================================

// ——— Accordion: collapsible settings sections ———
// Every .settings-card-header on the settings page is now a <button>.
// Clicking it toggles the .is-collapsed class on its parent .settings-card,
// which CSS uses to show/hide the body and rotate the chevron.
(function setupSettingsAccordion() {
  const headers = document.querySelectorAll(
    ".settings-page .settings-card-header"
  );
  headers.forEach(function (header) {
    header.addEventListener("click", function () {
      const card = header.closest(".settings-card");
      if (!card) return;
      card.classList.toggle("is-collapsed");
      // Expanded when the card body is visible (no .is-collapsed on the article).
      const expanded = !card.classList.contains("is-collapsed");
      header.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  });
})();

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


// ——— Change password (calls the backend /api/settings/change-password) ———
// Validates the form, then sends the current + new password to the server,
// where bcrypt verifies the current one against the stored hash and
// hashes the new one before saving. We never trust localStorage for this.
const passwordForm = document.getElementById("password-form");
const currentPasswordInput = document.getElementById("current-password");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const passwordMessage = document.getElementById("password-message");

const CHANGE_PASSWORD_API_URL =
  "http://localhost:3000/api/settings/change-password";
const DELETE_ACCOUNT_API_URL =
  "http://localhost:3000/api/settings/delete-account";

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

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Quick client-side checks — the backend re-checks all of these,
    // but doing them here gives instant feedback without a round-trip.
    if (
      currentPassword === "" ||
      newPassword === "" ||
      confirmPassword === ""
    ) {
      showSettingsMessage(
        passwordMessage,
        "Please fill all password fields.",
        "error"
      );
      return;
    }
    if (newPassword.length < 8) {
      showSettingsMessage(
        passwordMessage,
        "New password must be at least 8 characters.",
        "error"
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      showSettingsMessage(
        passwordMessage,
        "New password and confirmation do not match.",
        "error"
      );
      return;
    }

    // The backend identifies the user by their email or username. We use
    // whichever one we have on the logged-in user object.
    const current = getCurrentUser();
    if (!current || (!current.email && !current.username)) {
      showSettingsMessage(
        passwordMessage,
        "You must be logged in to change your password.",
        "error"
      );
      return;
    }

    showSettingsMessage(passwordMessage, "Updating password\u2026", null);

    fetch(CHANGE_PASSWORD_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: current.email || "",
        username: current.username || "",
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      }),
    })
      .then(function (response) {
        // Always read the JSON body so we can surface the server's error
        // message verbatim (e.g. "Current password is incorrect.").
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
            (result.data && result.data.error) ||
            "Could not update password.";
          showSettingsMessage(passwordMessage, message, "error");
          return;
        }

        showSettingsMessage(
          passwordMessage,
          "Password updated successfully.",
          "success"
        );
        passwordForm.reset();
      })
      .catch(function (err) {
        console.error("POST /api/settings/change-password failed:", err);
        showSettingsMessage(
          passwordMessage,
          "Could not reach the server. Please try again later.",
          "error"
        );
      });
  });
}


// ——— Admin Key (calls /api/settings/admin-key + /api/settings/exit-admin) ———
// The user types a secret key into a password-style input. We POST the typed
// key (NEVER hard-coded here!) to the backend, which compares it to
// process.env.ADMIN_KEY. If it matches, MongoDB stores role="admin" for the
// user, and we mirror that into localStorage so admin-only UI shows up.
//
// Exit Admin Mode does the inverse: it POSTs to /api/settings/exit-admin,
// which sets the role back to "user" in MongoDB and returns the updated
// user. We DO NOT log the user out — only the role changes.
const adminKeyForm = document.getElementById("admin-key-form");
const adminKeyInput = document.getElementById("admin-key-input");
const adminKeySubmitBtn = document.getElementById("admin-key-submit-btn");
const adminKeyMessage = document.getElementById("admin-key-message");
const adminStatusPanel = document.getElementById("admin-status-panel");
const exitAdminBtn = document.getElementById("exit-admin-btn");

const ADMIN_KEY_API_URL = "http://localhost:3000/api/settings/admin-key";
const EXIT_ADMIN_API_URL = "http://localhost:3000/api/settings/exit-admin";

// Show the right panel (active vs unlock form) based on the current role.
// Called once on page load and again after every successful action so the
// UI never goes stale.
function refreshAdminSettingsUi() {
  if (!adminStatusPanel || !adminKeyForm) return;
  const isAdmin = isCurrentUserAdmin();
  adminStatusPanel.classList.toggle("is-hidden", !isAdmin);
  adminKeyForm.classList.toggle("is-hidden", isAdmin);
}

// Run once on page load so the section opens in the right state.
refreshAdminSettingsUi();

if (adminKeyForm && adminKeyInput && adminKeySubmitBtn && adminKeyMessage) {
  adminKeyForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const adminKey = adminKeyInput.value;
    if (!adminKey) {
      showSettingsMessage(
        adminKeyMessage,
        "Please type the admin key.",
        "error"
      );
      return;
    }

    const current = getCurrentUser();
    if (!current || (!current.email && !current.username)) {
      showSettingsMessage(
        adminKeyMessage,
        "You must be logged in to unlock admin mode.",
        "error"
      );
      return;
    }

    adminKeySubmitBtn.disabled = true;
    showSettingsMessage(adminKeyMessage, "Checking key\u2026", null);

    fetch(ADMIN_KEY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // The key the user typed — NEVER hard-coded here. Only the
        // backend knows the real value (loaded from backend/.env).
        adminKey: adminKey,
        email: current.email || "",
        username: current.username || "",
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
        adminKeySubmitBtn.disabled = false;

        if (!result.ok) {
          const message =
            (result.data && result.data.error) || "Invalid admin key.";
          showSettingsMessage(adminKeyMessage, message, "error");
          return;
        }

        // Server confirmed the key. Mirror the new role into the local
        // user object so admin-only UI shows up immediately, on every
        // page that reads getCurrentUser().
        const updated = (result.data && result.data.user) || {};
        const merged = Object.assign({}, current, {
          // Keep our local field naming convention (`fullName`).
          fullName: updated.name || current.fullName,
          username: updated.username || current.username,
          email: updated.email || current.email,
          id: updated.id || current.id,
          role: updated.role || "admin",
        });
        setCurrentUser(merged);

        adminKeyInput.value = "";
        showSettingsMessage(
          adminKeyMessage,
          (result.data && result.data.message) || "Admin mode unlocked.",
          "success"
        );

        // Update the visible UI: hide the form, show the active panel,
        // and refresh the navbar in case anything depends on role.
        refreshAdminSettingsUi();
        refreshNavAuthVisibility();
      })
      .catch(function (err) {
        console.error("POST /api/settings/admin-key failed:", err);
        adminKeySubmitBtn.disabled = false;
        showSettingsMessage(
          adminKeyMessage,
          "Could not reach the server. Please try again later.",
          "error"
        );
      });
  });
}

if (exitAdminBtn && adminKeyMessage) {
  exitAdminBtn.addEventListener("click", function () {
    const current = getCurrentUser();
    if (!current || (!current.email && !current.username)) {
      showSettingsMessage(
        adminKeyMessage,
        "You must be logged in to change admin mode.",
        "error"
      );
      return;
    }

    exitAdminBtn.disabled = true;
    showSettingsMessage(adminKeyMessage, "Turning off admin mode\u2026", null);

    fetch(EXIT_ADMIN_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: current.email || "",
        username: current.username || "",
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
        exitAdminBtn.disabled = false;

        if (!result.ok) {
          const message =
            (result.data && result.data.error) ||
            "Could not exit admin mode.";
          showSettingsMessage(adminKeyMessage, message, "error");
          return;
        }

        // Mirror the new role locally. Importantly we do NOT log out —
        // the rest of the user's session stays intact.
        const updated = (result.data && result.data.user) || {};
        const merged = Object.assign({}, current, {
          fullName: updated.name || current.fullName,
          username: updated.username || current.username,
          email: updated.email || current.email,
          id: updated.id || current.id,
          role: updated.role || "user",
        });
        setCurrentUser(merged);

        showSettingsMessage(
          adminKeyMessage,
          (result.data && result.data.message) || "Admin mode turned off.",
          "success"
        );

        refreshAdminSettingsUi();
        refreshNavAuthVisibility();
      })
      .catch(function (err) {
        console.error("POST /api/settings/exit-admin failed:", err);
        exitAdminBtn.disabled = false;
        showSettingsMessage(
          adminKeyMessage,
          "Could not reach the server. Please try again later.",
          "error"
        );
      });
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


// ——— Danger zone: delete account (calls the backend) ———
// The user must type their password into the form first. We send the
// password to /api/settings/delete-account, which verifies it against the
// bcrypt hash before removing the user (and their friend requests,
// messages, RSVPs, friend links) from MongoDB. Only then do we clear
// localStorage and redirect.
const deleteAccountForm = document.getElementById("delete-account-form");
const deleteAccountBtn = document.getElementById("delete-account-btn");
const deleteConfirmPasswordInput = document.getElementById(
  "delete-confirm-password"
);
const deleteMessage = document.getElementById("delete-message");

if (deleteAccountForm && deleteAccountBtn && deleteMessage) {
  deleteAccountForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const password = deleteConfirmPasswordInput
      ? deleteConfirmPasswordInput.value
      : "";

    if (password === "") {
      showSettingsMessage(
        deleteMessage,
        "Please type your password to confirm.",
        "error"
      );
      return;
    }

    const current = getCurrentUser();
    if (!current || (!current.email && !current.username)) {
      showSettingsMessage(
        deleteMessage,
        "You must be logged in to delete your account.",
        "error"
      );
      return;
    }

    // Final native confirmation so a stray click can't wipe the account.
    const confirmed = confirm(
      "This will permanently delete your account from the database. Continue?"
    );
    if (!confirmed) return;

    deleteAccountBtn.disabled = true;
    showSettingsMessage(deleteMessage, "Deleting account\u2026", null);

    fetch(DELETE_ACCOUNT_API_URL, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: current.email || "",
        username: current.username || "",
        password: password,
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
        if (!result.ok) {
          const message =
            (result.data && result.data.error) ||
            "Could not delete account.";
          showSettingsMessage(deleteMessage, message, "error");
          deleteAccountBtn.disabled = false;
          return;
        }

        // Account is gone from the database. Now clean up the local
        // session + cached preferences and send the user away.
        const keysToRemove = PREFERENCE_KEYS.concat([
          LOGGED_IN_KEY,
          CURRENT_USER_KEY,
          PROFILE_KEY,
          USERS_KEY,
          "liveEventProfileReady",
          "username",
        ]);
        keysToRemove.forEach(function (key) {
          localStorage.removeItem(key);
        });

        applyTheme(getSavedTheme());
        applyA11ySettings();
        refreshNavLogoutVisibility();

        showSettingsMessage(
          deleteMessage,
          "Account deleted successfully. Redirecting\u2026",
          "success"
        );

        setTimeout(function () {
          window.location.href = "signup.html";
        }, 1000);
      })
      .catch(function (err) {
        console.error("DELETE /api/settings/delete-account failed:", err);
        showSettingsMessage(
          deleteMessage,
          "Could not reach the server. Please try again later.",
          "error"
        );
        deleteAccountBtn.disabled = false;
      });
  });
}


// ===========================================================================
// ADD EVENT PAGE: POST a new event to the backend (add-event.html)
// ===========================================================================
// Wires up the form on add-event.html so it:
//   1. Validates that the required fields are filled in.
//   2. Sends a POST to /api/events with the event details + the current
//      user's username (read from localStorage via getCurrentUser()).
//   3. Shows a success or error message in #add-event-message.
//   4. On success, redirects back to events.html so the new event shows up.
//
// This handler bails out early if the form isn't on the current page, so it
// safely coexists with every other page (events, profile, friends, etc.).
document.addEventListener("DOMContentLoaded", function () {
  const addEventForm = document.getElementById("add-event-form");
  if (!addEventForm) return;

  const titleInput = document.getElementById("event-title");
  const dateInput = document.getElementById("event-date");
  const timeInput = document.getElementById("event-time");
  const locationInput = document.getElementById("event-location");
  const categoryInput = document.getElementById("event-category");
  const descriptionInput = document.getElementById("event-description");
  const submitBtn = document.getElementById("add-event-submit-btn");
  const messageEl = document.getElementById("add-event-message");
  const imageInput = document.getElementById("event-image");
  const imagePreviewWrap = document.getElementById("event-image-preview-wrap");
  const imagePreviewImg = document.getElementById("event-image-preview");

  let pendingEventImageBase64 = "";

  const ADD_EVENT_API_URL = "http://localhost:3000/api/events";

  // Tiny helper that mirrors the signup/login pages: writes the message
  // text and applies the matching color class (green for success, red for
  // error) defined in style.css.
  function showMsg(text, type) {
    if (!messageEl) {
      alert(text);
      return;
    }
    messageEl.textContent = text;
    messageEl.classList.remove("is-success", "is-error");
    if (type) messageEl.classList.add("is-" + type);
  }

  if (imageInput && imagePreviewWrap && imagePreviewImg) {
    imageInput.addEventListener("change", function () {
      pendingEventImageBase64 = "";
      imagePreviewWrap.classList.add("is-hidden");
      imagePreviewImg.removeAttribute("src");

      const file = imageInput.files && imageInput.files[0];
      if (!file) return;

      if (!file.type || file.type.indexOf("image/") !== 0) {
        showMsg("Please choose an image file (PNG, JPEG, GIF, WebP, etc.).", "error");
        imageInput.value = "";
        return;
      }

      // Keep uploads beginner-friendly — huge photos can blow past MongoDB's
      // ~16MB per-document limit once Base64-encoded.
      const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
      if (file.size > MAX_IMAGE_BYTES) {
        showMsg("Please choose an image under 2 MB.", "error");
        imageInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = function () {
        const result = reader.result;
        if (typeof result !== "string") return;
        pendingEventImageBase64 = result;
        imagePreviewImg.src = result;
        imagePreviewWrap.classList.remove("is-hidden");
        showMsg("", null);
      };
      reader.onerror = function () {
        showMsg("Could not read that file. Try a different image.", "error");
        imageInput.value = "";
      };
      reader.readAsDataURL(file);
    });
  }

  addEventForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // Pull and trim every value once so the rest of the function can
    // treat them as plain strings.
    const title = (titleInput.value || "").trim();
    const date = (dateInput.value || "").trim();
    const time = (timeInput.value || "").trim();
    const location = (locationInput.value || "").trim();
    const category = (categoryInput.value || "").trim();
    const description = (descriptionInput.value || "").trim();

    // The five required fields, matching the backend's validation in
    // POST /api/events. Category is optional, so it isn't checked here.
    if (
      title === "" ||
      date === "" ||
      time === "" ||
      location === "" ||
      description === ""
    ) {
      showMsg(
        "Please fill in title, date, time, location, and description.",
        "error"
      );
      return;
    }

    // Pull the username out of the saved login info so the backend knows
    // who created the event. If nobody is logged in we still let the
    // POST through with an empty creatorUsername — the backend treats
    // that field as optional.
    const currentUser = getCurrentUser();
    const creatorUsername =
      (currentUser && (currentUser.username || "")) || "";

    if (submitBtn) submitBtn.disabled = true;
    showMsg("Creating event\u2026", "info");

    const chosenFile =
      imageInput && imageInput.files && imageInput.files[0];

    // If something is picked in <input type="file"> we read it AGAIN here —
    // not only in the change handler — so Submit never beats FileReader.onload
    // (classic cause of \"preview works but DB has no image\").
    const imageReadPromise = chosenFile
      ? readLocalImageFileAsDataURL(chosenFile)
      : Promise.resolve(pendingEventImageBase64 || "");

    imageReadPromise
      .then(function (imageBase64String) {
        const trimmedImg =
          typeof imageBase64String === "string"
            ? imageBase64String.trim()
            : "";

        return fetch(ADD_EVENT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title,
            date: date,
            time: time,
            location: location,
            category: category,
            description: description,
            creatorUsername: creatorUsername,
            eventImage: trimmedImg,
            eventImageType: trimmedImg ? "uploaded" : "",
          }),
        });
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
        if (!result.ok) {
          const message =
            (result.data && result.data.error) || "Could not create event.";
          showMsg(message, "error");
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        showMsg("Event created! Redirecting\u2026", "success");
        setTimeout(function () {
          window.location.href = "events.html";
        }, 600);
      })
      .catch(function (error) {
        console.error("POST /api/events failed:", error);
        if (submitBtn) submitBtn.disabled = false;
        if (
          chosenFile &&
          error &&
          String(error.message || "").indexOf("Could not read") !== -1
        ) {
          showMsg(
            "Could not read the image file. Try a different photo.",
            "error"
          );
          return;
        }
        showMsg(
          "Could not reach the server. Please try again later.",
          "error"
        );
      });
  });
});


// ===========================================================================
// 11) PASSWORD UX HELPERS  (login + signup pages)
// ---------------------------------------------------------------------------
// Three small features wired up here:
//   a) Eye toggle buttons that show/hide any password field. The button
//      element has `data-password-toggle="<input id>"` in the HTML.
//   b) A live strength meter under the signup password field.
//   c) A "passwords match / do not match" message under the confirm field.
//
// All of this is purely UI — it does NOT touch the existing /api/login or
// /api/signup fetch logic in sections 6 and 7.
// ===========================================================================
document.addEventListener("DOMContentLoaded", function () {
  // ---- (a) Eye show/hide buttons --------------------------------------
  // Find every button on the page that opted in via data-password-toggle.
  // Works on login.html and signup.html without any per-page setup.
  const toggleButtons = document.querySelectorAll("[data-password-toggle]");
  toggleButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      // The button stores the id of the input it controls.
      const targetId = btn.getAttribute("data-password-toggle");
      const input = document.getElementById(targetId);
      if (!input) return;

      // Flip the input type between "password" (hidden) and "text" (visible).
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";

      // Swap the icon + accessible label so screen readers stay in sync.
      const iconEl = btn.querySelector(".password-toggle-icon");
      if (iconEl) {
        iconEl.textContent = isHidden ? "🙈" : "👁️";
      }
      btn.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password"
      );
      btn.setAttribute("aria-pressed", isHidden ? "true" : "false");
    });
  });

  // ---- (b) Signup password strength meter -----------------------------
  const signupPassword = document.getElementById("signup-password");
  const strengthEl = document.getElementById("password-strength");
  const strengthLabelEl = strengthEl
    ? strengthEl.querySelector(".password-strength-label")
    : null;

  // Returns one of "", "weak", "medium", "strong" based on five rules:
  // length>=8, uppercase, lowercase, number, special character.
  function calcStrength(pw) {
    if (!pw) return "";
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 2) return "weak";
    if (score <= 4) return "medium";
    return "strong";
  }

  if (signupPassword && strengthEl && strengthLabelEl) {
    signupPassword.addEventListener("input", function () {
      const level = calcStrength(signupPassword.value);

      // Reset modifier classes, then add the current one (if any).
      strengthEl.classList.remove(
        "is-active",
        "is-weak",
        "is-medium",
        "is-strong"
      );

      if (level === "") {
        // Empty input — hide the meter entirely.
        strengthLabelEl.textContent = "";
      } else {
        strengthEl.classList.add("is-active", "is-" + level);
        if (level === "weak") strengthLabelEl.textContent = "Weak password";
        if (level === "medium") strengthLabelEl.textContent = "Medium strength";
        if (level === "strong") strengthLabelEl.textContent = "Strong password";
      }

      // Re-check the match message too, in case the user edited the
      // password after typing the confirm field.
      updateMatchMessage();
    });
  }

  // ---- (c) Confirm-password match message -----------------------------
  const confirmPassword = document.getElementById("signup-confirm");
  const matchEl = document.getElementById("password-match");

  function updateMatchMessage() {
    if (!signupPassword || !confirmPassword || !matchEl) return;

    const pw = signupPassword.value;
    const confirm = confirmPassword.value;

    matchEl.classList.remove("is-match", "is-mismatch");

    // Stay quiet until the user has actually started typing in confirm.
    if (confirm === "") {
      matchEl.textContent = "";
      return;
    }

    if (pw === confirm) {
      matchEl.classList.add("is-match");
      matchEl.textContent = "Passwords match.";
    } else {
      matchEl.classList.add("is-mismatch");
      matchEl.textContent = "Passwords do not match.";
    }
  }

  if (confirmPassword) {
    confirmPassword.addEventListener("input", updateMatchMessage);
  }
});

// ===========================================================================
// Page transitions (multi-page app)
// ---------------------------------------------------------------------------
// After each full page load we fade/slide <main> in (CSS .page-enter).
// When the browser supports the View Transitions API, clicks on normal
// same-site links to other .html pages use a lightweight crossfade — no
// SPA framework required. Everything here is skipped when the user turns on
// "Reduce animations" or when the OS requests reduced motion.
// ===========================================================================
(function setupPageMotion() {
  function prefersReducedMotion() {
    return (
      document.body.classList.contains("reduce-animations") ||
      document.body.classList.contains("a11y-reduce-motion") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  var mainEl = document.querySelector("main");
  if (mainEl && !prefersReducedMotion()) {
    mainEl.classList.add("page-enter");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        mainEl.classList.add("page-enter--active");
      });
    });
  } else if (mainEl) {
    mainEl.classList.add("page-enter-done");
  }

  if (typeof document.startViewTransition !== "function") return;

  document.addEventListener("click", function (e) {
    if (prefersReducedMotion()) return;

    var link = e.target.closest("a[href]");
    if (!link || link.target === "_blank") return;

    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }

    var hrefAttr = link.getAttribute("href");
    if (
      !hrefAttr ||
      hrefAttr.startsWith("#") ||
      hrefAttr.startsWith("javascript:") ||
      hrefAttr.startsWith("mailto:") ||
      hrefAttr.startsWith("tel:")
    ) {
      return;
    }

    var url;
    try {
      url = new URL(hrefAttr, window.location.href);
    } catch (err) {
      return;
    }

    if (url.origin !== window.location.origin) return;

    var path = url.pathname || "";
    var looksLikeSitePage =
      /\.html($|[?#])/i.test(path) ||
      path === "/" ||
      path.endsWith("/");

    if (!looksLikeSitePage) return;

    var here = window.location.href.split("#")[0];
    var dest = url.href.split("#")[0];
    if (dest === here) return;

    e.preventDefault();
    document.startViewTransition(function () {
      window.location.href = url.href;
    });
  });
})();
