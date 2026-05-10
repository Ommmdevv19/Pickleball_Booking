// --- Global State ---
let currentUser = JSON.parse(localStorage.getItem('playarena_user')) || null;
let cart = JSON.parse(localStorage.getItem('cafe_cart')) || [];
let pendingBooking = {};

// Pricing per hour (INR) for each facility
const FACILITY_RATES = typeof INITIAL_PRICES !== 'undefined' ? INITIAL_PRICES : {
    'Pickleball': 600,
    'Box Cricket': 1200,
    'Padel': 1000,
};

document.addEventListener('DOMContentLoaded', () => {

    function isUserLoggedIn() {
        return currentUser !== null;
    }

    function updateAuthUI() {
        const navAuth = document.getElementById('navAuth');
        if (!navAuth) return; // Guard for pages without navAuth

        if (currentUser) {
            const displayName = currentUser.name || "User";
            navAuth.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="user-avatar-btn" onclick="showMyBookings()" title="My Bookings">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div class="user-profile" onclick="toggleProfileDropdown(event)">
                        <div class="user-avatar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                        <div id="profileDropdown" class="profile-dropdown">
                            <div class="dropdown-header">
                                <div class="dropdown-name" style="font-weight: 700; font-size: 1.1rem; margin-bottom: 4px; color: var(--text-primary);">${displayName}</div>
                                <div class="dropdown-phone" style="font-size: 0.9rem; color: var(--text-secondary);">${currentUser.phone}</div>
                                <div class="dropdown-label" style="margin-top: 6px;">Member Since Today</div>
                            </div>
    
                            <div class="dropdown-item logout" onclick="logout()" style="display: flex; align-items: center; gap: 8px;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                Logout
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            navAuth.innerHTML = `<button class="btn-primary-outline" style="padding:0.4rem 1rem; font-size:0.85rem;" onclick="openLoginModal()">Login</button>`;
        }
    }

    window.toggleProfileDropdown = (e) => {
        e.stopPropagation();
        document.getElementById('profileDropdown').classList.toggle('active');
    };

    document.addEventListener('click', () => {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) dropdown.classList.remove('active');
    });

    window.showMyBookings = () => {
        if (!isUserLoggedIn()) {
            openLoginModal(() => {
                showMyBookings();
            });
            return;
        }
        const modal = document.getElementById('myBookingsModal');
        const container = document.getElementById('bookingsListContainer');
        
        // Show loading state
        container.innerHTML = `<div class="loading-state" style="text-align:center; padding:40px; color:var(--text-secondary);">
            <div class="spinner" style="width:30px; height:30px; border:3px solid rgba(255,255,255,0.1); border-top-color:var(--accent); border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 15px;"></div>
            Fetching your bookings...
        </div>`;
        
        modal.classList.add('active');
        document.body.classList.add('modal-open');

        // DOUBLE CHECK: Validate user exists before showing history
        fetch(`/validate-user/?phone=${currentUser.phone}&t=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                if (data.exists === false) {
                    logout();
                    return;
                }
            });

        // Fetch from DB with cache-busting
        fetch(`/get-user-bookings/?phone=${currentUser.phone}&t=${Date.now()}`)
            .then(res => res.json())
            .then(bookings => {
                if (!bookings || bookings.length === 0) {
                    container.innerHTML = `
                        <div class="no-bookings">
                            <div style="font-size:3rem; margin-bottom:1rem;">📭</div>
                            <h3>No bookings yet</h3>
                            <p>When you book a court, it will appear here.</p>
                        </div>
                    `;
                } else {
                    container.innerHTML = bookings.map(b => `
                        <div class="booking-card">
                            <div class="booking-card-header">
                                <span class="booking-facility">${b.facility || 'Court Booking'}</span>
                                <div class="booking-status-badge">Confirmed</div>
                            </div>
                            <div class="booking-card-body">
                                <div class="booking-detail">
                                    <span class="detail-label">Date</span>
                                    <span class="detail-value">${b.date}</span>
                                </div>
                                <div class="booking-detail">
                                    <span class="detail-label">Time</span>
                                    <span class="detail-value">${b.tFrom} - ${b.tTo}</span>
                                </div>
                            </div>
                            <div class="booking-card-footer">
                                <span class="total-label">Total Paid</span>
                                <span class="total-value">₹${b.totalAmount}</span>
                            </div>
                        </div>
                    `).join('');
                }
            })
            .catch(err => {
                console.error("Error fetching bookings:", err);
                container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--danger);">Failed to load bookings. Please try again.</div>`;
            });
        
        // Update Bottom Nav Active State
        document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
        const historyBtn = Array.from(document.querySelectorAll('.mobile-bottom-nav .nav-item')).find(el => el.textContent.includes('History'));
        if (historyBtn) historyBtn.classList.add('active');
    };

    window.closeMyBookings = () => {
        const modal = document.getElementById('myBookingsModal');
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        
        // Restore Home Active State
        document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
        const homeBtn = Array.from(document.querySelectorAll('.mobile-bottom-nav .nav-item')).find(el => el.textContent.includes('Home'));
        if (homeBtn) homeBtn.classList.add('active');
    };

    window.logout = () => {
        // Clear EVERYTHING
        localStorage.clear();
        sessionStorage.clear();
        // Clear cookies too
        document.cookie.split(";").forEach((c) => {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        
        currentUser = null;
        updateAuthUI();
        window.location.href = "/"; // Hard redirect
    };

    // VALIDATION: Check if logged-in user still exists in DB (Cache-busted & Aggressive)
    if (currentUser && currentUser.phone) {
        fetch(`/validate-user/?phone=${currentUser.phone}&t=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                if (data.exists === false) {
                    console.warn("CRITICAL: User session invalidated by server.");
                    // Force a clean logout
                    localStorage.clear(); 
                    currentUser = null;
                    updateAuthUI();
                    alert("Your session has expired or your account was deleted. Logging out...");
                    window.location.href = "/"; // Force redirect to home
                }
            })
            .catch(err => console.error("Validation failed:", err));
    }

    // --- OTP Input Auto-focus ---
    const otpInputs = document.querySelectorAll('.otp-input');
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });

    // --- Auth Functions ---
    let authPendingAction = null; // Store function to run after login

    window.openLoginModal = (callback = null) => {
        authPendingAction = callback;
        document.getElementById('loginModal').classList.add('active');
    };

    window.sendOTP = () => {
        const phone = document.getElementById('loginPhone').value.trim();
        const name = document.getElementById('loginName').value.trim();
        console.log("Attempting to send OTP to:", phone);
        if (name.length < 2) { alert('Please enter your full name'); return; }
        if (phone.length < 10) { alert('Please enter a valid 10-digit number'); return; }
        
        fetch('/send-otp/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone, name: name })
        })
        .then(res => {
            if (!res.ok) throw new Error('Server returned ' + res.status);
            return res.json();
        })
        .then(data => {
            console.log("Send OTP response:", data);
            if (data.status === 'success') {
                document.getElementById('otpDisplayPhone').textContent = `+91 ${phone}`;
                document.getElementById('loginModal').classList.remove('active');
                document.getElementById('otpModal').classList.add('active');
                if (otpInputs.length > 0) otpInputs[0].focus();
                startOTPTimer(15 * 60); // Start 15 min timer
                console.log("OTP sent successfully! Check your terminal.");
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(err => {
            console.error("Fetch error (send-otp):", err);
            alert('Failed to send OTP. Please check your internet connection or server terminal.');
        });
    };

    window.verifyOTP = () => {
        const otp = Array.from(otpInputs).map(i => i.value).join('');
        if (otp.length < 4) { alert('Please enter the 4-digit code'); return; }
        
        fetch('/verify-otp/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otp: otp })
        })
        .then(res => {
            if (!res.ok) throw new Error('Server returned ' + res.status);
            return res.json();
        })
        .then(data => {
            if (data.status === 'success') {
                const phone = document.getElementById('loginPhone').value.trim();
                const name = document.getElementById('loginName').value.trim();
                currentUser = { phone: phone, name: name };
                localStorage.setItem('playarena_user', JSON.stringify(currentUser));
                
                document.getElementById('otpModal').classList.remove('active');
                updateAuthUI();

                if (authPendingAction) {
                    authPendingAction();
                    authPendingAction = null;
                }
            } else {
                alert('Invalid OTP. Please check your terminal and try again.');
                otpInputs.forEach(i => i.value = '');
                if (otpInputs.length > 0) otpInputs[0].focus();
            }
        })
        .catch(err => {
            console.error("Fetch error (verify-otp):", err);
            alert('Verification failed. Please try again.');
        });
    };



    window.addToCart = (name, price) => {
        const item = cart.find(i => i.name === name);
        if (item) {
            item.qty++;
        } else {
            cart.push({ name, price, qty: 1 });
        }
        saveCart();
    };

    window.updateQty = (name, delta) => {
        const item = cart.find(i => i.name === name);
        if (item) {
            item.qty += delta;
            if (item.qty <= 0) {
                cart = cart.filter(i => i.name !== name);
            }
            saveCart();
        }
    };

    function saveCart() {
        localStorage.setItem('cafe_cart', JSON.stringify(cart));
        updateCartUI();
    }

    function updateCartUI() {
        const floatingBill = document.getElementById('floatingBill');
        const billTotal = document.getElementById('billTotal');
        
        const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        if (total > 0) {
            if (floatingBill) floatingBill.style.display = 'block';
            if (billTotal) billTotal.textContent = `₹${total}`;
        } else {
            if (floatingBill) floatingBill.style.display = 'none';
        }

        // Update Cafe Page Buttons
        cart.forEach(item => {
            const btnContainer = document.querySelector(`[data-item="${item.name}"]`);
            if (btnContainer) {
                btnContainer.innerHTML = `
                    <div class="item-qty-control">
                        <button class="qty-btn" onclick="updateQty('${item.name}', -1)">-</button>
                        <span>${item.qty}</span>
                        <button class="qty-btn" onclick="updateQty('${item.name}', 1)">+</button>
                    </div>
                `;
            }
        });

        // Handle items removed from cart
        document.querySelectorAll('.add-to-bill-btn-container').forEach(container => {
            const itemName = container.getAttribute('data-item');
            if (!cart.find(i => i.name === itemName)) {
                const price = container.getAttribute('data-price');
                container.innerHTML = `<button class="add-to-bill-btn" onclick="addToCart('${itemName}', ${price})">+ Add to Bill</button>`;
            }
        });
    }

    // Run on load
    updateCartUI();

    const timeFrom = document.getElementById('timeFrom');
    const timeTo = document.getElementById('timeTo');
    const displayFrom = document.getElementById('displayFrom');
    const displayTo = document.getElementById('displayTo');
    const dropdownFrom = document.getElementById('dropdownFrom');
    const dropdownTo = document.getElementById('dropdownTo');
    const boxFrom = document.getElementById('boxFrom');
    const boxTo = document.getElementById('boxTo');
    const durationDisplay = document.getElementById('durationDisplay');

    // Populate dropdowns with 30-min intervals
    let optionsHTML = '';
    for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0');
        optionsHTML += `<div class="time-option" data-value="${hour}:00">${hour}:00</div>`;
        optionsHTML += `<div class="time-option" data-value="${hour}:30">${hour}:30</div>`;
    }
    dropdownFrom.innerHTML = optionsHTML;
    dropdownTo.innerHTML = optionsHTML;

    // Toggle dropdowns
    boxFrom.addEventListener('click', (e) => {
        dropdownFrom.classList.toggle('show');
        dropdownTo.classList.remove('show');
        e.stopPropagation();
    });

    boxTo.addEventListener('click', (e) => {
        dropdownTo.classList.toggle('show');
        dropdownFrom.classList.remove('show');
        e.stopPropagation();
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        dropdownFrom.classList.remove('show');
        dropdownTo.classList.remove('show');
    });

    // Handle Option Clicks
    dropdownFrom.querySelectorAll('.time-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            timeFrom.value = opt.dataset.value;
            displayFrom.innerHTML = `${opt.dataset.value} <span class="clock-icon">🕒</span>`;
            calculateDuration();
            dropdownFrom.classList.remove('show');
            e.stopPropagation();
        });
    });

    dropdownTo.querySelectorAll('.time-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            timeTo.value = opt.dataset.value;
            displayTo.innerHTML = `${opt.dataset.value} <span class="clock-icon">🕒</span>`;
            calculateDuration();
            dropdownTo.classList.remove('show');
            e.stopPropagation();
        });
    });

    function calculateDuration() {
        if (timeFrom.value && timeTo.value) {
            const [fromHours, fromMinutes] = timeFrom.value.split(':').map(Number);
            const [toHours, toMinutes] = timeTo.value.split(':').map(Number);
            
            let fromDate = new Date();
            fromDate.setHours(fromHours, fromMinutes, 0);
            
            let toDate = new Date();
            toDate.setHours(toHours, toMinutes, 0);

            // Handle booking spanning past midnight
            if (toDate <= fromDate) {
                toDate.setDate(toDate.getDate() + 1);
            }

            const diffMs = toDate - fromDate;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = diffMins / 60;

            if (diffHours < 1) {
                durationDisplay.textContent = 'Minimum booking duration is 1 hour.';
                durationDisplay.style.color = '#ff6b6b';
            } else {
                durationDisplay.textContent = `Duration: ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
                durationDisplay.style.color = 'var(--accent)';
            }
            // Now apply locks since we have both times
            applyCourtLocks();
        } else {
            durationDisplay.textContent = '';
            applyCourtLocks(); // Unlock if time missing
        }
    }



    // Set today as default date and min date
    const dateInput = document.getElementById('bookingDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.min = today;

    // Facility Pill Selection
    const facilityPills = document.querySelectorAll('#facilityPills .pill');
    const selectedFacilityInput = document.getElementById('selectedFacility');
    const pickleballOptions = document.getElementById('pickleballOptions');
    const padelOptions = document.getElementById('padelOptions');

    facilityPills.forEach(pill => {
        pill.addEventListener('click', () => {
            facilityPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedFacilityInput.value = pill.dataset.value;
            
            if (pill.dataset.value === 'Pickleball') {
                pickleballOptions.classList.remove('hidden');
                padelOptions.classList.add('hidden');
            } else if (pill.dataset.value === 'Padel') {
                padelOptions.classList.remove('hidden');
                pickleballOptions.classList.add('hidden');
            } else {
                pickleballOptions.classList.add('hidden');
                padelOptions.classList.add('hidden');
            }

            // Reset time selection
            timeFrom.value = '';
            timeTo.value = '';
            displayFrom.innerHTML = `--:-- <span class="clock-icon">🕒</span>`;
            displayTo.innerHTML = `--:-- <span class="clock-icon">🕒</span>`;
            durationDisplay.textContent = '';
            updateAvailability();
        });
    });

    // Playground Pill Selection
    const playgroundPills = document.querySelectorAll('#playgroundPills .pill');
    const selectedPlayground = document.getElementById('selectedPlayground');
    playgroundPills.forEach(pill => {
        pill.addEventListener('click', () => {
            playgroundPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedPlayground.value = pill.dataset.value;
            updateAvailability();
        });
    });

    // Court Pill Selection
    const courtPills = document.querySelectorAll('#courtPills .pill');
    const selectedCourt = document.getElementById('selectedCourt');
    courtPills.forEach(pill => {
        pill.addEventListener('click', () => {
            courtPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedCourt.value = pill.dataset.value;
            updateAvailability();
        });
    });

    // Padel Playground Pill Selection
    const padelPlaygroundPills = document.querySelectorAll('#padelPlaygroundPills .pill');
    const selectedPadelPlayground = document.getElementById('selectedPadelPlayground');
    padelPlaygroundPills.forEach(pill => {
        pill.addEventListener('click', () => {
            padelPlaygroundPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedPadelPlayground.value = pill.dataset.value;
        });
    });

    // Padel Court Pill Selection
    const padelCourtPills = document.querySelectorAll('#padelCourtPills .pill');
    const selectedPadelCourt = document.getElementById('selectedPadelCourt');
    padelCourtPills.forEach(pill => {
        pill.addEventListener('click', () => {
            padelCourtPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedPadelCourt.value = pill.dataset.value;
            updateAvailability();
        });
    });

    // Update availability when date changes
    dateInput.addEventListener('change', updateAvailability);

    async function updateAvailability() {
        window.updateAvailability = updateAvailability;
        const date = dateInput.value;
        if(!date) return;

        const res = await fetch(`/api/public/courts/?date=${date}&t=${Date.now()}`);
        if(res.ok) {
            window.currentCourtsData = await res.json();
            applyCourtLocks();
        }
    };
    
    function applyCourtLocks() {
        if (!window.currentCourtsData) return;

        // Unlock all if time is incomplete
        if (!timeFrom.value || !timeTo.value) {
            document.querySelectorAll('.pill').forEach(p => p.classList.remove('locked'));
            return;
        }

        function toMin(t) {
            if (!t) return 0;
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        }

        let new_start = toMin(timeFrom.value);
        let new_end = toMin(timeTo.value);
        if (new_end <= new_start) new_end += 1440;

        function getConflictingSlot(cId) {
            const courtData = window.currentCourtsData.find(c => c.id === cId || c.name === cId);
            if (!courtData || !courtData.all_slots) return null;
            
            for (let s of courtData.all_slots) {
                let b_start = toMin(s.from);
                let b_end = toMin(s.to);
                if (b_end <= b_start) b_end += 1440;
                
                if (new_start < b_end && new_end > b_start) return s;
            }
            return null;
        }

        let conflictSlot = null;
        const facility = selectedFacilityInput.value;

        if (facility === 'Pickleball') {
            const pg = selectedPlayground.value.includes("1") ? "P1" : "P2";
            let allBooked = true;
            courtPills.forEach(pill => {
                const ct = pill.dataset.value.replace("Court ", "C");
                const cId = `${pg}-${ct}`;
                const conflict = getConflictingSlot(cId);
                if (conflict) {
                    pill.classList.add('locked');
                    if (pill.classList.contains('active')) {
                        conflictSlot = conflict;
                        pill.classList.remove('active');
                        selectedCourt.value = '';
                    }
                } else {
                    pill.classList.remove('locked');
                    allBooked = false;
                }
            });
            if (allBooked && !conflictSlot && timeFrom.value && timeTo.value) {
                const firstCourt = `${pg}-C1`;
                conflictSlot = getConflictingSlot(firstCourt);
            }
        } else if (facility === 'Padel') {
            let allBooked = true;
            padelCourtPills.forEach(pill => {
                const ct = pill.dataset.value.includes("1") ? "1" : "2";
                const cId = `Padel Court ${ct}`;
                const conflict = getConflictingSlot(cId);
                if (conflict) {
                    pill.classList.add('locked');
                    if (pill.classList.contains('active')) {
                        conflictSlot = conflict;
                        pill.classList.remove('active');
                        selectedPadelCourt.value = '';
                    }
                } else {
                    pill.classList.remove('locked');
                    allBooked = false;
                }
            });
            if (allBooked && !conflictSlot && timeFrom.value && timeTo.value) {
                conflictSlot = getConflictingSlot(`Padel Court 1`);
            }
        } else if (facility === 'Box Cricket') {
            conflictSlot = getConflictingSlot("CR-1");
        }

        // Update durationDisplay with specific conflict message if found
        if (conflictSlot && timeFrom.value && timeTo.value) {
            durationDisplay.textContent = `${conflictSlot.from} to ${conflictSlot.to} slot is booked`;
            durationDisplay.style.color = '#ff6b6b';
            durationDisplay.style.fontWeight = '700';
        }
    }

    
    // Call it once on page load to populate the default state
    updateAvailability();

    // LIVE UPDATES: Refresh availability every 10 seconds automatically
    setInterval(updateAvailability, 10000);

    // Also refresh immediately when the user clicks the time boxes
    boxFrom.addEventListener('click', updateAvailability);
    boxTo.addEventListener('click', updateAvailability);

    // Form Submission → open Payment Modal
    const bookingForm = document.getElementById('bookingForm');
    const modal = document.getElementById('successModal');
    const paymentModal = document.getElementById('paymentModal');
    const modalDetails = document.getElementById('modalDetails');


    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Check Login first
        if (!isUserLoggedIn()) {
            openLoginModal(() => {
                // After successful login, trigger the submit again
                bookingForm.dispatchEvent(new Event('submit'));
            });
            return;
        }

        // Check for booking conflict
        if (durationDisplay.textContent.includes('slot is booked')) {
            alert("This slot is already booked. Please select another time or court.");
            return;
        }

        let facility = selectedFacilityInput.value;
        if (facility === 'Pickleball') {
            const pg = document.getElementById('selectedPlayground').value;
            const ct = document.getElementById('selectedCourt').value;
            facility = `Pickleball (${pg}, ${ct})`;
        } else if (facility === 'Padel') {
            const pg = document.getElementById('selectedPadelPlayground').value;
            const ct = document.getElementById('selectedPadelCourt').value;
            facility = `Padel (${pg}, ${ct})`;
        }

        const date = dateInput.value;
        const tFrom = timeFrom.value;
        const tTo = timeTo.value;
        const name = currentUser.name || "Unknown";
        const phone = currentUser.phone;

        if (!tFrom || !tTo) { alert('Please select both FROM and TO times.'); return; }

        const [fromHours, fromMinutes] = tFrom.split(':').map(Number);
        const [toHours, toMinutes] = tTo.split(':').map(Number);
        let fromDate = new Date(); fromDate.setHours(fromHours, fromMinutes, 0);
        let toDate = new Date(); toDate.setHours(toHours, toMinutes, 0);
        if (toDate <= fromDate) toDate.setDate(toDate.getDate() + 1);

        const diffHours = (toDate - fromDate) / 3600000;
        if (diffHours < 1) { alert('Minimum booking duration is 1 hour.'); return; }

        // Determine base facility key for pricing
        const baseKey = Object.keys(FACILITY_RATES).find(k => facility.startsWith(k)) || 'Pickleball';
        const ratePerHour = FACILITY_RATES[baseKey];
        const courtAmount = Math.round(ratePerHour * diffHours);
        
        const totalAmount = courtAmount;
        const advanceAmount = Math.round(totalAmount * 0.5);

        // Standardize Facility ID
        let facility_id = "";
        if (selectedFacilityInput.value === 'Pickleball') {
            const pg = document.getElementById('selectedPlayground').value.includes("1") ? "P1" : "P2";
            const ct = document.getElementById('selectedCourt').value.replace("Court ", "C");
            facility_id = `${pg}-${ct}`;
        } else if (selectedFacilityInput.value === 'Box Cricket') {
            facility_id = "CR-1";
        } else if (selectedFacilityInput.value === 'Padel') {
            const ct = document.getElementById('selectedPadelCourt').value.includes("1") ? "1" : "2";
            facility_id = `PD-${ct}`;
        }

        // Store for confirmPayment
        pendingBooking = { facility, facility_id, date, tFrom, tTo, name, phone, totalAmount, advanceAmount, cart: [] };

        // Populate payment modal
        document.getElementById('paymentSummary').innerHTML = `
            <div class="summary-row">
                <span class="summary-label">Name</span>
                <span class="summary-value">${name}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">Phone</span>
                <span class="summary-value">${phone}</span>
            </div>
            <div class="summary-divider"></div>
            <div class="summary-row">
                <span class="summary-label">Facility</span>
                <span class="summary-value">${facility}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">Date</span>
                <span class="summary-value">${date}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">Time</span>
                <span class="summary-value">${tFrom} - ${tTo} (${diffHours} hr)</span>
            </div>
            <div class="summary-divider"></div>
            <div class="summary-row">
                <span class="summary-label">Court Fee</span>
                <span class="summary-value">₹${courtAmount}</span>
            </div>
        `;
        document.getElementById('totalAmount').textContent = `₹${totalAmount}`;
        document.getElementById('advanceAmount').textContent = `₹${advanceAmount}`;
        document.getElementById('advancePay').textContent = advanceAmount;
        document.getElementById('upiId').value = '';

        paymentModal.classList.add('active');
        document.body.classList.add('modal-open');
    });

    // Smooth scrolling for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
});

