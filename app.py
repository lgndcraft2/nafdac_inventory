from flask import Flask, jsonify, request, session, render_template, redirect, url_for
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta, datetime
from flask_mail import Mail, Message
import os
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
import atexit
from .models import db, User, Equipment, EquipmentParameter
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
uri = os.environ.get("DATABASE_URL", "sqlite:///default.db")
if uri.startswith("postgres://"):
    uri = uri.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = uri
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')  # your email
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')  # app password
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_USE_SSL'] = True

# app.config['SESSION_COOKIE_SECURE'] = True
# app.config['SESSION_COOKIE_HTTPONLY'] = True
# app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

app.permanent_session_lifetime = timedelta(minutes=60)

db.init_app(app)
migrate = Migrate(app, db)

#csrf = CSRFProtect(app)
#Talisman(app, force_https=True, strict_transport_security=True)

mail = Mail(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"

@app.before_request
def make_session_permanent():
    session.permanent = True


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

@app.context_processor
def inject_user():
    return dict(user=current_user)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/api/user')
@login_required
def get_current_user():
    user_data = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "roles": current_user.roles,
        "created_at": current_user.created_at.isoformat()
    }
    return jsonify(user_data)

@app.route('/register', methods=['GET', 'POST'])
def register():
    return render_template('register.html')

@app.route('/api/register', methods=['POST'])
def api_register():
    if request.method == 'POST':
        data = request.json
        username = data.get('username')
        email = data.get('email')
        unit = data.get('unit')
        branch = data.get('branch')
        password_hash = data.get('password')

        if User.query.filter_by(username=username).first() or User.query.filter_by(email=email).first():
            return jsonify({"error": "Username or email already exists"}), 400

        hashed_password = generate_password_hash(password_hash)
        if User.query.count() == 0:
            new_user = User(username=username, email=email, unit=unit, branch=branch, password_hash=hashed_password, roles='admin')
        else:
            new_user = User(username=username, email=email, unit=unit, branch=branch, password_hash=hashed_password, roles='user')
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User registered successfully"}), 201
    return jsonify({"error": "Invalid request method"}), 405

@app.route('/login', methods=['GET', 'POST'])
def login():
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def api_login():
    if request.method == 'POST':
        data = request.json
        username = data.get('login')
        password = data.get('password')

        if username:
            user = User.query.filter_by(username=username).first() or User.query.filter_by(email=username).first()
        else:
            return jsonify({"error": "Username or email required"}), 400
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return jsonify({"message": "Login successful"}), 200
        return jsonify({"error": "Invalid username or password"}), 401
    return jsonify({"error": "Invalid request method"}), 405

@app.route('/admin')
@login_required
def admin_page():
    if 'admin' not in current_user.roles:
        return redirect(url_for('dashboard'))
    return render_template('adminPage.html')

@app.route('/api/admin/users', methods=['GET'])
@login_required
def get_users():
    users = User.query.all()
    return jsonify([{
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "roles": user.roles,
        "created_at": user.created_at.isoformat()
    } for user in users])

