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
    roles = db.Column(db.String(50), nullable=False)  # e.g., 'admin', 'user', 'HOU's
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    unit_id = db.Column(db.Integer, db.ForeignKey('unit.id'))

    unit = db.relationship('Unit', foreign_keys=[unit_id], backref='users')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

class Unit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branch.id'), nullable=False)
    #hou_id = db.Column(db.Integer, db.ForeignKey('user.id'))

    #hou = db.relationship('User', foreign_keys=[hou_id], backref=db.backref('headed_units', lazy=True))

    def __repr__(self):
        return f'<Unit {self.name}>'

class Branch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    address = db.Column(db.String(150), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    units = db.relationship('Unit', backref='branch', lazy=True)

class Equipment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    manufacturer = db.Column(db.String(150))
    model = db.Column(db.String(150))
    serial_number = db.Column(db.String(150))
    new_id_number = db.Column(db.String(150), unique=True)

    unit_id = db.Column(db.Integer, db.ForeignKey('unit.id'), nullable=False)
    unit = db.relationship('Unit', backref=db.backref('equipments', lazy=True))

    calibration_frequency = db.Column(db.String(100), default='Annual')
    calibration_date = db.Column(db.Date)
    next_calibration_date = db.Column(db.Date)

    maintenance_frequency = db.Column(db.String(100), default='Annual')
    maintenance_date = db.Column(db.Date)
    next_maintenance_date = db.Column(db.Date)

    description = db.Column(db.String(500))
    quantity = db.Column(db.Integer, default=1)
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
    def cal_status(self):
        if not self.next_calibration_date:
            return 'Unknown C'

        today = datetime.utcnow().date()
        days_left = (self.next_calibration_date - today).days
        if days_left < 0:
            return 'Over Due'
        elif days_left <= 30:
            return 'Due Soon'
        else:
            return 'OK'

    @property
    def mnt_status(self):
        if not self.next_maintenance_date:
            return 'Unknown M'
        today = datetime.utcnow().date()
        days_left = (self.next_maintenance_date - today).days
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
            "unit_id": self.unit.id,
            "unit_name": self.unit.name,
            "branch_id": self.unit.branch.id,
            "branch_name": self.unit.branch.name,
            "calibration_frequency": self.calibration_frequency,
            "calibration_date": str(self.calibration_date) if self.calibration_date else None,
            "next_calibration_date": str(self.next_calibration_date) if self.next_calibration_date else None,
            "maintenance_frequency": self.maintenance_frequency,
            "maintenance_date": str(self.maintenance_date) if self.maintenance_date else None,
            "next_maintenance_date": str(self.next_maintenance_date) if self.next_maintenance_date else None,
            "description": self.description,
            "quantity": self.quantity,
            "created_at": self.created_at.isoformat(),
            "cal_status": self.cal_status,
            "mnt_status": self.mnt_status,
            "parameters": [
            {"name": p.parameter_name, "value": p.parameter_value}
            for p in self.parameters
        ]
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


class EquipmentParameter(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipment.id'), nullable=False)
    parameter_name = db.Column(db.String(150), nullable=False)
    parameter_value = db.Column(db.String(150), nullable=False)

    equipment = db.relationship('Equipment', backref=db.backref('parameters', lazy=True))

    def __repr__(self):
        return f'<EquipmentParameter {self.parameter_name}: {self.parameter_value}>'
