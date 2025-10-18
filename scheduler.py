import time
from apscheduler.schedulers.background import BackgroundScheduler
from app import app, send_due_maintenance_notifications # Import your app and the job function

def start_scheduler():
    """Initializes and starts the background scheduler."""
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        func=send_due_maintenance_notifications, 
        trigger="interval", 
        seconds=30 # Run once a day in production
    )
    scheduler.start()
    print("APScheduler started for production...")

    # Keep the script running
    try:
        while True:
            time.sleep(2)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()

if __name__ == "__main__":
    # The app context is crucial for the job to access the database
    with app.app_context():
        start_scheduler()