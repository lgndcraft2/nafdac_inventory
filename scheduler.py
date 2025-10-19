import time
from apscheduler.schedulers.background import BackgroundScheduler
from app import app, send_due_maintenance_notifications # Import your app and the job function

def start_scheduler():
    """Initializes and starts the background scheduler."""
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        func=send_due_maintenance_notifications, 
        trigger="interval", 
        hours=4
    )
    scheduler.start()
    print("APScheduler started for production...")

if __name__ == "__main__":
    # The app context is crucial for the job to access the database
    with app.app_context():
        start_scheduler()