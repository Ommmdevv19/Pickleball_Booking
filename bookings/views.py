from django.shortcuts import render, redirect
from django.http import JsonResponse
import random
import json
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from . import mongodb_utils
from bson import json_util

def index(request):
    prices = mongodb_utils.get_pricing()
    return render(request, 'bookings/index.html', {'prices': prices})

@csrf_exempt
def create_booking(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            # Check availability using facility_id (standard) or fallback to court
            court_id = data.get('facility_id') or data.get('court')
            is_avail = mongodb_utils.is_court_available(
                court_id, 
                data.get('date'), 
                data.get('tFrom'), 
                data.get('tTo')
            )
            if not is_avail:
                return JsonResponse({'status': 'error', 'message': 'This slot is already booked! Please select another time or court.'}, status=400)
                
            booking_id = mongodb_utils.save_booking(data)
            if 'phone' in data:
                mongodb_utils.create_user_if_not_exists({'phone': data['phone'], 'first_name': data.get('name')})
            return JsonResponse({'status': 'success', 'booking_id': booking_id})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    return JsonResponse({'status': 'error'}, status=400)

@csrf_exempt
def send_otp(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            phone = data.get('phone')
            otp = "1234" # TEMPORARY FOR TESTING
            request.session['otp'] = otp
            request.session['otp_phone'] = phone
            import time
            request.session['otp_time'] = time.time()
            print(f"\n🚀 VERIFICATION CODE FOR {phone}: {otp} 🚀\n")
            return JsonResponse({'status': 'success'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    return JsonResponse({'status': 'error'}, status=400)

@csrf_exempt
def verify_otp(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        otp_input = data.get('otp')
        if otp_input == request.session.get('otp'):
            return JsonResponse({'status': 'success'})
        return JsonResponse({'status': 'error', 'message': 'Invalid OTP'}, status=400)
    return JsonResponse({'status': 'error'}, status=400)

@csrf_exempt
def admin_panel(request):
    # 1. If not authenticated, handle or show login/2FA
    if not request.user.is_authenticated:
        if request.method == 'POST':
            # Case A: Password Step
            if 'username' in request.POST:
                u = request.POST.get('username')
                p = request.POST.get('password')
                user = authenticate(request, username=u, password=p)
                if user is not None:
                    # Start 2FA
                    otp = "1234" # TEMPORARY FOR TESTING
                    admin_prof = mongodb_utils.get_admin_profile()
                    phone = admin_prof.get('phone', 'N/A')
                    
                    request.session['2fa_user_id'] = user.id
                    request.session['2fa_otp'] = otp
                    
                    print(f"\n🔐 ADMIN 2FA OTP FOR {phone}: {otp} 🔐\n")
                    return render(request, 'bookings/admin_login.html', {'show_otp': True, 'phone': phone})
                else:
                    return render(request, 'bookings/admin_login.html', {'error': 'Invalid username or password'})
            
            # Case B: OTP Step
            elif 'otp_code' in request.POST:
                otp_input = request.POST.get('otp_code')
                saved_otp = request.session.get('2fa_otp')
                user_id = request.session.get('2fa_user_id')
                
                if otp_input == saved_otp and user_id:
                    from django.contrib.auth.models import User
                    user = User.objects.get(id=user_id)
                    login(request, user)
                    del request.session['2fa_otp']
                    del request.session['2fa_user_id']
                    return redirect('admin_panel')
                else:
                    admin_prof = mongodb_utils.get_admin_profile()
                    return render(request, 'bookings/admin_login.html', {
                        'show_otp': True, 
                        'phone': admin_prof.get('phone', 'N/A'),
                        'error': 'Invalid OTP code'
                    })
        
        return render(request, 'bookings/admin_login.html')

    # 2. If authenticated, show dashboard
    stats = mongodb_utils.get_admin_stats('today')
    trend = mongodb_utils.get_revenue_trend()
    bookings = mongodb_utils.get_all_bookings(limit=50)
    customers = mongodb_utils.get_all_customers()
    courts = mongodb_utils.get_court_status()
    prices = mongodb_utils.get_pricing()
    
    context = {
        'stats_json': json_util.dumps(stats),
        'trend_json': json_util.dumps(trend),
        'bookings_json': json_util.dumps(bookings),
        'customers_json': json_util.dumps(customers),
        'courts_json': json_util.dumps(courts),
        'prices_json': json_util.dumps(prices),
        'admin_json': json_util.dumps(mongodb_utils.get_admin_profile()),
    }
    return render(request, 'bookings/admin_dashboard.html', context)

def admin_logout(request):
    logout(request)
    return redirect('admin_panel')

# --- ADMIN API VIEWS ---

@login_required(login_url='admin_panel')
@csrf_exempt
def admin_api_stats(request):
    period = request.GET.get('period', 'today')
    stats = mongodb_utils.get_admin_stats(period)
    trend = mongodb_utils.get_revenue_trend(period if period != 'today' else 'today')
    # Merge them
    response_data = stats
    response_data['trend'] = trend
    return JsonResponse(json.loads(json_util.dumps(response_data)), safe=False)

@login_required(login_url='admin_panel')
@csrf_exempt
def admin_delete_booking(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        mongodb_utils.delete_booking(data.get('bill_number'))
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error'}, status=400)

@login_required(login_url='admin_panel')
@csrf_exempt
def admin_update_pricing(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        mongodb_utils.update_pricing(data.get('prices'))
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error'}, status=400)
@login_required(login_url='admin_panel')
@csrf_exempt
def admin_update_profile(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        mongodb_utils.update_admin_profile(data)
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error'}, status=400)
@login_required(login_url='admin_panel')
@csrf_exempt
def admin_api_courts(request):
    target_date = request.GET.get('date')
    courts = mongodb_utils.get_court_status(target_date)
    return JsonResponse(json.loads(json_util.dumps(courts)), safe=False)

@csrf_exempt
def get_user_bookings(request):
    phone = request.GET.get('phone')
    if not phone:
        return JsonResponse({'status': 'error', 'message': 'Phone required'}, status=400)
    bookings = mongodb_utils.get_bookings_by_phone(phone)
    return JsonResponse(json.loads(json_util.dumps(bookings)), safe=False)
