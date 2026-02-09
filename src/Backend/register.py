from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient 
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import bcrypt
from datetime import timedelta as td
from datetime import timedelta
import os
from bson import ObjectId
from datetime import datetime, date
from datetime import datetime as dt
from pymongo.errors import DuplicateKeyError
from io import StringIO
import csv
from flask import make_response



import calendar

# --- App Setup ---
app = Flask(__name__)
CORS(app)

# --- JWT CONFIG ---
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
jwt = JWTManager(app)

# --- Mongo Setup ---
client = MongoClient("mongodb+srv://l3x3yy:itm5CMW2qJ8IW4N7@licenta.zsmwltq.mongodb.net/")
db = client["emergency_center"]
users = db["users"]               
centers = db["centers"]         
memberships = db["memberships"]  
shifts = db["shifts"]            
messages = db["messages"]        
support = db["support"]


# Indexes
support.create_index([("resolved", 1), ("created_at", 1)])
support.create_index([("status", 1)])
users.create_index("email", unique=True)
memberships.create_index([("center_id", 1), ("user_id", 1)], unique=True)
shifts.create_index([("center_id", 1), ("date", 1)], unique=True)  # 1 medic per day per center
messages.create_index([("to", 1), ("conversation_id", 1), ("timestamp", 1)])
shifts.create_index([("date", 1), ("medic_id", 1)], unique=True)  # prevent cross-center double booking per day
shifts.create_index([("medic_id", 1), ("date", 1)])  # speeds up /my/schedule
memberships.create_index(
    [("user_id", 1), ("role", 1)],  
    unique=True,
    partialFilterExpression={"role": "lead"}  # only enforce uniqueness for role=lead
)
busy_days = db["busy_days"]
busy_days.create_index([("medic_id", 1), ("date", 1)], unique=True)   # uniqueness



#date helpers
DATE_FMT = "%Y-%m-%d"  # store as "YYYY-MM-DD"
def _is_past(date_str: str) -> bool:
    """Return True if date_str (YYYY-MM-DD) is strictly before today (server local date)."""
    try:
        d = datetime.strptime(date_str, DATE_FMT).date()
    except Exception:
        return True  # treat invalid as past to be safe
    return d < date.today()


def _parse_date_str(d: str) -> str:
    # Validates & normalizes to YYYY-MM-DD
    try:
        return datetime.strptime(d, DATE_FMT).date().strftime(DATE_FMT)
    except Exception:
        raise ValueError("Invalid date format, expected YYYY-MM-DD")

def _month_bounds(month_str: str):
    # month_str "YYYY-MM"
    try:
        y, m = map(int, month_str.split("-"))
        first = date(y, m, 1)
        last_day = calendar.monthrange(y, m)[1]
        last = date(y, m, last_day)
        return first, last
    except Exception:
        raise ValueError("Invalid month format, expected YYYY-MM")
    


def _get_current_user():
    """Fetch the user document for the current JWT subject, or None."""
    try:
        uid = get_jwt_identity()
        return users.find_one({"_id": ObjectId(uid)})
    except Exception:
        return None

def admin_required(fn):
    """Decorator: require a valid JWT AND user.global_role == 'admin'."""
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        me = _get_current_user()
        if not me:
            return jsonify({"error": "Neautorizat"}), 401
        if me.get("global_role") != "admin":
            return jsonify({"error": "Neautorizat (admin only)"}), 403
        if me.get("status") != "approved":
            return jsonify({"error": "Neautorizat (admin not approved)"}), 403
        return fn(*args, **kwargs)
    return wrapper

def require_member_or_admin(fn):
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(center_id, *args, **kwargs):
        me_id = get_jwt_identity()
        me = users.find_one({"_id": ObjectId(me_id)})
        if me and me.get("global_role") == "admin":
            return fn(center_id, *args, **kwargs)
        m = db.memberships.find_one({"center_id": ObjectId(center_id), "user_id": ObjectId(me_id)})
        if not m:
            return jsonify({"error": "Neautorizat (members only)"}), 403
        return fn(center_id, *args, **kwargs)
    return wrapper

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    #username = data.get("username")
    first_name = data.get("first_name")
    last_name  = data.get("last_name")
    email = data.get("email")
    password = data.get("password")
    password_recheck = data.get("passwordRecheck")

    # --- Validation ---
    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "Completeaza toate campurile"}), 400

    if password != password_recheck:
        return jsonify({"error": "Parolele nu se potrivesc"}), 400

    # Check if email already exists
    if users.find_one({"email": email}):
        return jsonify({"error": "Email deja inregistrat"}), 400

    # --- Hash Password ---
    hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    # --- Insert User ---
    new_user = {
        #"username": username,
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "password_hash": hashed_pw,
        "status": "pending",   # requires admin approval
        "global_role": "medic" # default role
    }
    users.insert_one(new_user)

    return jsonify({"message": "Registration successful, awaiting approval"})

