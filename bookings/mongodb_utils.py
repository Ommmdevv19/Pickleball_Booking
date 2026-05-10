import pymongo
from django.conf import settings
from datetime import datetime, timedelta
import uuid

# MongoDB Connection Configuration
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "playarena_db"

def get_db():
    client = pymongo.MongoClient(MONGO_URI)
    return client[DB_NAME]

def is_court_available(court_id, date_str, tFrom, tTo):
    """
    Checks if a court is available for a given time range.
    """
    db = get_db()
    # Find all bookings for this date and filter robustly
    bookings = db.bills.find({"date": date_str})
    
    court_bookings = []
    for b in bookings:
        f_str = b.get('facility', '')
        f_id = b.get('facility_id', '')
        if f_id == court_id or court_id in f_str:
            court_bookings.append(b)
    def to_min(t):
        h, m = map(int, t.split(':'))
        return h * 60 + m

    new_start = to_min(tFrom)
    new_end = to_min(tTo)
    
    # Handle overnight (if applicable, but usually slots are within 24h)
    if new_end <= new_start: new_end += 1440 

    for b in court_bookings:
        b_start = to_min(b.get('tFrom'))
        b_end = to_min(b.get('tTo'))
        if b_end <= b_start: b_end += 1440
        
        # Overlap logic: (StartA < EndB) and (EndA > StartB)
        if new_start < b_end and new_end > b_start:
            return False # Overlap found
            
    return True

def save_booking(booking_data):
    """
    Saves a booking to the MongoDB 'bills' collection.
    """
    db = get_db()
    if 'bill_number' not in booking_data:
        booking_data['bill_number'] = f"PA-{str(uuid.uuid4())[:8].upper()}"
    
    # Ensure timestamp is a datetime object for queries
    if 'timestamp' not in booking_data:
        booking_data['timestamp'] = datetime.now()
    elif isinstance(booking_data['timestamp'], str):
        try:
            booking_data['timestamp'] = datetime.fromisoformat(booking_data['timestamp'].replace('Z', '+00:00'))
        except:
            booking_data['timestamp'] = datetime.now()

    result = db.bills.insert_one(booking_data)
    return str(result.inserted_id)

def create_user_if_not_exists(user_data):
    """
    Creates or updates a user in the MongoDB 'users' collection.
    """
    db = get_db()
    db.users.update_one(
        {"credentials.phone": user_data['phone']},
        {"$set": {
            "first_name": user_data.get('first_name', 'Guest'),
            "phone": user_data['phone'],
            "credentials.phone": user_data['phone'],
            "is_active": True,
            "updated_at": datetime.now()
        }},
        upsert=True
    )

def get_admin_stats(period='today'):
    """
    Returns comprehensive stats for the admin dashboard.
    """
    db = get_db()
    now = datetime.now()
    
    start_date = None
    if period == 'today':
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'week':
        start_date = now - timedelta(days=7)
    elif period == 'month':
        start_date = now - timedelta(days=30)
    elif period == '6months':
        start_date = now - timedelta(days=180)
    
    # Robust date matching for strings
    today_str = now.strftime("%Y-%m-%d")
    today_alt = now.strftime("%d/%m/%Y")
    today_alt2 = now.strftime("%d-%m-%Y")
    
    query = {}
    if period == 'today':
        query["$or"] = [
            {"timestamp": {"$gte": start_date}},
            {"date": today_str},
            {"date": today_alt},
            {"date": today_alt2}
        ]
    elif start_date:
        query["$or"] = [
            {"timestamp": {"$gte": start_date}},
            {"date": {"$gte": start_date.strftime("%Y-%m-%d")}} # Fallback for ISO strings
        ]
    
    all_bookings = list(db.bills.find())
    bookings = list(db.bills.find(query)) if period != 'all' else all_bookings
    
    def safe_float(v):
        try: return float(v)
        except: return 0.0

    revenue = sum(safe_float(b.get('totalAmount', 0)) for b in bookings)
    count = len(bookings)
    
    # Calculate previous period for delta
    prev_revenue = 0
    if period != 'all':
        prev_start_date = None
        if period == 'today':
            prev_start_date = start_date - timedelta(days=1)
        elif period == 'week':
            prev_start_date = start_date - timedelta(days=7)
        elif period == 'month':
            prev_start_date = start_date - timedelta(days=30)
        
        if prev_start_date:
            # Range query for previous period
            prev_q = {
                "$or": [
                    {"timestamp": {"$gte": prev_start_date, "$lt": start_date}},
                    {
                        "$and": [
                            {"date": {"$gte": prev_start_date.strftime("%Y-%m-%d")}},
                            {"date": {"$lt": start_date.strftime("%Y-%m-%d")}}
                        ]
                    }
                ]
            }
            prev_bookings = list(db.bills.find(prev_q))
            prev_revenue = sum(safe_float(b.get('totalAmount', 0)) for b in prev_bookings)
        
        # If prev_revenue is 0 but current is > 0, show 100% growth
        if prev_revenue == 0 and revenue > 0:
            rev_delta = 100
        elif prev_revenue > 0:
            rev_delta = round(((revenue - prev_revenue) / prev_revenue) * 100, 1)
        else:
            rev_delta = 0
    
    # Sport Split
    sport_split = {}
    for b in bookings:
        fac = b.get('facility', 'Other')
        if 'Pickleball' in fac: sport = 'Pickleball'
        elif 'Cricket' in fac: sport = 'Box Cricket'
        elif 'Padel' in fac: sport = 'Padel Court'
        else: sport = fac.split(' (')[0]
        sport_split[sport] = sport_split.get(sport, 0) + safe_float(b.get('totalAmount', 0))
    
    # Top Customers (Overall)
    customer_spend = {}
    for b in all_bookings:
        phone = b.get('phone')
        name = b.get('name', 'Unknown')
        if phone:
            if phone not in customer_spend:
                customer_spend[phone] = {"name": name, "amount": 0, "count": 0}
            customer_spend[phone]["amount"] += safe_float(b.get('totalAmount', 0))
            customer_spend[phone]["count"] += 1
            
    top_customers = sorted(
        [{"phone": p, **v} for p, v in customer_spend.items()],
        key=lambda x: x['amount'],
        reverse=True
    )[:10]

    # Total stats for badges
    total_revenue = sum(safe_float(b.get('totalAmount', 0)) for b in all_bookings)
    total_bookings = len(all_bookings)
    user_phones = {b.get('phone') for b in all_bookings if b.get('phone')}
    
    repeat_users = [p for p, c in customer_spend.items() if c['count'] > 1]
    repeat_rate = (len(repeat_users) / len(user_phones) * 100) if user_phones else 0

    return {
        "revenue": revenue,
        "count": count,
        "rev_delta": round(rev_delta, 1),
        "sport_split": sport_split,
        "top_customers": top_customers,
        "repeat_rate": round(repeat_rate, 1),
        "total_revenue": total_revenue,
        "total_bookings": total_bookings,
        "new_bookings": count, # New in this period
        "total_customers": len(user_phones)
    }