// Scroll to booking and pre-select facility
function scrollToBooking(facility) {
    document.querySelector('#booking').scrollIntoView({ behavior: 'smooth' });
    
    // Trigger click on the matching pill
    const pills = document.querySelectorAll('#facilityPills .pill');
    pills.forEach(pill => {
        if (pill.dataset.value === facility) {
            pill.click();
        }
    });
}

function closeModal() {
    document.getElementById('successModal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function payWithApp(app) {
    if (!pendingBooking.advanceAmount) return;

    const vpa = "playarena@upi"; // Your business VPA
    const name = "PlayArena Sports Hub";
    const amount = pendingBooking.advanceAmount;
    const note = `Booking: ${pendingBooking.facility} for ${pendingBooking.name}`;

    // Construct standard UPI URL
    const upiUrl = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

    // Try to open the app
    window.location.href = upiUrl;

    // After a short delay, inform the user to confirm manually if they are on desktop
    setTimeout(() => {
        if (confirm("If you are on desktop, please enter your UPI ID manually below. If the app opened on your mobile, once paid, click OK to confirm here.")) {
            // If they clicked OK, we'll assume they paid or want to confirm
            document.getElementById('upiId').value = "PAID_VIA_APP";
            confirmPayment();
        }
    }, 1500);
}

function confirmPayment() {
    const upi = document.getElementById('upiId').value.trim();

    // Basic UPI validation
    if (!upi || (!upi.includes('@') && upi !== 'PAID_VIA_APP')) {
        alert('Please enter a valid UPI ID');
        return;
    }

    // Attach UPI to pending booking
    const bookingToSave = {
        ...pendingBooking,
        upi_id: upi,
        timestamp: new Date().toISOString()
    };

    // Send to Backend (MongoDB)
    fetch('/create-booking/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingToSave)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            // Close payment modal
            document.getElementById('paymentModal').classList.remove('active');

            // Show success modal
            const modalDetails = document.getElementById('modalDetails');
            modalDetails.innerHTML = `Advance of <strong>₹${pendingBooking.advanceAmount}</strong> received. Your slot is confirmed! <br><small style="color:var(--text-secondary)">Ref: ${data.booking_id}</small>`;
            document.getElementById('successModal').classList.add('active');

            // Store locally for UI history
            const localHistory = JSON.parse(localStorage.getItem('playarena_bookings')) || [];
            localHistory.push({ ...bookingToSave, id: data.booking_id });
            localStorage.setItem('playarena_bookings', JSON.stringify(localHistory));

            // Reset form and cart
            const bookingForm = document.getElementById('bookingForm');
            if (bookingForm) {
                bookingForm.reset();
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('bookingDate').value = today;
                document.getElementById('timeFrom').value = '';
                document.getElementById('timeTo').value = '';
                document.getElementById('displayFrom').innerHTML = `--:-- <span class="clock-icon">🕒</span>`;
                document.getElementById('displayTo').innerHTML = `--:-- <span class="clock-icon">🕒</span>`;
                document.getElementById('durationDisplay').textContent = '';
            }
            localStorage.setItem('cafe_cart', JSON.stringify([]));
        } else {
            alert("Error saving booking: " + data.message);
        }
    })
    .catch(err => {
        console.error("Booking error:", err);
        alert("Booking failed: " + err.message + ". If the server was restarting, please try again.");
    });
}

let otpInterval;
function startOTPTimer(seconds) {
    clearInterval(otpInterval);
    const display = document.getElementById('timerDisplay');
    const verifyBtn = document.querySelector('#otpModal .btn-primary');
    
    let remaining = seconds;
    otpInterval = setInterval(() => {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        if (display) display.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        if (remaining <= 0) {
            clearInterval(otpInterval);
            if (display) {
                display.textContent = "0:00 (Expired)";
                display.style.color = "#ff4d4d";
            }
            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.style.opacity = "0.5";
            }
        }
        remaining--;
    }, 1000);
}