@app.post("/login")
def login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email si parola campuri obligatorii"}), 400

    user = users.find_one({"email": email})
    if not user:
        return jsonify({"error": "Email sau parola incorecte"}), 401

    # Check password
    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        return jsonify({"error": "Email sau parola incorecte"}), 401

    # Optional gate: block login until approved
    if user.get("status") != "approved":
        return jsonify({"error": "Contul nu a fost aprobat"}), 403

    access_token = create_access_token(identity=str(user["_id"]))

    return jsonify({
        "access_token": access_token,
        "user": {
            "id": str(user["_id"]),
            #"username": user.get("username"),
            "first_name": user.get("first_name"),
            "last_name": user.get("last_name"),
            "email": user.get("email"),
            "global_role": user.get("global_role", "medic"),
            "status": user.get("status", "pending"),
        }
    })


@app.get("/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()  # string _id from the JWT
    try:
        oid = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid token subject"}), 400

    user = users.find_one({"_id": oid}, {"password_hash": 0})
    if not user:
        return jsonify({"error": "Not found"}), 404

    return jsonify({
        "id": str(user["_id"]),
        #"username": user.get("username"),
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "email": user.get("email"),
        "global_role": user.get("global_role", "medic"),
        "status": user.get("status", "pending"),
        "phone": user.get("phone")
    })

# ---------------- ADMIN: LIST PENDING ----------------
@app.get("/admin/users")
@admin_required
def list_users():
    docs = []
    for u in users.find({}, {"password": 0, "password_hash": 0}):
        docs.append({
            "id": str(u["_id"]), 
            #"username": u.get("username"),
            "first_name": u.get("first_name"),
            "last_name": u.get("last_name"),
            "email": u.get("email"), "status": u.get("status"),
            "global_role": u.get("global_role", "medic")
        })
    return {"users": docs}
    


@app.get("/admin/pending")
@admin_required
def list_pending():
    docs = []
    for u in users.find({"status": "pending"}):
        docs.append({"id": str(u["_id"]), 
        "first_name": u.get("first_name"),
        "last_name": u.get("last_name"),
        #"username": u.get("username"),
        "email": u.get("email")})
    return jsonify({"pending": docs})

@app.patch("/admin/approve/<user_id>")
@admin_required
def approve_user(user_id):
    res = users.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": "approved"}})
    if res.matched_count == 0:
        return jsonify({"error": "User nu a fost gasit"}), 404
    return jsonify({"message": "User aprobat"})

@app.patch("/admin/reject/<user_id>")
@admin_required
def reject_user(user_id):
    res = users.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": "rejected"}})
    if res.matched_count == 0:
        return jsonify({"error": "User nu a fost gasit"}), 404
    return jsonify({"message": "User respins"})


# centers
@app.post("/centers")
@admin_required
def create_center():
    data = request.get_json() or {}
    if not data.get("name"):
        return {"error":"Nume obligatoriu"}, 400
    res = db.centers.insert_one({"name": data["name"], "location": data.get("location")})
    return {"id": str(res.inserted_id)}, 201

@app.get("/centers")
@jwt_required()
def list_centers():
    me = users.find_one({"_id": ObjectId(get_jwt_identity())})
    if me.get("global_role") == "admin":
        centers = list(db.centers.find())
    else:
        cids = db.memberships.find({"user_id": me["_id"]}).distinct("center_id")
        centers = list(db.centers.find({"_id": {"$in": cids}}))
    for c in centers: c["_id"] = str(c["_id"])
    return {"centers": centers}

@app.patch("/centers/<center_id>")
@admin_required
def update_center(center_id):
    res = db.centers.update_one({"_id": ObjectId(center_id)}, {"$set": request.get_json() or {}})
    if res.matched_count == 0: return {"error":"not found"}, 404
    return {"message":"updated"}

@app.delete("/centers/<center_id>")
@admin_required
def delete_center(center_id):
    db.centers.delete_one({"_id": ObjectId(center_id)})
    db.memberships.delete_many({"center_id": ObjectId(center_id)})
    return {"message":"deleted"}

#memberships
# helper to require the caller is lead for that center (or admin)
def require_lead_or_admin(fn):
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(center_id, *args, **kwargs):
        me_id = get_jwt_identity()
        me = users.find_one({"_id": ObjectId(me_id)})
        if me and me.get("global_role") == "admin":  # admins always allowed
            return fn(center_id, *args, **kwargs)
        # otherwise must be lead of that center
        m = db.memberships.find_one({"center_id": ObjectId(center_id), "user_id": ObjectId(me_id), "role":"lead"})
        if not m:
            return {"error":"Neautorizat (doar coordonator)"}, 403
        return fn(center_id, *args, **kwargs)
    return wrapper

@app.get("/centers/<center_id>/members")
@jwt_required()
def list_members(center_id):
    center_oid = ObjectId(center_id)
    pipeline = [
        {"$match": {"center_id": center_oid}},
        {"$lookup": {"from":"users","localField":"user_id","foreignField":"_id","as":"u"}},
        {"$unwind":"$u"},
        {"$project":{
            "_id":0,
            "user_id":{"$toString":"$u._id"},
            "first_name":"$u.first_name",
            "last_name":"$u.last_name",
            "email":"$u.email",
            "phone":"$u.phone",              
            "role":"$role"
        }}
    ]
    return {"members": list(db.memberships.aggregate(pipeline))}


@app.post("/centers/<center_id>/members")
@require_lead_or_admin
def add_member(center_id):
    data = request.get_json() or {}
    uid = data.get("user_id")
    if not uid:
        return {"error": "user_id required"}, 400

    u = users.find_one({"_id": ObjectId(uid), "status": "approved"})
    if not u:
        return {"error": "Utilizatorul nu exista sau nu a fost aprobat"}, 404

    center_oid = ObjectId(center_id)
    user_oid = ObjectId(uid)

    existing = db.memberships.find_one({"center_id": center_oid, "user_id": user_oid})
    if existing:
        return {"error": "Utilizatorul este deja membru al acestui centru"}, 409

    db.memberships.insert_one({
        "center_id": center_oid,
        "user_id": user_oid,
        "role": "medic"
    })
    return {"message": "medic adaugat"}, 201


@app.patch("/centers/<center_id>/assign-lead")
@admin_required
def assign_lead(center_id):
    payload = request.get_json() or {}
    uid = payload.get("user_id")
    if not uid: return {"error":"user_id required"}, 400
    center_oid = ObjectId(center_id); user_oid = ObjectId(uid)

    # hard rule: a medic can be lead of only ONE center globally
    existing_elsewhere = db.memberships.find_one({
        "user_id": user_oid,
        "role": "lead",
        "center_id": {"$ne": center_oid}
    })
    if existing_elsewhere:
        return {"error": "Medicul este deja coordonator al altui centru"}, 409

    try:
        # Demote any current lead(s) in THIS center only
        db.memberships.update_many({"center_id": center_oid, "role":"lead"}, {"$set":{"role":"medic"}})

        # Upsert membership for this user as lead in THIS center
        db.memberships.update_one(
            {"center_id": center_oid, "user_id": user_oid},
            {"$set":{"role":"lead"}},
            upsert=True
        )
    except DuplicateKeyError:
        # Unique partial index (user_id, role=lead) tripped — somebody else holds them as lead
        return {"error": "Medicul este deja coordonator al altui centru"}, 409

    return {"message":"lead assigned"}

@app.delete("/centers/<center_id>/members/<user_id>")
@require_lead_or_admin
def remove_member(center_id, user_id):
    center_oid = ObjectId(center_id)
    user_oid = ObjectId(user_id)

    # 1. remove membership
    res = db.memberships.delete_one({"center_id": center_oid, "user_id": user_oid})
    if res.deleted_count == 0:
        return {"error": "not found"}, 404

    # 2. remove FUTURE shifts for this user at this center
    today_str = date.today().strftime(DATE_FMT)
    deleted = db.shifts.delete_many({
        "center_id": center_oid,
        "medic_id": user_oid,
        "date": {"$gt": today_str}   # strictly in the future
    })

    return {
        "message": "member removed",
        "future_shifts_removed": deleted.deleted_count
    }


#messages

def _send_system_assignment_message(medic_id: str, center_name: str, date_str: str):
    # One system thread per user
    msg = {
        "conversation_id": f"system_{medic_id}",
        "from": "system",
        "to": ObjectId(medic_id),
        "content": f"Ai fost programat in data de {date_str} la {center_name}.",
        "timestamp": dt.utcnow(),
        "system": True
    }
    messages.insert_one(msg)

#schedule
@app.get("/centers/<center_id>/schedule")
@require_member_or_admin
def get_schedule(center_id):
    month = request.args.get("month")
    if not month:
        return {"error": "month query param required, e.g., ?month=2025-01"}, 400

    try:
        first, last = _month_bounds(month)  # returns date objects
    except ValueError as e:
        return {"error": str(e)}, 400

    center_oid = ObjectId(center_id)

    # Pull shifts in month + join user to keep names even after membership removal
    pipeline = [
        {"$match": {
            "center_id": center_oid,
            "date": {"$gte": first.strftime(DATE_FMT), "$lte": last.strftime(DATE_FMT)}
        }},
        {"$lookup": {
            "from": "users",
            "localField": "medic_id",
            "foreignField": "_id",
            "as": "u"
        }},
        {"$unwind": {"path": "$u", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "date": 1,
            "medic_id": {"$toString": "$medic_id"},
            "medic_first_name": "$u.first_name",
            "medic_last_name": "$u.last_name",
            "medic_email": "$u.email"
        }}
    ]
    docs = list(shifts.aggregate(pipeline))
    assigned = {d["date"]: d for d in docs}

    out = []
    cur = first
    while cur <= last:
        dstr = cur.strftime(DATE_FMT)
        info = assigned.get(dstr)
        out.append({
            "date": dstr,
            "assigned": bool(info),
            "medic_id": info.get("medic_id") if info else None,
            "medic_first_name": info.get("medic_first_name") if info else None,
            "medic_last_name": info.get("medic_last_name") if info else None,
            "medic_email": info.get("medic_email") if info else None,
        })
        cur += td(days=1)

    return {"center_id": center_id, "month": month, "days": out}


@app.post("/centers/<center_id>/schedule")
@require_lead_or_admin
def assign_shift(center_id):
    data = request.get_json() or {}
    medic_id = data.get("medic_id")
    date_str = data.get("date")  # "YYYY-MM-DD"
    if not medic_id or not date_str:
        return {"error": "medic_id and date required"}, 400

    try:
        date_str = _parse_date_str(date_str)
    except ValueError as e:
        return {"error": str(e)}, 400
    
     # 🚫 Disallow assigning past dates
    if _is_past(date_str):
        return {"error": "Cannot assign past dates"}, 400

    # Ensure medic is a member of this center
    if not memberships.find_one({"center_id": ObjectId(center_id), "user_id": ObjectId(medic_id)}):
        return {"error": "Medicul nu este membru al acestui centru"}, 400
        # Hard block: medic self-marked busy that day
    if busy_days.find_one({"medic_id": ObjectId(medic_id), "date": date_str}):
        return {"error": "Medicul este indisponibil in aceasta zi"}, 409

    doc = {
        "center_id": ObjectId(center_id),
        "date": date_str,
        "medic_id": ObjectId(medic_id),
        "created_at": dt.utcnow(),
        "assigned_by": ObjectId(get_jwt_identity())
    }

    try:
        shifts.insert_one(doc)  # unique indexes enforce both constraints
    except DuplicateKeyError as e:
        # which unique index? date+medic_id means double book; center+date means day already taken in this center
        if "date_1_medic_id_1" in str(e):
            return {"error": "Medicul este programat in aceasta zi in alt centru"}, 409
        return {"error": "Day already assigned at this center"}, 409

    center = centers.find_one({"_id": ObjectId(center_id)})
    _send_system_assignment_message(medic_id, center.get("name", "Center"), date_str)

    return {"message": "Assigned", "date": date_str, "medic_id": medic_id}, 201

@app.put("/centers/<center_id>/schedule")
@require_lead_or_admin
def replace_shift(center_id):
    data = request.get_json() or {}
    medic_id = data.get("medic_id")
    date_str = data.get("date")
    if not medic_id or not date_str:
        return {"error": "medic_id and date required"}, 400

    try:
        date_str = _parse_date_str(date_str)
    except ValueError as e:
        return {"error": str(e)}, 400
    
     # 🚫 Disallow assigning past dates
    if _is_past(date_str):
        return {"error": "Cannot assign past dates"}, 400

    # Ensure medic is a member
    if not memberships.find_one({"center_id": ObjectId(center_id), "user_id": ObjectId(medic_id)}):
        return {"error": "Medicul nu este membru al acestui centru"}, 400
    
    # Hard block: medic self-marked busy that day
    if busy_days.find_one({"medic_id": ObjectId(medic_id), "date": date_str}):
        return {"error": "Medicul s-a declarat indisponibil in aceasta zi"}, 409


    try:
        shifts.update_one(
            {"center_id": ObjectId(center_id), "date": date_str},
            {
                "$set": {
                    "medic_id": ObjectId(medic_id),
                    "updated_at": dt.utcnow(),
                    "assigned_by": ObjectId(get_jwt_identity())
                }
            },
            upsert=True
        )
    except DuplicateKeyError as e:
        if "date_1_medic_id_1" in str(e):
            return {"error": "Medicul este deja programat in aceasta zi in alt centru"}, 409
        return {"error": "Conflict while assigning day"}, 409

    center = centers.find_one({"_id": ObjectId(center_id)})
    _send_system_assignment_message(medic_id, center.get("name", "Center"), date_str)

    return {"message": "Assigned (replaced if existed)", "date": date_str, "medic_id": medic_id}


@app.delete("/centers/<center_id>/schedule/<date_str>")
@require_lead_or_admin
def unassign_shift(center_id, date_str):
    try:
        date_norm = _parse_date_str(date_str)
    except ValueError as e:
        return {"error": str(e)}, 400
    
     # 🚫 Disallow assigning past dates
    if _is_past(date_str):
        return {"error": "Cannot assign past dates"}, 400

    res = shifts.delete_one({"center_id": ObjectId(center_id), "date": date_norm})
    if res.deleted_count == 0:
        return {"error": "No assignment for that date"}, 404
    return {"message": "Unassigned", "date": date_norm}

#messages
# --- Messaging helpers ---
def dm_conversation_id(a: str, b: str) -> str:
    # deterministic, order-independent
    return "dm_" + "_".join(sorted([a, b]))

@app.get("/conversations")
@jwt_required()
def list_conversations():
    uid = ObjectId(get_jwt_identity())

    pipeline = [
        {"$match": {"$or": [{"to": uid}, {"from": str(uid)}]}},
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": "$conversation_id",
            "last_message": {"$first": "$content"},
            "timestamp": {"$first": "$timestamp"}
        }},
        {"$sort": {"timestamp": -1}},
    ]
    items = list(messages.aggregate(pipeline))
    # normalize
    out = []
    for it in items:
        out.append({
            "conversation_id": it["_id"],
            "last_message": it.get("last_message"),
            "timestamp": it.get("timestamp").isoformat() + "Z" if it.get("timestamp") else None
        })
    return {"conversations": out}


