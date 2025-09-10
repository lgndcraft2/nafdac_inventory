from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from werkzeug.security import generate_password_hash, check_password_hash
from dateutil.relativedelta import relativedelta
from flask_login import UserMixin
from .extensions import db

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    roles = db.Column(db.String(50), nullable=False, default='user')  # e.g., 'admin', 'user'
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'
    
class Equipment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    manufacturer = db.Column(db.String(150))
    model = db.Column(db.String(150))
    serial_number = db.Column(db.String(150))
    new_id_number = db.Column(db.String(150), unique=True)
    location = db.Column(db.String(150))

    calibration_frequency = db.Column(db.String(100), default='Annual')
    calibration_date = db.Column(db.Date)
    next_calibration_date = db.Column(db.Date)

    maintenance_frequency = db.Column(db.String(100), default='Annual')
    maintenance_date = db.Column(db.Date)
    next_maintenance_date = db.Column(db.Date)

    description = db.Column(db.String(500))
    quantity = db.Column(db.Integer, default=1)
    # status = db.Column(db.String(100), default='OK')  # e.g., 'OK', 'Due Soon', 'Over Due'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_next_calibration_date(self):
        if self.calibration_date and self.calibration_frequency == 'Annual':
            self.next_calibration_date = self.calibration_date + relativedelta(years=1)
        elif self.calibration_date and self.calibration_frequency == 'Semi-Annual':
            self.next_calibration_date = self.calibration_date + relativedelta(months=6)
        elif self.calibration_date and self.calibration_frequency == 'Quarterly':
            self.next_calibration_date = self.calibration_date + relativedelta(months=3)
        elif self.calibration_date and self.calibration_frequency == 'Monthly':
            self.next_calibration_date = self.calibration_date + relativedelta(months=1)
        else:
            self.next_calibration_date = None

    def set_next_maintenance_date(self):
        if self.maintenance_date and self.maintenance_frequency == 'Annual':
            self.next_maintenance_date = self.maintenance_date + relativedelta(years=1)
        elif self.maintenance_date and self.maintenance_frequency == 'Semi-Annual':
            self.next_maintenance_date = self.maintenance_date + relativedelta(months=6)
        elif self.maintenance_date and self.maintenance_frequency == 'Quarterly':
            self.next_maintenance_date = self.maintenance_date + relativedelta(months=3)
        elif self.maintenance_date and self.maintenance_frequency == 'Monthly':
            self.next_maintenance_date = self.maintenance_date + relativedelta(months=1)
        else:
            self.next_maintenance_date = None

    @property
    def status(self):
        if not self.next_calibration_date:
            return 'Unknown'

        today = datetime.utcnow().date()
        days_left = (self.next_calibration_date - today).days
        if days_left < 0:
            return 'Over Due'
        elif days_left <= 30:
            return 'Due Soon'
        else:
            return 'OK'

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "manufacturer": self.manufacturer,
            "model": self.model,
            "serial_number": self.serial_number,
            "new_id_number": self.new_id_number,
            "location": self.location,
            "calibration_frequency": self.calibration_frequency,
            "calibration_date": str(self.calibration_date) if self.calibration_date else None,
            "next_calibration_date": str(self.next_calibration_date) if self.next_calibration_date else None,
            "maintenance_frequency": self.maintenance_frequency,
            "maintenance_date": str(self.maintenance_date) if self.maintenance_date else None,
            "next_maintenance_date": str(self.next_maintenance_date) if self.next_maintenance_date else None,
            "description": self.description,
            "quantity": self.quantity,
            "created_at": self.created_at.isoformat(),
            "status": self.status
        }
    
    def __repr__(self):
        return f'<Equipment {self.name}>'
    
@event.listens_for(Equipment, 'before_insert')
def set_dates_before_insert(mapper, connection, target):
    target.set_next_calibration_date()
    target.set_next_maintenance_date()

@event.listens_for(Equipment, 'before_update')
def set_dates_before_update(mapper, connection, target):
    target.set_next_calibration_date()
    target.set_next_maintenance_date()