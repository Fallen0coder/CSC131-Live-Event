const browseButton = document.getElementById("browse-btn");

if (browseButton) {
  browseButton.addEventListener("click", function () {
    window.location.href = "events.html";
  });
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
  });
}