@app.get("/messages/<conversation_id>")
@jwt_required()
def get_messages(conversation_id):
    uid_str = str(get_jwt_identity())
    uid = ObjectId(uid_str)

    # user must be a participant (to == me OR from == me)
    q = {"conversation_id": conversation_id, "$or": [{"to": uid}, {"from": uid_str}]}
    docs = list(messages.find(q).sort("timestamp", 1))
    for d in docs:
        d["_id"] = str(d["_id"])
        # normalize ObjectId to string
        if isinstance(d.get("to"), ObjectId):
            d["to"] = str(d["to"])
    return {"messages": docs}

@app.post("/messages")
@jwt_required()
def send_message():
    data = request.get_json() or {}
    to_user = data.get("to_user_id")
    content = (data.get("content") or "").strip()
    if not to_user or not content:
        return {"error": "to_user_id and content required"}, 400

    # prevent replying to System
    if to_user == "system":
        return {"error": "Cannot message System"}, 400

    me_id = str(get_jwt_identity())
    try:
        to_oid = ObjectId(to_user)
    except Exception:
        return {"error": "Invalid to_user_id"}, 400

    conv_id = dm_conversation_id(me_id, to_user)
    msg = {
        "conversation_id": conv_id,
        "from": me_id,          # store sender as string id
        "to": to_oid,           # store recipient as ObjectId
        "content": content,
        "timestamp": dt.utcnow(),
        "system": False,
    }
    messages.insert_one(msg)
    return {"message": "sent", "conversation_id": conv_id}, 201

