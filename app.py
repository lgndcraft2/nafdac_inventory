from flask import Flask, jsonify, request, session, render_template, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta, datetime
from flask_mail import Mail, Message
import os
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
import atexit
from models import db, User, Equipment, EquipmentParameter, Unit, Branch
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman
import logging
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from itsdangerous import URLSafeTimedSerializer

load_dotenv()


# Get the absolute path of the directory where this app.py file is located
basedir = os.path.abspath(os.path.dirname(__file__))

# Define the path for the instance folder to be inside your project
instance_path = os.path.join(basedir, 'instance')
# Ensure the instance folder exists, creating it if it doesn't
os.makedirs(instance_path, exist_ok=True)

app = Flask(__name__, instance_path=instance_path)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')

default_db_path = os.path.join(instance_path, 'default.db')
uri = os.environ.get("DATABASE_URL", f"sqlite:///{default_db_path}")
if uri.startswith("postgres://"):
    uri = uri.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = uri
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = os.environ.get('MAIL_PORT', 465)
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS')
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')  # your email
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')  # app password
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL')


app.config['SESSION_COOKIE_SECURE'] = True
app.config['PREFERRED_URL_SCHEME'] = 'https'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

app.permanent_session_lifetime = timedelta(minutes=60)

db.init_app(app)
migrate = Migrate(app, db)

csp = {
    'default-src': "'self'",
    'img-src': ["'self'", "data:"], # Allows images from your domain AND data: URLs
    'script-src': ["'self'", "'unsafe-inline'"], # Allows scripts from your domain AND inline scripts/handlers
    'style-src': ["'self'", "'unsafe-inline'"] # Allows styles from your domain AND inline styles
}

csrf = CSRFProtect(app)
Talisman(app, force_https=True, strict_transport_security=True, content_security_policy=csp)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["500 per day", "100 per hour"]
)

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
    units = Unit.query.all()
    branches = Branch.query.all()
    return render_template('register.html', units=units, branches=branches)

@app.route('/api/register', methods=['POST'])
@limiter.limit("5 per minute")
def api_register():
    if request.method == 'POST':
        data = request.json
        errors = []

        username = data.get('username')
        email = data.get('email')
        unit_id = data.get('unit')
        password_hash = data.get('password')

        if not username or len(username.strip()) < 3:
            errors.append("Username must be at least 3 characters long.")
        elif len(username) > 50:
            errors.append("Username must not exceed 50 characters.")

        if not email or "@" not in email or "." not in email:
            errors.append("Invalid email address.")
        elif len(email) > 100:
            errors.append("Email must not exceed 100 characters.")

        if not password_hash or len(password_hash) < 6:
            errors.append("Password must be at least 6 characters long.")

        if not unit_id or not isinstance(unit_id, int):
            errors.append("A valid unit must be selected.")

        if errors:
            return jsonify({"errors": errors}), 400

        if User.query.filter_by(username=username).first() or User.query.filter_by(email=email).first():
            return jsonify({"error": "Username or email already exists"}), 400

        hashed_password = generate_password_hash(password_hash)
        if User.query.count() == 0:
            new_user = User(username=username, email=email, unit_id=unit_id, password_hash=hashed_password, roles='admin')
        else:
            new_user = User(username=username, email=email, unit_id=unit_id, password_hash=hashed_password, roles='user')
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User registered successfully"}), 201
    return jsonify({"error": "Invalid request method"}), 405

@app.route('/login', methods=['GET', 'POST'])
def login():
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")
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

