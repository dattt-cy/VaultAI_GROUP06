"""
Admin Backup Routes – /api/admin/backup*
Tạo, liệt kê, tải xuống và khôi phục backup (DB + ChromaDB).
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os, subprocess, shutil, zipfile, datetime, json

from app.db.session import get_db
from app.api.dependencies import require_min_level
from app.core.config import settings

router = APIRouter()

BACKUP_DIR = os.path.abspath("./backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

CHROMA_DIR = os.path.abspath(settings.CHROMA_PERSIST_DIR)


def _parse_db_url():
    """Parse MySQL connection info từ SQLALCHEMY_DATABASE_URI."""
    uri = settings.SQLALCHEMY_DATABASE_URI
    # mysql+pymysql://user:pass@host:port/dbname
    try:
        rest = uri.split("://", 1)[1]
        userpass, rest2 = rest.split("@", 1)
        user, password = userpass.split(":", 1)
        hostport, dbname = rest2.split("/", 1)
        dbname = dbname.split("?")[0]
        if ":" in hostport:
            host, port = hostport.split(":", 1)
        else:
            host, port = hostport, "3306"
        return user, password, host, port, dbname
    except Exception:
        return None


def _create_backup_zip(backup_name: str) -> str:
    """Tạo file backup zip gồm SQL dump + ChromaDB snapshot."""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"backup_{timestamp}.zip"
    zip_path = os.path.join(BACKUP_DIR, zip_filename)
    tmp_dir = os.path.join(BACKUP_DIR, f"_tmp_{timestamp}")
    os.makedirs(tmp_dir, exist_ok=True)

    errors = []

    # 1. MySQL dump
    db_info = _parse_db_url()
    if db_info:
        user, password, host, port, dbname = db_info
        sql_path = os.path.join(tmp_dir, "database.sql")
        env = os.environ.copy()
        env["MYSQL_PWD"] = password
        try:
            result = subprocess.run(
                ["mysqldump", "-u", user, f"-h{host}", f"-P{port}", dbname],
                capture_output=True, env=env, timeout=120
            )
            if result.returncode == 0:
                with open(sql_path, "wb") as f:
                    f.write(result.stdout)
            else:
                errors.append(f"mysqldump error: {result.stderr.decode()[:200]}")
                # Create empty file with error note
                with open(sql_path, "w") as f:
                    f.write(f"-- mysqldump failed: {result.stderr.decode()[:200]}\n")
        except FileNotFoundError:
            errors.append("mysqldump not found in PATH")
            with open(sql_path, "w") as f:
                f.write("-- mysqldump not available\n")
        except subprocess.TimeoutExpired:
            errors.append("mysqldump timed out")

    # 2. ChromaDB snapshot
    chroma_snapshot = os.path.join(tmp_dir, "chroma_db")
    if os.path.exists(CHROMA_DIR):
        shutil.copytree(CHROMA_DIR, chroma_snapshot)
    else:
        os.makedirs(chroma_snapshot)

    # 3. Metadata
    meta = {
        "created_at": datetime.datetime.now().isoformat(),
        "backup_name": backup_name or zip_filename,
        "errors": errors,
    }
    with open(os.path.join(tmp_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    # 4. Zip everything
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(tmp_dir):
            for file in files:
                abs_path = os.path.join(root, file)
                arcname = os.path.relpath(abs_path, tmp_dir)
                zf.write(abs_path, arcname)

    shutil.rmtree(tmp_dir, ignore_errors=True)
    return zip_filename


def _get_backup_list():
    files = []
    for fname in os.listdir(BACKUP_DIR):
        if fname.endswith(".zip") and fname.startswith("backup_"):
            fpath = os.path.join(BACKUP_DIR, fname)
            stat = os.stat(fpath)
            files.append({
                "filename": fname,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created_at": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
    files.sort(key=lambda x: x["created_at"], reverse=True)
    return files


# ─────────────────────────────────────────────
# POST /backup — tạo backup mới
# ─────────────────────────────────────────────
@router.post("/backup", summary="Tạo backup hệ thống", dependencies=[Depends(require_min_level(9))])
def create_backup(db: Session = Depends(get_db)):
    zip_filename = _create_backup_zip("")
    fpath = os.path.join(BACKUP_DIR, zip_filename)
    size_mb = round(os.path.getsize(fpath) / (1024 * 1024), 2)
    return {
        "message": "Backup tạo thành công.",
        "filename": zip_filename,
        "size_mb": size_mb,
    }


# ─────────────────────────────────────────────
# GET /backups — danh sách backup
# ─────────────────────────────────────────────
@router.get("/backups", summary="Danh sách backup", dependencies=[Depends(require_min_level(9))])
def list_backups():
    return {"backups": _get_backup_list()}


# ─────────────────────────────────────────────
# GET /backups/{filename}/download
# ─────────────────────────────────────────────
@router.get("/backups/{filename}/download", summary="Tải xuống backup", dependencies=[Depends(require_min_level(9))])
def download_backup(filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Tên file không hợp lệ.")
    fpath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="File backup không tồn tại.")
    return FileResponse(fpath, media_type="application/zip", filename=filename)


# ─────────────────────────────────────────────
# DELETE /backups/{filename}
# ─────────────────────────────────────────────
@router.delete("/backups/{filename}", summary="Xóa backup", dependencies=[Depends(require_min_level(9))])
def delete_backup(filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Tên file không hợp lệ.")
    fpath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="File backup không tồn tại.")
    os.remove(fpath)
    return {"message": f"Đã xóa backup '{filename}'."}


# ─────────────────────────────────────────────
# POST /restore — upload zip và khôi phục
# ─────────────────────────────────────────────
@router.post("/restore", summary="Khôi phục từ backup", dependencies=[Depends(require_min_level(10))])
async def restore_backup(file: UploadFile = File(...)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file .zip.")

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    upload_path = os.path.join(BACKUP_DIR, f"restore_upload_{timestamp}.zip")

    with open(upload_path, "wb") as f:
        content = await file.read()
        f.write(content)

    extract_dir = os.path.join(BACKUP_DIR, f"_restore_{timestamp}")
    try:
        with zipfile.ZipFile(upload_path, "r") as zf:
            zf.extractall(extract_dir)

        # Restore ChromaDB
        chroma_src = os.path.join(extract_dir, "chroma_db")
        if os.path.exists(chroma_src) and os.path.exists(CHROMA_DIR):
            backup_chroma = CHROMA_DIR + "_backup_before_restore"
            if os.path.exists(backup_chroma):
                shutil.rmtree(backup_chroma)
            shutil.move(CHROMA_DIR, backup_chroma)
            shutil.copytree(chroma_src, CHROMA_DIR)

        # Read metadata
        meta_path = os.path.join(extract_dir, "metadata.json")
        meta = {}
        if os.path.exists(meta_path):
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)

        return {
            "message": "Khôi phục ChromaDB thành công. Vui lòng khởi động lại backend để áp dụng đầy đủ.",
            "backup_metadata": meta,
            "note": "Database SQL cần restore thủ công từ file database.sql trong backup.",
        }
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="File zip không hợp lệ hoặc bị hỏng.")
    finally:
        shutil.rmtree(extract_dir, ignore_errors=True)
        if os.path.exists(upload_path):
            os.remove(upload_path)