#calendar personal
@app.get("/my/schedule")
@jwt_required()
def my_schedule():
    month = request.args.get("month")
    if not month:
        return {"error": "month query param required, e.g., ?month=2025-01"}, 400
    try:
        first, last = _month_bounds(month)
    except ValueError as e:
        return {"error": str(e)}, 400

    uid = ObjectId(get_jwt_identity())
    # fetch only my shifts for this month, and join center name
    pipeline = [
        {"$match": {
            "medic_id": uid,
            "date": {"$gte": first.strftime(DATE_FMT), "$lte": last.strftime(DATE_FMT)}
        }},
        {"$lookup": {"from": "centers", "localField": "center_id", "foreignField": "_id", "as": "center"}},
        {"$unwind": {"path": "$center", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "date": 1,
            "center_id": {"$toString": "$center_id"},
            "center_name": {"$ifNull": ["$center.name", "Center"]}
        }},
        {"$sort": {"date": 1}}
    ]
    days = list(shifts.aggregate(pipeline))
    return {"month": month, "days": days}


#calendar blocare data
@app.get("/my/busy")
@jwt_required()
def my_busy_days():
    month = request.args.get("month")
    if not month:
        return {"error": "month query param required, e.g., ?month=2025-01"}, 400
    try:
        first, last = _month_bounds(month)
    except ValueError as e:
        return {"error": str(e)}, 400

    uid = ObjectId(get_jwt_identity())
    docs = list(busy_days.find({
        "medic_id": uid,
        "date": {"$gte": first.strftime(DATE_FMT), "$lte": last.strftime(DATE_FMT)}
    }, {"_id": 0, "date": 1}))
    return {"month": month, "days": [d["date"] for d in docs]}