@app.route('/create-branch', methods=['GET', 'POST'])
def setup_branch():
    if request.method == 'POST':
        correct_password = os.environ.get('SETUP_PASSWORD')
        submitted_password = request.form.get('password')
        if submitted_password != correct_password:
            flash('Incorrect setup password.', 'error')
            return redirect(url_for('setup_branch'))
        
        branch_name = request.form.get('branch_name')
        branch_adress = request.form.get('branch_address')
        unit_name = request.form.get('unit_name')
        existing_branch_id = request.form.get('existing_branch')

        if not unit_name:
            flash('Unit name is required.', 'error')
            return redirect(url_for('setup_branch'))
        try:
            target_branch_id = int(existing_branch_id) if existing_branch_id else None
            if existing_branch_id:
                branch = Branch.query.get(target_branch_id)
                if not branch:
                    flash('Selected branch does not exist.', 'error')
                    return redirect(url_for('setup_branch'))
                flash('Unit added to existing branch.', 'success')
            else:
                if not branch_name or not branch_adress:
                    flash('Branch name and address are required for new branches.', 'error')
                    return redirect(url_for('setup_branch'))
                branch = Branch(name=branch_name, address=branch_adress)
                db.session.add(branch)
                db.session.flush()  # Get branch.id before commit
                target_branch_id = branch.id
            
            new_unit = Unit(name=unit_name, branch_id=target_branch_id)
            db.session.add(new_unit)

            db.session.commit()
        
        except Exception as e:
            db.session.rollback()
            flash('An error occurred. Please try again.', 'error')
            print(e)
        return redirect(url_for('setup_branch'))
    branches = Branch.query.order_by(Branch.name).all()
    return render_template('setup.html', branches=branches)

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

@app.route('/profile', methods=['GET'])
@login_required
def profile():
    user = current_user
    return render_template('profilePage.html', user=user)


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
    errors = {}

    # --- 1. Validate Presence and Type ---
    name = data.get('name')
    unit_id = data.get('unit_id')
    manufacturer = data.get('manufacturer')
    model = data.get('model')
    new_id_number = data.get('new_id_number')
    quantity = data.get('quantity', 1) # Default to 1 if not provided
    calibration_date_str = data.get('calibration_date')
    maintenance_date_str = data.get('maintenance_date')

    if not name or len(name.strip()) < 3:
        errors['name'] = 'Equipment name is required and must be at least 3 characters.'

    if not manufacturer or len(manufacturer.strip()) < 2:
        errors['manufacturer'] = 'Manufacturer is required and must be at least 2 characters.'

    if not model or len(model.strip()) < 1:
        errors['model'] = 'Model is required.'

    if not new_id_number or len(new_id_number.strip()) < 1:
        errors['new_id_number'] = 'A unique ID Number is required.'

    # --- 2. Validate Foreign Keys and Uniqueness ---
    if unit_id:
        if not isinstance(unit_id, int) or not Unit.query.get(unit_id):
            errors['unit_id'] = 'A valid unit must be selected.'
    else:
        errors['unit_id'] = 'Unit is a required field.'

    if new_id_number and Equipment.query.filter_by(new_id_number=new_id_number.strip()).first():
        errors['new_id_number'] = f"An equipment with the ID '{new_id_number}' already exists."

    # --- 3. Validate Dates and Numbers ---
    calibration_date = None
    if calibration_date_str:
        try:
            calibration_date = datetime.strptime(calibration_date_str, "%Y-%m-%d").date()
        except ValueError:
            errors['calibration_date'] = 'Invalid date format. Please use YYYY-MM-DD.'
    else:
        errors['calibration_date'] = 'Calibration date is required.'

    maintenance_date = None
    if maintenance_date_str:
        try:
            maintenance_date = datetime.strptime(maintenance_date_str, "%Y-%m-%d").date()
        except ValueError:
            errors['maintenance_date'] = 'Invalid date format. Please use YYYY-MM-DD.'
    else:
        errors['maintenance_date'] = 'Maintenance date is required.'
        
    try:
        quantity = int(quantity)
        if quantity < 1:
            errors['quantity'] = 'Quantity must be at least 1.'
    except (ValueError, TypeError):
        errors['quantity'] = 'Quantity must be a valid number.'


    # --- 4. Return Errors if Any Exist ---
    if errors:
        return jsonify({"message": "Validation failed", "errors": errors}), 400

    # --- 5. Create Equipment if All Checks Pass ---
    new_equipment = Equipment(
        name=name.strip(),
        manufacturer=manufacturer.strip(),
        model=model.strip(),
        serial_number=data.get('serial_number', '').strip(),
        new_id_number=new_id_number.strip(),
        unit_id=unit_id,
        calibration_frequency=data.get('calibration_frequency'),
        calibration_date=calibration_date,
        maintenance_frequency=data.get('maintenance_frequency'),
        maintenance_date=maintenance_date,
        description=data.get('description', '').strip(),
        quantity=quantity
    )
    db.session.add(new_equipment)
    db.session.flush()  # Get the new_equipment.id before we commit

    parameters = data.get('parameters', [])
    if parameters:
        for param in parameters:
            param_name = param.get('name')
            param_value = param.get('value')
            if param_name and param_value: # Only add if both name and value are present
                new_parameter = EquipmentParameter(
                    equipment_id=new_equipment.id,
                    parameter_name=param_name.strip(),
                    parameter_value=param_value.strip()
                )
                db.session.add(new_parameter)

    db.session.commit()
    return jsonify(new_equipment.to_dict()), 201

