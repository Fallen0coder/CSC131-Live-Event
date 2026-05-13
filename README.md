# 🎉 Live Event Web App

## 🌐 Live Deployment

[(https://liveevent2026.netlify.app/index.html)]


---

## 📌 Description

The Live Event Web App is a full-stack web application designed to help college students discover and connect through local events. Users can create accounts, browse events happening around campus (such as Sac State), and RSVP to events they are interested in.

---

## 🚀 Features

* 🔐 User Signup and Login
* 👤 User Profile Setup
* 📅 Browse Local Events
* 📍 View Event Details (date, time, location, description)
* ✅ RSVP to Events
* 🎨 Clean and modern responsive UI
* 🤝 Friend Request System (send, accept, deny)
* 🔍 User Search by Username
* 📩 Add Friends via Profile Search
* 🎟️ Persistent RSVP System (saved to database)
* ❌ Cancel RSVP functionality

---

## 🛠️ Tech Stack

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* Node.js
* Express.js

### Database

* MongoDB Atlas (used for storing users, profiles, friends, and RSVPs)

### Cloud Platform

* Render (used for hosting the Node.js backend API and deploying the Live Event web application)
* Vercel (used for deploying and hosting the frontend website)

---

## 📂 Project Structure

```
CSC131-Live-Event/
│
├── backend/
│   ├── models/
│   │   ├── FriendRequest.js
│   │   ├── GroupChat.js
│   │   ├── GroupChatMessage.js
│   │   ├── Message.js
│   │   ├── RSVP.js
│   │   └── User.js
│   │
│   ├── node_modules/
│   ├── .env
│   ├── .gitignore
│   ├── package-lock.json
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── images/
│   │
│   ├── about.html
│   ├── add-event.html
│   ├── early-init.js
│   ├── events.html
│   ├── friends.html
│   ├── index.html
│   ├── login.html
│   ├── profile.html
│   ├── public-profile.html
│   ├── script.js
│   ├── settings.html
│   ├── signup.html
│   └── style.css
│
├── node_modules/
├── .gitignore
├── CSC131-Live-Event.code-workspace
├── package-lock.json
├── package.json
├── README.md
└── render.yaml
```

---

## ⚙️ How to Run Locally

### 1. Clone the repository

```
git clone https://github.com/your-username/CSC131-Live-Event.git
cd CSC131-Live-Event
```

---

### 2. Start the Backend

```
cd backend
npm install
node server.js
```

Backend will run on:

```
http://localhost:3000
```

---

### 3. Open the Frontend

* Navigate to the `frontend` folder
* Open `index.html` in your browser

---

## 🔄 Current Status

* ✅ Frontend completed
* ✅ Backend API created
* ✅ Frontend connected to backend
* ✅ Database integration (MongoDB) in progress
* ✅ Deployment pending

---

## 👥 Team

* Samay Advani 
* Bashar Levingston
* Ruben Martinez

---

## 📖 Future Improvements

* 🌐 Deploy backend and frontend
* 🗄️ Integrate MongoDB for persistent data
* 🔐 Secure authentication (password hashing, sessions)
* 📍 Real-time local event integration
* 📱 Mobile responsiveness improvements

---

## 💡 Notes

This project is part of a software engineering course and demonstrates full-stack development concepts including frontend design, backend APIs, and planned database integration.