@app.post("/my/busy")
@jwt_required()
def add_busy_day():
    data = request.get_json() or {}
    date_str = data.get("date")
    if not date_str:
        return {"error": "date required (YYYY-MM-DD)"}, 400
    try:
        date_norm = _parse_date_str(date_str)
    except ValueError as e:
        return {"error": str(e)}, 400
    
    # 🚫 Disallow past days
    if _is_past(date_norm):
        return {"error": "Cannot mark busy on past dates"}, 400

    uid = ObjectId(get_jwt_identity())

    # Don’t allow marking busy if already scheduled somewhere that day
    if shifts.find_one({"medic_id": uid, "date": date_norm}):
        return {"error": "Sunteti deja programat in aceasta zi"}, 409

    try:
        busy_days.insert_one({"medic_id": uid, "date": date_norm, "created_at": dt.utcnow()})
    except DuplicateKeyError:
        return {"error": "Already marked busy for this date"}, 409

    return {"message": "Zi indisponibila adaugata", "date": date_norm}, 201


@app.delete("/my/busy/<date_str>")
@jwt_required()
def remove_busy_day(date_str):
    try:
        date_norm = _parse_date_str(date_str)
    except ValueError as e:
        return {"error": str(e)}, 400
    # 🚫 Disallow past days
    if _is_past(date_norm):
        return {"error": "Cannot mark busy on past dates"}, 400
    uid = ObjectId(get_jwt_identity())
    res = busy_days.delete_one({"medic_id": uid, "date": date_norm})
    if res.deleted_count == 0:
        return {"error": "Busy day not found"}, 404
    return {"message": "Zi indisponibila stearsa", "date": date_norm}