@app.route('/addEquipment', methods=['GET', 'POST'])
@login_required
def add_equipment_page():
    branches = Branch.query.order_by(Branch.name).all()
    units = Unit.query.order_by(Unit.name).all()
    return render_template('addEquipment.html', branches=branches, units=units)

@app.route('/updateEquipment/<int:equipment_id>', methods=['GET'])
@login_required
def update_equipment_page(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    branches = Branch.query.order_by(Branch.name).all()
    units = Unit.query.order_by(Unit.name).all()
    return render_template('updateEquipment.html', equipment=equipment, branches=branches, units=units)

@app.route('/api/updateEquipment/<int:equipment_id>', methods=['PUT'])
@login_required
def update_equipment(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    data = request.json
    errors = {}

    # --- 1. Get new data from the request ---
    name = data.get('name')
    unit_id = data.get('unit_id')
    manufacturer = data.get('manufacturer')
    model = data.get('model')
    new_id_number = data.get('new_id_number')
    quantity = data.get('quantity')
    calibration_date_str = data.get('calibration_date')
    maintenance_date_str = data.get('maintenance_date')

    # --- 2. Perform Validation ---
    if name is not None and len(name.strip()) < 3:
        errors['name'] = 'Equipment name must be at least 3 characters.'

    if new_id_number:
        # CRITICAL: Check for uniqueness, excluding the current equipment
        existing_eq = Equipment.query.filter(
            Equipment.new_id_number == new_id_number.strip(),
            Equipment.id != equipment_id  # The key difference is here!
        ).first()
        if existing_eq:
            errors['new_id_number'] = f"The ID '{new_id_number}' is already in use by another equipment."

    if unit_id and not Unit.query.get(unit_id):
        errors['unit_id'] = 'The selected unit does not exist.'

    calibration_date = None
    if calibration_date_str:
        try:
            calibration_date = datetime.strptime(calibration_date_str, "%Y-%m-%d").date()
        except ValueError:
            errors['calibration_date'] = 'Invalid date format. Please use YYYY-MM-DD.'
            
    maintenance_date = None
    if maintenance_date_str:
        try:
            maintenance_date = datetime.strptime(maintenance_date_str, "%Y-%m-%d").date()
        except ValueError:
            errors['maintenance_date'] = 'Invalid date format. Please use YYYY-MM-DD.'

    if quantity is not None:
        try:
            quantity = int(quantity)
            if quantity < 1:
                errors['quantity'] = 'Quantity must be at least 1.'
        except (ValueError, TypeError):
            errors['quantity'] = 'Quantity must be a valid number.'
            
    # --- 3. Return errors if validation failed ---
    if errors:
        return jsonify({"message": "Validation failed", "errors": errors}), 400

    # --- 4. Update the equipment object if validation passes ---
    equipment.name = name.strip() if name is not None else equipment.name
    equipment.manufacturer = data.get('manufacturer', equipment.manufacturer).strip()
    equipment.model = data.get('model', equipment.model).strip()
    equipment.serial_number = data.get('serial_number', equipment.serial_number).strip()
    equipment.new_id_number = new_id_number.strip() if new_id_number is not None else equipment.new_id_number
    equipment.unit_id = unit_id if unit_id is not None else equipment.unit_id
    equipment.calibration_frequency = data.get('calibration_frequency', equipment.calibration_frequency)
    equipment.maintenance_frequency = data.get('maintenance_frequency', equipment.maintenance_frequency)
    equipment.description = data.get('description', equipment.description).strip()
    equipment.quantity = quantity if quantity is not None else equipment.quantity
    
    if calibration_date:
        equipment.calibration_date = calibration_date
    if maintenance_date:
        equipment.maintenance_date = maintenance_date

    # Delete old parameters and add new ones
    EquipmentParameter.query.filter_by(equipment_id=equipment.id).delete()
    new_parameters = data.get('parameters', [])
    if new_parameters:
        for param in new_parameters:
            if param.get('name') and param.get('value'):
                db.session.add(EquipmentParameter(
                    equipment_id=equipment.id,
                    parameter_name=param['name'].strip(),
                    parameter_value=param['value'].strip()
                ))

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

# In app.py, REPLACE your existing /api/admin/update_role/<int:user_id> route with this one

@app.route('/api/admin/update_role/<int:user_id>', methods=['PUT'])
@login_required
def update_user_role(user_id):
    if 'admin' not in current_user.roles:
        return jsonify({"error": "Access denied"}), 403

    user = User.query.get_or_404(user_id)
    if user.id == current_user.id or user.id == 1: # Protect admin and self
        return jsonify({"error": "This user's role cannot be changed."}), 403

    data = request.get_json()
    new_role = data.get('role')
    unit_id = data.get('unit_id')

    if not new_role or new_role not in ['admin', 'user', 'hou']:
        return jsonify({"error": "Invalid role specified"}), 400

    try:
        # --- Logic to unassign the user from being an HOU if they were one ---
        old_unit = Unit.query.filter_by(hou_id=user.id).first()
        if old_unit:
            old_unit.hou_id = None
            db.session.add(old_unit)

        # --- Main Logic ---
        if new_role == 'hou':
            if not unit_id:
                return jsonify({"error": "A unit must be selected to assign an HOU."}), 400
            
            target_unit = Unit.query.get(unit_id)
            if not target_unit:
                return jsonify({"error": "Selected unit not found."}), 404

            # CRITICAL: Check if the target unit already has an HOU
            if target_unit.hou_id is not None and target_unit.hou_id != user.id:
                return jsonify({"error": f"Unit '{target_unit.name}' already has an HOU assigned."}), 409 # 409 is "Conflict"

            target_unit.hou_id = user.id
            user.roles = 'hou'
            db.session.add(target_unit)
        else:
            # For 'admin' or 'user', just set the role
            user.roles = new_role

        db.session.add(user)
        db.session.commit()
        return jsonify({"message": f"User '{user.username}' role updated successfully."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

@app.route('/api/units')
@login_required
def get_units():
    if 'admin' not in current_user.roles:
        return jsonify({"error": "Access denied"}), 403
    
    units = Unit.query.order_by(Unit.name).all()
    # We also include which user (if any) is the HOU for each unit
    return jsonify([{
        'id': unit.id,
        'name': unit.name,
        'branch_name': unit.branch.name,
        'hou_id': unit.hou_id
    } for unit in units])

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
        today = datetime.utcnow().date()
        upcoming_date = today + timedelta(days=30)

        # 1. Get all admins' emails once. They will be CC'd on all notifications.
        admin_emails = [user.email for user in User.query.filter_by(roles='admin').all()]
        if not admin_emails:
            print("No admin users found to receive notifications.")

        # 2. Find all equipment due for maintenance or calibration
        due_maintenance = Equipment.query.filter(
            Equipment.next_maintenance_date.isnot(None),
            Equipment.next_maintenance_date <= upcoming_date
        ).all()

        due_calibration = Equipment.query.filter(
            Equipment.next_calibration_date.isnot(None),
            Equipment.next_calibration_date <= upcoming_date
        ).all()
        print(f"Found {len(due_maintenance)} equipment due for maintenance and {len(due_calibration)} due for calibration.")

        # 3. Group equipment by their unit's HOU
        notifications = {} # Key: hou_email, Value: {'maintenance': [], 'calibration': []}

        for eq in due_maintenance:
            if eq.unit and eq.unit.hou and eq.unit.hou.email:
                hou_email = eq.unit.hou.email
                if hou_email not in notifications:
                    notifications[hou_email] = {'maintenance': [], 'calibration': []}
                notifications[hou_email]['maintenance'].append(eq)

        for eq in due_calibration:
            if eq.unit and eq.unit.hou and eq.unit.hou.email:
                hou_email = eq.unit.hou.email
                if hou_email not in notifications:
                    notifications[hou_email] = {'maintenance': [], 'calibration': []}
                notifications[hou_email]['calibration'].append(eq)
        
        print(f"Prepared notifications for {len(notifications)} HOUs.")
        # 4. Send the targeted emails
        if not notifications:
            print("No equipment with assigned HOUs is due for service.")
            return

        for hou_email, tasks in notifications.items():
            maintenance_list = tasks['maintenance']
            calibration_list = tasks['calibration']
            
            print(f"Preparing email for HOU: {hou_email} with {len(maintenance_list)} maintenance and {len(calibration_list)} calibration tasks.")
            # Construct the email body
            body_parts = []
            subject = "Equipment Service Notification" # Generic subject

            if maintenance_list:
                subject = "Upcoming Equipment Maintenance"
                m_list_str = "\n".join([f"- {eq.name} (ID: {eq.new_id_number}), Due: {eq.next_maintenance_date}" for eq in maintenance_list])
                body_parts.append(f"The following equipment assigned to your unit is due for MAINTENANCE:\n{m_list_str}")

            if calibration_list:
                subject = "Upcoming Equipment Calibration"
                c_list_str = "\n".join([f"- {eq.name} (ID: {eq.new_id_number}), Due: {eq.next_calibration_date}" for eq in calibration_list])
                body_parts.append(f"The following equipment assigned to your unit is due for CALIBRATION:\n{c_list_str}")
            
            if maintenance_list and calibration_list:
                subject = "Upcoming Equipment Maintenance & Calibration"

            final_body = "\n\n".join(body_parts)
            final_body += "\n\nPlease take the necessary actions."

            print(f"Final email body for {hou_email}:\n{final_body}")
            # The recipients are the HOU and all admins
            recipients = list(set([hou_email] + admin_emails))
            print(recipients)

            msg = Message(
                subject=subject,
                recipients=recipients,
                body=final_body
            )
            try:
                mail.send(msg)
                print(f"✅ Notification sent to {hou_email} (and admins) for {len(maintenance_list)} maintenance and {len(calibration_list)} calibration tasks.")
            except Exception as e:
                print(f"❌ Failed to send notification to {hou_email}: {e}")

def get_reset_token(email):
    serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])
    return serializer.dumps(email, salt='password-reset-salt')

def verify_reset_token(token, expiration=3600):
    serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])
    try:
        email = serializer.loads(token, salt='password-reset-salt', max_age=expiration)
        return email
    except:
        return None

@app.route('/forgot-password', methods=['GET'])
def forgot_password():
    return render_template('forgot_password.html')

@app.route('/api/forgot-password', methods=['POST'])
@limiter.limit("5 per hour")
def api_forgot_password():
    data = request.get_json()
    email = data.get('email')
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Email not found"}), 404
    
    token = get_reset_token(email)
    reset_url = url_for('reset_password', token=token, _external=True)
    
    msg = Message('Password Reset Request',
                recipients=[email],
                body=f'''To reset your password, visit the following link:
{reset_url}

If you did not make this request, simply ignore this email.
''')
    
    try:
        mail.send(msg)
        return jsonify({"message": "Reset email sent"}), 200
    except Exception as e:
        print(f"Error sending email: {e}")
        return jsonify({"error": "Error sending email"}), 500

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    email = verify_reset_token(token)
    if not email:
        flash('Invalid or expired reset token', 'error')
        return redirect(url_for('forgot_password'))
    
    if request.method == 'POST':
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        password = request.json.get('password')
        if not password or len(password) < 6:
            return jsonify({"error": "Invalid password"}), 400
        
        user.set_password(password)
        db.session.commit()
        return jsonify({"message": "Password updated successfully"}), 200
    
    return render_template('reset_password.html')