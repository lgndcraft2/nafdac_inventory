from flask import Flask, jsonify, request, session, render_template, redirect, url_for
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta, datetime
from flask_mail import Mail, Message
import os
from models import db, User, Equipment


app = Flask(__name__)
app.config['SECRET_KEY'] = 'findThisOutBitch'
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get("DATABASE_URL")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

mail = Mail(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"

@app.before_request
def make_session_permanent():
    session.permanent = True
    app.permanent_session_lifetime = timedelta(minutes=60)


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

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
        password_hash = data.get('password')

        if User.query.filter_by(username=username).first() or User.query.filter_by(email=email).first():
            return jsonify({"error": "Username or email already exists"}), 400

        hashed_password = generate_password_hash(password_hash)
        if(User.query.count() == 0):
            new_user = User(username=username, email=email, password_hash=hashed_password, roles='admin')
        new_user = User(username=username, email=email, password_hash=hashed_password, roles='user')
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

     # ✅ Convert calibration_date if provided
    cal_date = data.get('calibration_date')
    if cal_date:
        equipment.calibration_date = datetime.strptime(cal_date, "%Y-%m-%d").date()

    # ✅ Convert maintenance_date if provided
    mnt_date = data.get('maintenance_date')
    if mnt_date:
        equipment.maintenance_date = datetime.strptime(mnt_date, "%Y-%m-%d").date()

    equipment.set_next_calibration_date()
    equipment.set_next_maintenance_date()

    db.session.commit()
    return jsonify(equipment.to_dict())

@app.route('/api/delete/<int:equipment_id>', methods=['DELETE'])
@login_required
def delete_equipment(equipment_id):
    equipment = Equipment.query.get_or_404(equipment_id)
    db.session.delete(equipment)
    db.session.commit()
    return jsonify({"message": "Equipment deleted"}), 200

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

with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True)