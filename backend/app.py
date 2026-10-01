from flask import Flask, request, jsonify
from flask_cors import CORS
from models import SessionLocal, CheckIn, Resource, Meal, Base, engine
from datetime import date, timedelta
from calendar import monthrange
from sqlalchemy import and_

app = Flask(__name__)
import os
# Explicit origins only. A frontend URL is not authentication.
origins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000", "http://localhost:8080"]
if os.getenv('FRONTEND_URL'):
    origins.append(os.environ['FRONTEND_URL'])
CORS(app, resources={r"/api/*": {"origins": origins}})
Base.metadata.create_all(engine, tables=[CheckIn.__table__, Meal.__table__, Resource.__table__])
from agent.routes import bp as agent_blueprint
app.register_blueprint(agent_blueprint)

@app.before_request
def validate_basic_payload():
    if request.path.startswith('/api/agent'):
        return None
    if request.method in ['POST', 'PATCH']:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(error='Expected a JSON object'), 400
        for key in ['note', 'meal_type', 'meal_status', 'status', 'date']:
            if key in data and data[key] is not None and not isinstance(data[key], str):
                return jsonify(error=f'{key} must be text'), 400
    if 'limit' in request.args:
        try:
            if not 1 <= int(request.args['limit']) <= 1000:
                raise ValueError()
        except ValueError:
            return jsonify(error='limit must be a positive integer'), 400

@app.get("/api/health")
def health():
    return jsonify({"ok": True})

# ---- Create ----
@app.post("/api/checkins")
def create_checkin():
    data = request.get_json() or {}

    # parse & basic validation
    try:
        mood = int(data.get("mood", 3))
        urge = int(data.get("urge", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "mood/urge must be integers"}), 400

    meal = (data.get("meal_status") or "skipped").lower()
    note = data.get("note") or None
    if note is not None and len(note) > 500:
        return jsonify({"error": "note too long (max 500)"}), 400

    if not (1 <= mood <= 5):
        return jsonify({"error": "mood out of range (1..5)"}), 400
    if not (0 <= urge <= 5):
        return jsonify({"error": "urge out of range (0..5)"}), 400
    if meal not in ["skipped", "partial", "completed"]:
        return jsonify({"error": "invalid meal_status (skipped|partial|completed)"}), 400

    try:
        d = date.fromisoformat(data["date"]) if data.get("date") else date.today()
    except (TypeError, ValueError):
        return jsonify(error="invalid date (YYYY-MM-DD)"), 400

    db = SessionLocal()
    try:
        c = CheckIn(date=d, mood=mood, urge=urge, meal_status=meal, note=note)
        db.add(c)
        db.commit()
        out = {
            "id": c.id, "date": c.date.isoformat(),
            "mood": c.mood, "urge": c.urge,
            "meal_status": c.meal_status, "note": c.note
        }
        return jsonify(out), 201
    finally:
        db.close()

# ---- Common payload validator for update ----
def validate_checkin_payload(data, for_update=False):
    out = {}
    if "mood" in data or not for_update:
        try:
            mood = int(data.get("mood", 3))
        except (TypeError, ValueError):
            return None, ("mood/urge must be integers", 400)
        out["mood"] = mood
    if "urge" in data or not for_update:
        try:
            urge = int(data.get("urge", 0))
        except (TypeError, ValueError):
            return None, ("mood/urge must be integers", 400)
        out["urge"] = urge

    if "meal_status" in data or not for_update:
        meal = (data.get("meal_status") or "skipped").lower()
        out["meal_status"] = meal

    if "note" in data:
        note = data.get("note") or None
        if note is not None and len(note) > 500:
            return None, ("note too long (max 500)", 400)
        out["note"] = note

    if "date" in data and data["date"]:
        try:
            out["date"] = date.fromisoformat(data["date"])
        except Exception:
            return None, ("invalid date (YYYY-MM-DD)", 400)

    if "mood" in out and not (1 <= out["mood"] <= 5):
        return None, ("mood out of range (1..5)", 400)
    if "urge" in out and not (0 <= out["urge"] <= 5):
        return None, ("urge out of range (0..5)", 400)
    if "meal_status" in out and out["meal_status"] not in ["skipped","partial","completed"]:
        return None, ("invalid meal_status (skipped|partial|completed)", 400)

    return out, None

