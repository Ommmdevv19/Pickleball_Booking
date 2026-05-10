# PlayArena 🎾🏏🏸

**PlayArena** is a premium, mobile-first court booking and administration platform designed for high-performance sports hubs. It streamlines the entire process from customer booking to administrative management with a sleek, glassmorphic UI.

---

## 🚀 Key Features

### 📱 For Players
*   **Instant Booking Portal:** A seamless, multi-step booking flow for Pickleball, Box Cricket, and Padel.
*   **Verification System:** Secure booking with OTP verification (Default Testing OTP: **1234**).
*   **Glassmorphic Design:** A premium, dark-mode interface that looks stunning on any device.
*   **Real-Time Scheduling:** Check court availability and book slots instantly.

### 🛡️ For Administrators (Advanced Security)
*   **Unified Admin Panel:** Access both login and management at a single URL: `/admin-panel/`.
*   **Two-Factor Authentication (2FA):** Secured by Password + OTP verification for every session.
*   **High-Density Dashboard:** Monitor revenue, booking counts, and repeat customer rates at a glance.
*   **2x2 Court Matrix:** Track multiple courts simultaneously with a compact, real-time grid.
*   **Detailed View Modals:** Access full booking and customer profiles via quick-view "Eye" icons.
*   **Revenue Analytics:** Visualize performance trends with interactive charts and automated growth delta (↑/↓) calculations.

---

## 🛠️ Technical Stack
*   **Backend:** Django (Python)
*   **Authentication:** Django Auth + Custom 2FA Logic
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
│   │   ├── admin_login.html # Secure 2FA Login Page
│   │   └── admin_dashboard.html # High-density Admin console
│   └── views.py            # Unified Portal & API Routing
├── court_booking/          # Project Configuration
├── manage.py               # Django Entry Point
└── requirements.txt        # Production dependencies
```

---

## 🔧 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [repository-url]
    ```

2.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Setup Admin Account:**
    ```bash
    python manage.py createsuperuser
    ```

4.  **Run the server:**
    ```bash
    python manage.py runserver
    ```

5.  **Access the platform:**
    *   **User Portal:** `http://127.0.0.1:8000/`
    *   **Admin Panel:** `http://127.0.0.1:8000/admin-panel/`

---

## 🔑 Default Credentials (Testing)
*   **Admin Username:** `admin`
*   **Admin Password:** `admin123`
*   **Global Testing OTP:** `1234` (for both Users and Admin)

---

## ✨ Design Aesthetics
PlayArena follows a **Premium Dark Mode** philosophy:
*   **Glassmorphism:** Using `backdrop-filter` for deep, layered UI components.
*   **Vibrant Accents:** High-contrast lime and neon colors for actionable elements.
*   **Micro-Animations:** Smooth transitions and pulse indicators for real-time court status.

---
Created with ❤️ for **PlayArena Ahmedabad**.