# --- Profile update: first_name, last_name, phone ---
@app.patch("/me")
@jwt_required()
def update_me():
    uid = ObjectId(get_jwt_identity())
    data = request.get_json() or {}

    allowed = {"first_name", "last_name", "phone"}
    update = {}
    for k, v in data.items():
        if k in allowed and isinstance(v, str):
            update[k] = v.strip()

    if not update:
        return {"message": "Nothing to update"}, 200

    users.update_one({"_id": uid}, {"$set": update})
    # return the fresh doc (without password)
    user = users.find_one({"_id": uid}, {"password_hash": 0})
    user["_id"] = str(user["_id"])
    return {"message": "Profile updated", "user": user}, 200


# --- Password change ---
@app.post("/me/change-password")
@jwt_required()
def change_password():
    uid = ObjectId(get_jwt_identity())
    data = request.get_json() or {}
    current = (data.get("current_password") or "").encode("utf-8")
    new = (data.get("new_password") or "").encode("utf-8")
    confirm = (data.get("confirm_password") or "").encode("utf-8")

    if not current or not new or not confirm:
        return {"error": "current_password, new_password, confirm_password required"}, 400
    if new != confirm:
        return {"error": "Parolele nu se potrivesc"}, 400
    if len(new) < 6:
        return {"error": "Noua parola trebuie sa fie cel putin 6 caractere"}, 400

    user = users.find_one({"_id": uid})
    if not user:
        return {"error": "User not found"}, 404
    if not bcrypt.checkpw(current, user["password_hash"]):
        return {"error": "Parola curenta este gresita"}, 400

    if bcrypt.checkpw(new, user["password_hash"]):
        return {"error": "Noua parola trebuie sa fie diferita de cea veche"}, 400

    hashed = bcrypt.hashpw(new, bcrypt.gensalt())
    users.update_one({"_id": uid}, {"$set": {"password_hash": hashed}})
    return {"message": "Password changed"}, 200

