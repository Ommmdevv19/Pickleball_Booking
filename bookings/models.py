from django.db import models

# Note: Booking and Transaction data is handled directly via MongoDB using mongodb_utils.py
# This ensures full compatibility with Python 3.13.

class UserProfile(models.Model):
    phone_number = models.CharField(max_length=15, unique=True)
    first_name = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.phone_number