# ---- Read (list with filters) ----
@app.get("/api/checkins")
def list_checkins():
    q_date = request.args.get("date")  # YYYY-MM-DD
    limit = min(int(request.args.get("limit", 10)), 50)

    db = SessionLocal()
    try:
        query = db.query(CheckIn)
        if q_date:
            try:
                d = date.fromisoformat(q_date)
            except Exception:
                return jsonify({"error": "invalid date (YYYY-MM-DD)"}), 400
            query = query.filter(CheckIn.date == d)
        rows = (query.order_by(CheckIn.created_at.desc())
                     .limit(limit)
                     .all())
        out = [{
            "id": c.id,
            "date": c.date.isoformat(),
            "mood": c.mood,
            "urge": c.urge,
            "meal_status": c.meal_status,
            "note": c.note,
            "created_at": c.created_at.isoformat(),
        } for c in rows]
        return jsonify(out)
    finally:
        db.close()

# ---- Update ----
@app.patch("/api/checkins/<int:cid>")
def update_checkin(cid):
    data = request.get_json() or {}
    parsed, err = validate_checkin_payload(data, for_update=True)
    if err:
        return jsonify({"error": err[0]}), err[1]

    db = SessionLocal()
    try:
        c = db.get(CheckIn, cid)   # SQLAlchemy 2.x 推荐用法
        if not c:
            return jsonify({"error": "not found"}), 404
        for k, v in parsed.items():
            setattr(c, k, v)
        db.commit()
        out = {
            "id": c.id, "date": c.date.isoformat(), "mood": c.mood, "urge": c.urge,
            "meal_status": c.meal_status, "note": c.note
        }
        return jsonify(out)
    finally:
        db.close()

# ---- Delete ----
@app.delete("/api/checkins/<int:cid>")
def delete_checkin(cid):
    db = SessionLocal()
    try:
        c = db.get(CheckIn, cid)
        if not c:
            return jsonify({"error": "not found"}), 404
        db.delete(c)
        db.commit()
        return jsonify({"ok": True})
    finally:
        db.close()

# ---- Summary ----
@app.get("/api/summary7")
def summary7():
    db = SessionLocal()
    try:
        today = date.today()
        days = []
        meals = {"completed": 0, "partial": 0, "skipped": 0}
        
        # 先收集所有7天的数据
        day_has_entries = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            # 检查 CheckIn 记录
            checkin_items = db.query(CheckIn).filter(CheckIn.date == d).all()
            # 检查 Meal 记录（只统计 breakfast, lunch, dinner，忽略 snack）
            all_meals = db.query(Meal).filter(Meal.date == d).all()
            meal_items = [m for m in all_meals if m.meal_type in ["breakfast", "lunch", "dinner"]]
            
            # 只要某天有 CheckIn 或 Meal 记录，就算有记录
            has_entries = len(checkin_items) > 0 or len(meal_items) > 0
            day_has_entries.append(has_entries)
            
            days.append({"date": d.isoformat(), "count": len(checkin_items)})
            for c in checkin_items:
                meals[c.meal_status] += 1
        
        # 计算连续天数（从今天往前数，连续有记录的天数）
        # 一旦遇到没有记录的天就停止
        streak = 0
        for has_entries in reversed(day_has_entries):  # 从今天往前数
            if has_entries:
                streak += 1
            else:
                break
        
        return jsonify({"days": days, "meals": meals, "streak": streak})
    finally:
        db.close()