@app.route('/api/admin/delete_user/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    if 'admin' != current_user.roles:
        return jsonify({"error": "Access denied"}), 403

    user = User.query.get_or_404(user_id)
    if user.id == current_user.id or user.roles == 'admin' or user.id == 1:
        return jsonify({"error": "You cannot delete your own account"}), 400

    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted"}), 200

@app.route('/api/equipments', methods=['GET'])
@login_required
def get_equipments():
    equipments = Equipment.query.all()
    return jsonify([eq.to_dict() for eq in equipments])

@app.route('/equipments/<int:equipment_id>', methods=['GET'])
@login_required
def equipment_page(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    return render_template('equipment.html', equipment=equipment)


@app.route('/api/add_equipments', methods=['POST'])
@login_required
def add_equipment():
    data = request.json
    parameters = data.get('parameters', [])
    
    calibration_date = (
        datetime.strptime(data.get('calibration_date'), "%Y-%m-%d").date()
        if data.get('calibration_date') else None
    )
    maintenance_date = (
        datetime.strptime(data.get('maintenance_date'), "%Y-%m-%d").date()
        if data.get('maintenance_date') else None
    )

    new_equipment = Equipment(
        name=data.get('name'),
        manufacturer=data.get('manufacturer'),
        model=data.get('model'),
        serial_number=data.get('serial_number'),
        new_id_number=data.get('new_id_number'),
        location=data.get('location'),
        calibration_frequency=data.get('calibration_frequency'),
        calibration_date=calibration_date,
        maintenance_frequency=data.get('maintenance_frequency'),
        maintenance_date=maintenance_date,
        description=data.get('description'),
        quantity=data.get('quantity', 1)
    )
    db.session.add(new_equipment)
    db.session.flush()  # Get ID before committing

    if parameters:
        for param in parameters:
            name = param.get('name')
            value = param.get('value')
            if name or value:
                new_parameters = EquipmentParameter(
                    equipment_id=new_equipment.id,
                    parameter_name=name,
                    parameter_value=value
                )
                db.session.add(new_parameters)
    db.session.commit()
    return jsonify(new_equipment.to_dict()), 201

@app.route('/addEquipment', methods=['GET', 'POST'])
@login_required
def add_equipment_page():
    return render_template('addEquipment.html')

@app.route('/updateEquipment/<int:equipment_id>', methods=['GET', 'POST'])
@login_required
def update_equipment_page(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    return render_template('updateEquipment.html', equipment=equipment)

@app.route('/api/updateEquipment/<int:equipment_id>', methods=['PUT'])
@login_required
def update_equipment(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    data = request.json

    equipment.name = data.get('name', equipment.name)
    equipment.manufacturer = data.get('manufacturer', equipment.manufacturer)
    equipment.model = data.get('model', equipment.model)
    equipment.serial_number = data.get('serial_number', equipment.serial_number)
    equipment.new_id_number = data.get('new_id_number', equipment.new_id_number)
    equipment.location = data.get('location', equipment.location)
    equipment.calibration_frequency = data.get('calibration_frequency', equipment.calibration_frequency)
    equipment.maintenance_frequency = data.get('maintenance_frequency', equipment.maintenance_frequency)
    equipment.description = data.get('description', equipment.description)
    equipment.quantity = data.get('quantity', equipment.quantity)

     #Convert calibration_date if provided
    cal_date = data.get('calibration_date')
    if cal_date:
        equipment.calibration_date = datetime.strptime(cal_date, "%Y-%m-%d").date()

    #Convert maintenance_date if provided
    mnt_date = data.get('maintenance_date')
    if mnt_date:
        equipment.maintenance_date = datetime.strptime(mnt_date, "%Y-%m-%d").date()

    equipment.set_next_calibration_date()
    equipment.set_next_maintenance_date()

    new_parameters = data.get('parameters', [])
    print(new_parameters)
    EquipmentParameter.query.filter_by(equipment_id=equipment.id).delete()
    db.session.flush()

    if new_parameters:
        for param in new_parameters:
            name = param.get('name')
            value = param.get('value')
            if name or value:
                new_params = EquipmentParameter(
                    equipment_id=equipment.id,
                    parameter_name=name,
                    parameter_value=value
                )
                db.session.add(new_params)

    db.session.commit()
    return jsonify(equipment.to_dict())

@app.route('/api/delete/<int:equipment_id>', methods=['DELETE'])
@login_required
def delete_equipment(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    equipmentParams = EquipmentParameter.query.filter_by(equipment_id=equipment.id).all()
    for param in equipmentParams:
        db.session.delete(param)
    db.session.delete(equipment)
    db.session.commit()
    return jsonify({"message": "Equipment deleted"}), 200

@app.route('/api/calibrate/<int:equipment_id>', methods=['PUT'])
@login_required
def calibrate_equipment(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    calibration_date = datetime.now().date().strftime("%Y-%m-%d")

    if calibration_date:
        equipment.calibration_date = datetime.strptime(calibration_date, "%Y-%m-%d").date()
        equipment.set_next_calibration_date()
        db.session.commit()
        return jsonify(equipment.to_dict()), 200
    return jsonify({"error": "Calibration date is required"}), 400

@app.route('/api/maintain/<int:equipment_id>', methods=['PUT'])
@login_required
def maintain_equipment(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    maintenance_date = datetime.now().date().strftime("%Y-%m-%d")

    if maintenance_date:
        equipment.maintenance_date = datetime.strptime(maintenance_date, "%Y-%m-%d").date()
        equipment.set_next_maintenance_date()
        db.session.commit()
        return jsonify(equipment.to_dict()), 200
    return jsonify({"error": "Maintenance date is required"}), 400

@app.route('/api/admin/update_role/<int:user_id>', methods=['PUT'])
@login_required
def update_user_role(user_id):
    if 'admin' != current_user.roles:
        return jsonify({"error": "Access denied"}), 403

    user = User.query.get_or_404(user_id)
    if user.id == current_user.id or user.id == 1:
        return jsonify({"error": "Access denied"}), 403
    data = request.get_json()
    new_role = data.get('role')

    if not new_role or new_role not in ['admin', 'user', 'hou']:
        return jsonify({"error": "Invalid role"}), 400

    user.roles = new_role
    db.session.commit()
    return jsonify({"message": f"User role updated to {new_role}"}), 200

@app.route('/api/check-id-uniqueness')
@login_required
def check_id_uniqueness():
    new_id = request.args.get('id')  # grab ?id=... from query string
    exclude_id = request.args.get('exclude', type=int)

    if not new_id:
        return jsonify({"error": "Missing ID parameter"}), 400

    # Start query
    query = Equipment.query.filter(Equipment.new_id_number == new_id)

    # Exclude current equipment if updating
    if exclude_id:
        query = query.filter(Equipment.id != exclude_id)

    exists = db.session.query(query.exists()).scalar()

    return jsonify({"isUnique": not exists})

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('home'))

def send_due_maintenance_notifications():
    with app.app_context():
        users = User.query.all()
        recipients = [user.email for user in users if user.roles == 'admin']
        today = datetime.utcnow().date()
        upcoming_date = today + timedelta(days=30)

        due_equipments = Equipment.query.filter(
            Equipment.next_maintenance_date != None,
            Equipment.next_maintenance_date <= upcoming_date
        ).all()

        due_equipments_cal = Equipment.query.filter(
            Equipment.next_calibration_date != None,
            Equipment.next_calibration_date <= upcoming_date
        ).all()

        
        if due_equipments:
            user = User.query.first()
            if not user:
                print("❌ No user found for sending notifications.")
                return
            
            equipment_list = "\n".join(
                [f"- {eq.name} (Next Maintenance: {eq.next_maintenance_date})" for eq in due_equipments]
            )

            msg = Message(
                subject="Upcoming Equipment Maintenance Notification",
                recipients=recipients,
                body=f"The following equipment are due for maintenance within the next 30 days:\n\n{equipment_list} \n\nPlease take the necessary actions."
            )
            try:
                mail.send(msg)
                print("✅ Maintenance notification sent.")
            except Exception as e:
                print("❌ Failed to send maintenance notification:", e)
        else:
            print("No equipment due for maintenance in the next 30 days.")
        
        if due_equipments_cal:
            user = User.query.first()
            if not user:
                print("❌ No user found for sending notifications.")
                return
           
            equipment_list_cal = "\n".join(
                [f"- {eq.name} (Next Calibration: {eq.next_calibration_date})" for eq in due_equipments_cal]
            )

            msg = Message(
                subject="Upcoming Equipment Calibration Notification",
                recipients=recipients,
                body=f"The following equipment are due for calibration within the next 30 days:\n\n{equipment_list_cal} \n\nPlease take the necessary actions."
            )
            try:
                mail.send(msg)
                print("✅ Calibration notification sent.")
            except Exception as e:
                print("❌ Failed to send calibration notification:", e)

if __name__ == "__main__":
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=send_due_maintenance_notifications, trigger="interval", seconds=10, max_instances=3, coalesce=True)
    #scheduler.start()
    atexit.register(lambda: scheduler.shutdown(wait=False))
    app.run(host="0.0.0.0", use_reloader=False, debug=False)