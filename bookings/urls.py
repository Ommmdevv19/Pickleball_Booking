from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('send-otp/', views.send_otp, name='send_otp'),
    path('verify-otp/', views.verify_otp, name='verify_otp'),
    path('create-booking/', views.create_booking, name='create_booking'),
    path('check-availability/', views.check_availability, name='check_availability'),
    
    # Admin Panel (Unified Login & Dashboard)
    path('admin-panel/', views.admin_panel, name='admin_panel'),
    path('admin-login/', views.admin_panel), # Redirect/alias to unified panel
    path('admin-logout/', views.admin_logout, name='admin_logout'),
    path('admin-panel/api/stats/', views.admin_api_stats, name='admin_api_stats'),
    path('admin-panel/api/delete-booking/', views.admin_delete_booking, name='admin_delete_booking'),
    path('admin-panel/api/update-pricing/', views.admin_update_pricing, name='admin_update_pricing'),
    path('admin-panel/api/update-profile/', views.admin_update_profile, name='admin_update_profile'),
    path('admin-panel/api/courts/', views.admin_api_courts, name='admin_api_courts'),
    path('get-user-bookings/', views.get_user_bookings, name='get_user_bookings'),
    path('api/public/courts/', views.public_court_status, name='public_court_status'),
]