@app.get("/api/checkins/month")
def month_view():
    try:
        year = int(request.args.get("year"))
        month = int(request.args.get("month"))
        assert 1 <= month <= 12 and 1 <= year <= 9998
    except Exception:
        return jsonify({"error": "year/month required, e.g. ?year=2025&month=11"}), 400

    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])

    db = SessionLocal()
    try:
        rows = (db.query(CheckIn)
                  .filter(and_(CheckIn.date >= first_day, CheckIn.date <= last_day))
                  .order_by(CheckIn.date.asc(), CheckIn.created_at.asc())
                  .all())

        # 按天聚合
        by_day = {}
        for r in rows:
            key = r.date.isoformat()
            if key not in by_day:
                by_day[key] = {"date": key, "count": 0, "mood_sum": 0, "completed": 0, "items": []}
            d = by_day[key]
            d["count"] += 1
            d["mood_sum"] += (r.mood or 0)
            if r.meal_status == "completed":
                d["completed"] += 1
            d["items"].append({
                "id": r.id,
                "mood": r.mood,
                "urge": r.urge,
                "meal_status": r.meal_status,
                "note": r.note
            })
        # 计算平均 mood
        for d in by_day.values():
            d["avg_mood"] = round(d["mood_sum"]/d["count"], 2) if d["count"] else None
            del d["mood_sum"]

        # 返回全月天数组（即使没有记录也返回空天）
        res_days = []
        cur = first_day
        while cur <= last_day:
            iso = cur.isoformat()
            res_days.append(by_day.get(iso, {"date": iso, "count": 0, "completed": 0, "avg_mood": None, "items": []}))
            cur = cur + timedelta(days=1)

        return jsonify({"year": year, "month": month, "days": res_days})
    finally:
        db.close()

# --- Meals --- #
@app.get("/api/meals")
def meals_list():
    q_date = request.args.get("date")
    limit = min(int(request.args.get("limit", 10)), 50)
    db = SessionLocal()
    query = db.query(Meal)
    if q_date:
        try:
            d = date.fromisoformat(q_date)
        except Exception:
            db.close()
            return jsonify({"error": "invalid date (YYYY-MM-DD)"}), 400
        query = query.filter(Meal.date == d)
    rows = query.order_by(Meal.date.desc(), Meal.id.desc()).limit(limit).all()
    out = [{
        "id": m.id,
        "date": m.date.isoformat(),
        "meal_type": m.meal_type,
        "status": m.status,
        "duration_sec": m.duration_sec,
        "note": m.note,
        "created_at": m.created_at.isoformat() if m.created_at else None
    } for m in rows]
    db.close()
    return jsonify(out)

# 创建
@app.post("/api/meals")
def meals_create():
    data = request.get_json() or {}
    try:
        d = date.fromisoformat(data["date"]) if data.get("date") else date.today()
    except Exception:
        return jsonify({"error": "invalid date (YYYY-MM-DD)"}), 400
    meal_type = (data.get("meal_type") or "breakfast").lower()
    status = (data.get("status") or "planned").lower()
    note = data.get("note") or None
    duration_sec = data.get("duration_sec")

    if meal_type not in ["breakfast","lunch","dinner","snack"]:
        return jsonify({"error":"invalid meal_type (breakfast|lunch|dinner|snack)"}), 400
    if status not in ["planned","completed","partial","skipped"]:
        return jsonify({"error":"invalid status (planned|completed|partial|skipped)"}), 400
    if duration_sec is not None:
        try:
            duration_sec = int(duration_sec)
            if duration_sec < 0: raise ValueError()
        except:
            return jsonify({"error":"duration_sec must be non-negative integer"}), 400
    if note and len(note) > 500:
        return jsonify({"error":"note too long (max 500)"}), 400

    db = SessionLocal()
    m = Meal(date=d, meal_type=meal_type, status=status, note=note, duration_sec=duration_sec)
    db.add(m); db.commit()
    out = {
        "id": m.id, "date": m.date.isoformat(),
        "meal_type": m.meal_type, "status": m.status,
        "duration_sec": m.duration_sec, "note": m.note
    }
    db.close()
    return jsonify(out), 201