def get_revenue_trend(period='6months'):
    db = get_db()
    now = datetime.now()
    trend = []
    
    def safe_float(v):
        try: return float(v)
        except: return 0.0

    if period == 'today':
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        for i in range(24):
            h_start = start_of_day + timedelta(hours=i)
            h_end = h_start + timedelta(hours=1)
            query = {"timestamp": {"$gte": h_start, "$lt": h_end}}
            rev = sum(safe_float(b.get('totalAmount', 0)) for b in db.bills.find(query))
            trend.append({"label": f"{i:02d}:00", "revenue": rev})
    elif period == 'week':
        for i in range(6, -1, -1):
            d_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            d_end = d_start + timedelta(days=1)
            query = {"timestamp": {"$gte": d_start, "$lt": d_end}}
            rev = sum(safe_float(b.get('totalAmount', 0)) for b in db.bills.find(query))
            trend.append({"label": d_start.strftime("%a"), "revenue": rev})
    elif period == 'month':
        for i in range(29, -1, -1):
            d_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            d_end = d_start + timedelta(days=1)
            query = {"timestamp": {"$gte": d_start, "$lt": d_end}}
            rev = sum(safe_float(b.get('totalAmount', 0)) for b in db.bills.find(query))
            trend.append({"label": d_start.strftime("%d %b"), "revenue": rev})
    else: # 6months
        for i in range(5, -1, -1):
            m_start = (now - timedelta(days=i*30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if m_start.month == 12: next_m = m_start.replace(year=m_start.year+1, month=1)
            else: next_m = m_start.replace(month=m_start.month+1)
            query = {"timestamp": {"$gte": m_start, "$lt": next_m}}
            rev = sum(safe_float(b.get('totalAmount', 0)) for b in db.bills.find(query))
            trend.append({"label": m_start.strftime("%b"), "revenue": rev})
    return trend

def get_all_bookings(period='all', limit=1000):
    db = get_db()
    query = {}
    if period != 'all':
        now = datetime.now()
        if period == 'today':
            start = now.replace(hour=0, minute=0, second=0)
            query["$or"] = [
                {"timestamp": {"$gte": start}},
                {"date": now.strftime("%Y-%m-%d")}
            ]
        elif period == 'week':
            start = now - timedelta(days=7)
            query["$or"] = [
                {"timestamp": {"$gte": start}},
                {"date": {"$gte": start.strftime("%Y-%m-%d")}}
            ]
        elif period == 'month':
            start = now - timedelta(days=30)
            query["$or"] = [
                {"timestamp": {"$gte": start}},
                {"date": {"$gte": start.strftime("%Y-%m-%d")}}
            ]

    return list(db.bills.find(query).sort([("date", -1), ("tFrom", -1)]).limit(limit))

def get_all_customers():
    db = get_db()
    bills = list(db.bills.find())
    
    customer_map = {}
    for b in bills:
        phone = b.get('phone')
        if not phone: continue
        
        if phone not in customer_map:
            customer_map[phone] = {
                "name": b.get('name', 'Guest'),
                "phone": phone,
                "bookings_count": 0,
                "total_spent": 0,
                "last_booking": b.get('date', 'N/A')
            }
        
        customer_map[phone]["bookings_count"] += 1
        customer_map[phone]["total_spent"] += b.get('totalAmount', 0)
        
        if b.get('date') and (customer_map[phone]["last_booking"] == 'N/A' or b.get('date') > customer_map[phone]["last_booking"]):
            customer_map[phone]["last_booking"] = b.get('date')

    return sorted(customer_map.values(), key=lambda x: x['total_spent'], reverse=True)

def delete_booking(bill_number):
    db = get_db()
    return db.bills.delete_one({"bill_number": bill_number})

def get_court_status(target_date=None):
    """
    Returns court status and all bookings for a specific date or upcoming period.
    """
    db = get_db()
    now = datetime.now()
    
    is_today = False
    is_upcoming = (target_date == 'upcoming')
    
    if not target_date or target_date == 'today':
        target_date = now.strftime("%Y-%m-%d")
        is_today = True
    
    current_time_str = now.strftime("%H:%M")
    
    # Courts we track
    courts = []
    # Phase 1: C1 to C6
    for i in range(1, 7):
        courts.append({"id": f"P1-C{i}", "name": f"Pickleball P1-C{i}", "sport": "Pickleball"})
    # Phase 2: C1 to C6
    for i in range(1, 7):
        courts.append({"id": f"P2-C{i}", "name": f"Pickleball P2-C{i}", "sport": "Pickleball"})
    
    # Other sports
    courts.append({"id": "CR-1", "name": "Box Cricket", "sport": "Cricket"})
    courts.append({"id": "PD-1", "name": "Padel Court 1", "sport": "Padel"})
    courts.append({"id": "PD-2", "name": "Padel Court 2", "sport": "Padel"})
    
    if is_upcoming:
        # All bookings from tomorrow onwards
        tomorrow_start = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_bookings = list(db.bills.find({
            "timestamp": {"$gte": tomorrow_start}
        }).sort("timestamp", 1))
    else:
        # Specific day bookings
        day_bookings = list(db.bills.find({"date": target_date}).sort("tFrom", 1))
    
    for court in courts:
        # Find if currently busy (only for today)
        active = None
        if is_today:
            active = next((b for b in day_bookings if court['name'] in b.get('facility', '') 
                          and b.get('tFrom', '00:00') <= current_time_str <= b.get('tTo', '23:59')), None)
        
        court['status'] = 'busy' if active else 'free'
        court['current_user'] = active.get('name') if active else None
        court['ends_at'] = active.get('tTo') if active else None
        
        # All bookings for this court
        court_slots = []
        for b in day_bookings:
            f_str = b.get('facility', '')
            f_id = b.get('facility_id', '')
            # Match by facility_id (new way) or fallback to fuzzy matching (old way)
            # This checks for ID like "P1-C1" or descriptive text in the facility string
            if f_id == court['id'] or court['id'] in f_str or (court['sport'] in f_str and court['id'].split('-')[-1] in f_str):
                slot = {"name": b.get('name'), "from": b.get('tFrom'), "to": b.get('tTo'), "date": b.get('date')}
                court_slots.append(slot)
        
        # Limit upcoming slots to 10 for performance/UI
        court['all_slots'] = court_slots[:10]
        
    return courts

def get_pricing():
    db = get_db()
    config = db.config.find_one({"type": "pricing"})
    if not config:
        # Default pricing
        return {
            "Pickleball": 300,
            "Padel": 500,
            "Cricket": 400
        }
    return config.get('prices', {})

def update_pricing(prices):
    db = get_db()
    db.config.update_one(
        {"type": "pricing"},
        {"$set": {"prices": prices, "updated_at": datetime.now()}},
        upsert=True
    )

def get_admin_profile():
    db = get_db()
    profile = db.config.find_one({"type": "admin_profile"})
    if not profile:
        return {"name": "Admin User", "phone": "9313635412"}
    return {
        "name": profile.get("name", "Admin User"),
        "phone": profile.get("phone", "9313635412")
    }

def update_admin_profile(data):
    db = get_db()
    db.config.update_one(
        {"type": "admin_profile"},
        {"$set": {"name": data.get('name'), "phone": data.get('phone'), "updated_at": datetime.now()}},
        upsert=True
    )

def get_bookings_by_phone(phone):
    db = get_db()
    # Find all bookings for this phone number, sorted by date and time
    return list(db.bills.find({"phone": phone}).sort([("date", -1), ("tFrom", -1)]))
