# PlayArena 🎾🏏🏸

**PlayArena** is a premium, mobile-first court booking and administration platform designed for high-performance sports hubs. It streamlines the entire process from customer booking to administrative management with a sleek, glassmorphic UI.

---

## 🚀 Key Features

### 📱 For Players
*   **Instant Booking Portal:** A seamless, multi-step booking flow for Pickleball, Box Cricket, and Padel.
*   **Glassmorphic Design:** A premium, dark-mode interface that looks stunning on any device.
*   **Real-Time Scheduling:** Check court availability and book slots instantly without manual coordination.
*   **Mobile Optimized:** Designed specifically for a "native app" feel on mobile browsers.

### 📊 For Administrators
*   **High-Density Dashboard:** Monitor revenue, booking counts, and repeat customer rates at a glance.
*   **2x2 Court Matrix:** Track multiple courts simultaneously with a compact, real-time grid.
*   **Small Widget System:** Manage long lists of bookings and customers with ultra-compact widgets, optimized for mobile efficiency.
*   **Detailed View Modals:** Access full booking and customer profiles via quick-view "Eye" icons, keeping the main UI clean.
*   **Revenue Analytics:** Visualize performance trends with interactive charts and automated growth delta (↑/↓) calculations.

---

## 🛠️ Technical Stack
*   **Backend:** Django (Python)
*   **Database:** MongoDB (via custom robust aggregation utilities) & SQLite (local auth/metadata)
*   **Frontend:** Vanilla JS, CSS3 (Custom Glassmorphism), HTML5
*   **Design Tokens:** Outfit & Inter Typography, Vibrant Accent Palettes

---

## 📂 Project Structure
```text
court_booking/
├── bookings/               # Main Application Logic
│   ├── mongodb_utils.py    # Robust data aggregation & MongoDB integration
│   ├── templates/          # Responsive HTML5 templates
│   │   ├── index.html      # Player-facing booking portal
│   │   └── admin_dashboard.html # High-density Admin console
│   └── views.py            # API & Page Routing
├── court_booking/          # Project Configuration
├── db.sqlite3              # Local Database (Auth/Cache)
└── manage.py               # Django Entry Point
```

---

## 🔧 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [repository-url]
    ```

2.  **Install dependencies:**
    ```bash
    pip install django pymongo
    ```

3.  **Run the server:**
    ```bash
    python manage.py runserver
    ```

4.  **Access the platform:**
    *   **User Portal:** `http://127.0.0.1:8000/`
    *   **Admin Dashboard:** `http://127.0.0.1:8000/admin-panel/`

---

## ✨ Design Aesthetics
PlayArena follows a **Premium Dark Mode** philosophy:
*   **Glassmorphism:** Using `backdrop-filter` for deep, layered UI components.
*   **Vibrant Accents:** High-contrast lime and neon colors for actionable elements.
*   **Micro-Animations:** Smooth transitions and pulse indicators for real-time court status.

---
Created with ❤️ for **PlayArena Ahmedabad**.