# 更新
@app.patch("/api/meals/<int:mid>")
def meals_update(mid):
    data = request.get_json() or {}
    db = SessionLocal()
    m = db.get(Meal, mid)
    if not m:
        db.close()
        return jsonify({"error":"not found"}), 404

    # 逐项更新并校验
    if "date" in data and data["date"]:
        try:
            m.date = date.fromisoformat(data["date"])
        except:
            db.close()
            return jsonify({"error":"invalid date (YYYY-MM-DD)"}), 400
    if "meal_type" in data:
        v = (data["meal_type"] or "").lower()
        if v not in ["breakfast","lunch","dinner","snack"]:
            db.close()
            return jsonify({"error":"invalid meal_type"}), 400
        m.meal_type = v
    if "status" in data:
        v = (data["status"] or "").lower()
        if v not in ["planned","completed","partial","skipped"]:
            db.close()
            return jsonify({"error":"invalid status"}), 400
        m.status = v
    if "note" in data:
        note = data["note"] or None
        if note and len(note) > 500:
            db.close()
            return jsonify({"error":"note too long (max 500)"}), 400
        m.note = note
    if "duration_sec" in data:
        v = data["duration_sec"]
        if v is not None:
            try:
                v = int(v)
                if v < 0: raise ValueError()
            except:
                db.close()
                return jsonify({"error":"duration_sec must be non-negative integer"}), 400
        m.duration_sec = v

    db.commit()
    out = {
        "id": m.id, "date": m.date.isoformat(),
        "meal_type": m.meal_type, "status": m.status,
        "duration_sec": m.duration_sec, "note": m.note
    }
    db.close()
    return jsonify(out)

# 删除
@app.delete("/api/meals/<int:mid>")
def meals_delete(mid):
    db = SessionLocal()
    m = db.get(Meal, mid)
    if not m:
        db.close()
        return jsonify({"error":"not found"}), 404
    db.delete(m); db.commit(); db.close()
    return jsonify({"ok": True})

# Explicit meal statuses, separate from logging coverage.
@app.get("/api/meals/summary7")
def meals_summary7():
    with SessionLocal() as db:
        today = date.today()
        rows = db.query(Meal).filter(Meal.date >= today-timedelta(days=6), Meal.date <= today).all()
        counts = {key: 0 for key in ['completed','partial','skipped','planned']}
        days = []
        for i in range(6, -1, -1):
            d = today-timedelta(days=i)
            entries = [row for row in rows if row.date == d]
            for row in entries:
                counts[row.status] += 1
            days.append({'date':d.isoformat(),'count':len(entries),'status':'logged' if entries else 'unknown'})
        streak = 0
        for day in reversed(days):
            if not day['count']:
                break
            streak += 1
        total = len(rows)
        return jsonify(days=days, meals={key:round(n/total*100) if total else 0 for key,n in counts.items()},
                       counts=counts, logged_days=sum(bool(d['count']) for d in days),
                       unknown_days=sum(not d['count'] for d in days), streak=streak)

# 月份视图：返回该月每天的 meals 数量
@app.get("/api/meals/month")
def meals_month_view():
    try:
        year = int(request.args.get("year"))
        month = int(request.args.get("month"))
        assert 1 <= month <= 12 and 1 <= year <= 9998
    except Exception:
        return jsonify({"error": "year/month required, e.g. ?year=2025&month=11"}), 400

    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])

    db = SessionLocal()
    try:
        rows = (db.query(Meal)
                  .filter(and_(Meal.date >= first_day, Meal.date <= last_day))
                  .order_by(Meal.date.asc(), Meal.created_at.asc())
                  .all())

        # 按天聚合
        by_day = {}
        for r in rows:
            key = r.date.isoformat()
            if key not in by_day:
                by_day[key] = {"date": key, "count": 0}
            by_day[key]["count"] += 1

        # 返回全月天数组（即使没有记录也返回空天）
        res_days = []
        cur = first_day
        while cur <= last_day:
            iso = cur.isoformat()
            res_days.append(by_day.get(iso, {"date": iso, "count": 0}))
            cur = cur + timedelta(days=1)

        return jsonify({"year": year, "month": month, "days": res_days})
    finally:
        db.close()
    
# ---- Resources ----
@app.get("/api/resources")
def resources():
    db = SessionLocal()
    try:
        items = db.query(Resource).all()
        out = [{"id": r.id, "title": r.title, "url": r.url, "type": r.type, "tags": r.tags} for r in items]
        return jsonify(out)
    finally:
        db.close()

if __name__ == "__main__":
    app.run(port=5001, debug=True)
