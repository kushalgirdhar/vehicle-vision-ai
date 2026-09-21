from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Optional
from pathlib import Path
import shutil
import uuid


router = APIRouter()


# Root directory where vehicle analysis jobs are stored
UPLOAD_ROOT = Path("data/uploads")
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


# Supported image formats
ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


@router.post("/upload")
async def upload_images(
    files: List[UploadFile] = File(...),
    background: Optional[UploadFile] = File(None),
):
    # ---------------------------------------------------------
    # Validate vehicle image count
    # ---------------------------------------------------------

    if not files:
        raise HTTPException(
            status_code=400,
            detail="No vehicle images were uploaded.",
        )

    if len(files) < 10:
        raise HTTPException(
            status_code=400,
            detail="At least 10 vehicle images are required.",
        )

    if len(files) > 12:
        raise HTTPException(
            status_code=400,
            detail="Maximum 12 vehicle images are allowed.",
        )

    # ---------------------------------------------------------
    # Create unique job ID
    # ---------------------------------------------------------

    job_id = f"job_{uuid.uuid4().hex[:12]}"

    job_dir = UPLOAD_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # ---------------------------------------------------------
    # Save vehicle images
    # ---------------------------------------------------------

    saved_files = []

    for file in files:

        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="One or more vehicle files has an invalid or missing filename.",
            )

        # Prevent directory traversal
        filename = Path(file.filename).name

        extension = Path(filename).suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported image format: {filename}",
            )

        file_path = job_dir / filename

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        saved_files.append(
            {
                "filename": filename,
                "path": str(file_path),
            }
        )

    # ---------------------------------------------------------
    # Save optional background image
    # ---------------------------------------------------------

    saved_background = None

    if background and background.filename:

        bg_filename = Path(background.filename).name

        bg_ext = Path(bg_filename).suffix.lower()

        if bg_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported background image format: {bg_filename}",
            )

        bg_file_path = job_dir / f"bg_{bg_filename}"

        with bg_file_path.open("wb") as buffer:
            shutil.copyfileobj(background.file, buffer)

        saved_background = {
            "filename": bg_filename,
            "path": str(bg_file_path),
        }

    # ---------------------------------------------------------
    # Response
    # ---------------------------------------------------------

    return {
        "message": "Vehicle images uploaded successfully",
        "job_id": job_id,
        "count": len(saved_files),
        "files": saved_files,
        "background": saved_background,
    }