#users
@app.get("/users/find")
@jwt_required()
def find_user_by_email():
    email = (request.args.get("email") or "").strip().lower()
    if not email:
        return {"error": "email required"}, 400
    u = users.find_one({"email": email}, {"password_hash": 0})
    if not u:
        return {"error": "Not found"}, 404
    return {
        "id": str(u["_id"]),
        "first_name": u.get("first_name") or u.get("username", ""),
        "last_name": u.get("last_name", ""),
        "email": u.get("email"),
        "status": u.get("status", "pending"),
    }

#reports
@app.get("/centers/<center_id>/reports")
@jwt_required()
def center_reports(center_id):
    # Only members (or admin) can see reports for a center
    me_id = ObjectId(get_jwt_identity())
    me = users.find_one({"_id": me_id})
    if not me:
        return {"error": "Neautorizat"}, 401
    if me.get("global_role") != "admin":
        m = memberships.find_one({"center_id": ObjectId(center_id), "user_id": me_id})
        if not m:
            return {"error": "Neautorizat (members only)"}, 403

    month = (request.args.get("month") or "").strip()  # YYYY-MM
    if not month:
        return {"error": "month query param required, e.g., ?month=2025-01"}, 400

    try:
        first, last = _month_bounds(month)  # you already have this helper
    except ValueError as e:
        return {"error": str(e)}, 400

    center_oid = ObjectId(center_id)

    pipeline = [
        {"$match": {
            "center_id": center_oid,
            "date": {"$gte": first.strftime(DATE_FMT), "$lte": last.strftime(DATE_FMT)}
        }},
        {"$group": {
            "_id": "$medic_id",
            "count": {"$sum": 1}
        }},
        {"$lookup": {
            "from": "users",
            "localField": "_id",
            "foreignField": "_id",
            "as": "user"
        }},
        {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "medic_id": {"$toString": "$_id"},
            "count": 1,
            "first_name": {"$ifNull": ["$user.first_name", "$user.username"]},
            "last_name": {"$ifNull": ["$user.last_name", ""]},
            "email": "$user.email"
        }},
        {"$sort": {"count": -1, "first_name": 1, "last_name": 1}}
    ]

    rows = list(shifts.aggregate(pipeline))
    total = sum(r["count"] for r in rows)
    return {"center_id": center_id, "month": month, "rows": rows, "total": total}

#csv
@app.get("/centers/<center_id>/reports.csv")
@jwt_required()
def center_reports_csv(center_id):
    # auth: member or admin (same as JSON report)
    me_id = ObjectId(get_jwt_identity())
    me = users.find_one({"_id": me_id})
    if not me:
        return {"error": "Neautorizat"}, 401
    if me.get("global_role") != "admin":
        m = memberships.find_one({"center_id": ObjectId(center_id), "user_id": me_id})
        if not m:
            return {"error": "Neautorizat (members only)"}, 403

    month = (request.args.get("month") or "").strip()
    if not month:
        return {"error": "month query param required, e.g., ?month=2025-01"}, 400

    try:
        first, last = _month_bounds(month)
    except ValueError as e:
        return {"error": str(e)}, 400

    center_oid = ObjectId(center_id)
    pipeline = [
        {"$match": {
            "center_id": center_oid,
            "date": {"$gte": first.strftime(DATE_FMT), "$lte": last.strftime(DATE_FMT)}
        }},
        {"$group": {"_id": "$medic_id", "count": {"$sum": 1}}},
        {"$lookup": {
            "from": "users",
            "localField": "_id",
            "foreignField": "_id",
            "as": "user"
        }},
        {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "medic_id": {"$toString": "$_id"},
            "first_name": {"$ifNull": ["$user.first_name", "$user.username"]},
            "last_name": {"$ifNull": ["$user.last_name", ""]},
            "email": "$user.email",
            "count": 1
        }},
        {"$sort": {"count": -1, "first_name": 1, "last_name": 1}}
    ]
    rows = list(shifts.aggregate(pipeline))

    # build CSV
    sio = StringIO()
    w = csv.writer(sio)
    w.writerow(["medic_id", "first_name", "last_name", "email", "assigned_days"])
    for r in rows:
        w.writerow([r.get("medic_id",""), r.get("first_name",""), r.get("last_name",""), r.get("email",""), r.get("count",0)])

    resp = make_response(sio.getvalue())
    resp.headers["Content-Type"] = "text/csv; charset=utf-8"
    resp.headers["Content-Disposition"] = f'attachment; filename="center_{center_id}_{month}_report.csv"'
    return resp

#support
@app.post("/support")
@jwt_required(optional=True)  # allow both authenticated and anonymous
def create_support_ticket():
    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    email = (data.get("email") or "").strip().lower()

    if not message:
        return {"error": "message required"}, 400

    uid = get_jwt_identity()  # None if anonymous
    user_doc = None
    if uid:
        try:
            user_doc = users.find_one({"_id": ObjectId(uid)})
        except Exception:
            user_doc = None

    # If anonymous and no email provided, we can't follow up
    if not uid and not email:
        return {"error": "Email este camp obligatoriu"}, 400

    # If authenticated and email not provided, use account email as fallback
    if uid and not email:
        email = (user_doc or {}).get("email", "")

    doc = {
        "created_at": dt.utcnow(),
        "status": "open",
        "message": message,
        "email": email or None,
        "user_id": uid or None,
        "user_first_name": (user_doc or {}).get("first_name"),
        "user_last_name": (user_doc or {}).get("last_name"),
    }
    support.insert_one(doc)
    return {"message": "Support message received"}, 201

# --- Admin: list support messages ---
@app.get("/admin/support")
@admin_required
def admin_support_list():
    # optional ?resolved=true/false  (default: all)
    resolved_q = request.args.get("resolved")
    q = {}
    if resolved_q is not None:
        if resolved_q.lower() in ("true", "1", "yes"):
            q["resolved"] = True
        elif resolved_q.lower() in ("false", "0", "no"):
            q["resolved"] = False

    items = []
    for d in support.find(q).sort("created_at", -1):
        items.append({
            "id": str(d["_id"]),
            "user_id": str(d["user_id"]) if d.get("user_id") else None,
            "email": d.get("email"),
            "message": d.get("message"),
            "created_at": d.get("created_at").isoformat() + "Z" if d.get("created_at") else None,
            "resolved": bool(d.get("resolved", False)),
        })
    return {"items": items}

# --- Admin: mark resolved/unresolved ---
@app.patch("/admin/support/<sid>")
@admin_required
def admin_support_resolve(sid):
    data = request.get_json() or {}
    resolved = bool(data.get("resolved"))
    try:
        res = support.update_one({"_id": ObjectId(sid)}, {"$set": {"resolved": resolved}})
    except Exception:
        return {"error": "Invalid id"}, 400
    if res.matched_count == 0:
        return {"error": "Not found"}, 404
    return {"message": "updated", "resolved": resolved}

# --- Admin: mutate users ---
@app.patch("/admin/users/<user_id>/email")
@admin_required
def admin_update_email(user_id):
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return {"error": "email required"}, 400
    # unique email constraint already exists
    try:
        users.update_one({"_id": ObjectId(user_id)}, {"$set": {"email": email}})
    except Exception as e:
        # Could be DuplicateKeyError from unique index
        return {"error": "Email already in use"}, 409
    return {"message": "updated"}

@app.patch("/admin/users/<user_id>/password")
@admin_required
def admin_set_password(user_id):
    data = request.get_json() or {}
    pw = (data.get("password") or "")
    if len(pw) < 6:
        return {"error": "password must be at least 6 chars"}, 400
    hashed = bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt())
    users.update_one({"_id": ObjectId(user_id)}, {"$set": {"password_hash": hashed}})
    return {"message": "password updated"}

@app.delete("/admin/users/<user_id>")
@admin_required
def admin_delete_user(user_id):
    oid = ObjectId(user_id)
    # Optional clean-up; keep minimal, expand if you want cascading deletes
    memberships.delete_many({"user_id": oid})
    busy_days.delete_many({"medic_id": oid})
    shifts.delete_many({"medic_id": oid})
    messages.delete_many({"$or": [{"to": oid}, {"from": user_id}]})
    res = users.delete_one({"_id": oid})
    if res.deleted_count == 0:
        return {"error": "not found"}, 404
    return {"message": "deleted"}

@app.get("/users/basics")
@jwt_required()
def users_basics():
    """
    Return basic identity info for a comma-separated list of ids.
    Example: /users/basics?ids=64f...,65a...
    """
    ids_param = (request.args.get("ids") or "").strip()
    if not ids_param:
        return {"users": []}

    ids = []
    for s in ids_param.split(","):
        s = s.strip()
        if not s:
            continue
        try:
            ids.append(ObjectId(s))
        except Exception:
            # skip invalid ids silently
            pass

    if not ids:
        return {"users": []}

    cursor = users.find(
        {"_id": {"$in": ids}},
        {"first_name": 1, "last_name": 1, "email": 1, "global_role": 1}
    )

    out = []
    for u in cursor:
        out.append({
            "id": str(u["_id"]),
            "first_name": u.get("first_name", ""),
            "last_name": u.get("last_name", ""),
            "email": u.get("email", ""),
            "global_role": u.get("global_role", "medic"),
        })
    return {"users": out}
