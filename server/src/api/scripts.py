"""
Script management API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
import json

from ..core.config import settings
from ..core.database import get_session
from ..middleware.auth import get_current_user_id, require_auth
from ..models.script import Script, ScriptContent
from ..models.user import User
from ..models.project import Project
from ..services.script_service import ScriptService, ScriptSerializationOptions, ScriptImportExportOptions

router = APIRouter(prefix="/scripts", tags=["Scripts"])


class ScriptMetadata(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    version: str
    author_id: str
    project_id: Optional[str] = None
    tags: List[str] = []
    status: str
    created_at: str
    updated_at: str


class ScriptCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    version: str = "1.0.0"
    project_id: Optional[str] = None
    tags: List[str] = []
    content: str  # JSON string of test steps


class ScriptUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    project_id: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None
    content: Optional[str] = None


class ScriptResponse(ScriptMetadata):
    content: Optional[str] = None


@router.get("/", response_model=List[ScriptResponse])
async def list_scripts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    project_id: Optional[str] = Query(None),
    author_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """List scripts with pagination and filtering"""
    # Build base query with content
    query = (
        select(Script, ScriptContent.content)
        .join_from(ScriptContent, Script.content)
        .options(selectinload(Script.author), selectinload(Script.project))
    )

    # Apply filters
    if project_id:
        try:
            project_uuid = UUID(project_id)
            query = query.where(Script.project_id == project_uuid)
        except ValueError:
            pass

    if author_id:
        try:
            author_uuid = UUID(author_id)
            query = query.where(Script.author_id == author_uuid)
        except ValueError:
            pass

    if status:
        query = query.where(Script.status == status)

    if search:
        query = query.where(
            Script.name.ilike(f"%{search}%")
        )

    # Execute query with pagination
    result = await session.execute(query)
    scripts = result.unique().scalars().all()

    # Convert to response models
    script_responses = []
    for script in scripts:
        script_responses.append(ScriptResponse(
            id=str(script.id),
            name=script.name,
            description=script.description,
            version=script.version,
            author_id=str(script.author_id),
            project_id=str(script.project_id) if script.project_id else None,
            tags=script.tags.split(",") if script.tags else [],
            status=script.status,
            created_at=script.created_at.isoformat(),
            updated_at=script.updated_at.isoformat(),
            content=script.content if hasattr(script, 'content') else None
        ))

    return script_responses


@router.get("/{script_id}", response_model=ScriptResponse)
async def get_script(
    script_id: str,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """Get script by ID with content"""
    try:
        script_uuid = UUID(script_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid script ID format"
        )

    # Query script with content
    query = (
        select(Script, ScriptContent.content)
        .join_from(ScriptContent, Script.content)
        .options(selectinload(Script.author), selectinload(Script.project))
        .where(Script.id == script_uuid)
    )

    result = await session.execute(query)
    script = result.unique().scalar_one_or_none()

    if not script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Script not found"
        )

    return ScriptResponse(
        id=str(script.id),
        name=script.name,
        description=script.description,
        version=script.version,
        author_id=str(script.author_id),
        project_id=str(script.project_id) if script.project_id else None,
        tags=script.tags.split(",") if script.tags else [],
        status=script.status,
        created_at=script.created_at.isoformat(),
        updated_at=script.updated_at.isoformat(),
        content=script.content if hasattr(script, 'content') else None
    )


@router.post("/", response_model=ScriptResponse)
async def create_script(
    request: ScriptCreateRequest,
    user_id: str = Depends(require_auth),
    session: AsyncSession = Depends(get_session)
):
    """Create new script"""
    try:
        current_user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )

    # Validate JSON content using the new service
    service = ScriptService()
    try:
        await service.validate_script_content(request.content)
        script_content = json.loads(request.content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid script content: {str(e)}"
        )
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON content: {str(e)}"
        )

    # Handle project_id
    project_uuid = None
    if request.project_id:
        try:
            project_uuid = UUID(request.project_id)
        except ValueError:
            pass

    # Create new script
    new_script = Script(
        name=request.name,
        description=request.description,
        version=request.version,
        author_id=current_user_uuid,
        project_id=project_uuid,
        tags=",".join(request.tags),
        status="draft"
    )

    session.add(new_script)
    await session.flush()  # Get the ID

    # Create script content with checksum
    content_json = json.dumps(script_content)
    service = ScriptService()
    checksum = service.calculate_checksum(content_json)

    script_content = ScriptContent(
        script_id=new_script.id,
        content=content_json,
        checksum=checksum,
        content_type="application/json",
        size_bytes=len(content_json.encode('utf-8'))
    )

    session.add(script_content)
    await session.commit()

    # Return created script
    return ScriptResponse(
        id=str(new_script.id),
        name=new_script.name,
        description=new_script.description,
        version=new_script.version,
        author_id=str(new_script.author_id),
        project_id=str(new_script.project_id) if new_script.project_id else None,
        tags=request.tags,
        status=new_script.status,
        created_at=new_script.created_at.isoformat(),
        updated_at=new_script.updated_at.isoformat(),
        content=content_json
    )


@router.put("/{script_id}", response_model=ScriptResponse)
async def update_script(
    script_id: str,
    request: ScriptUpdateRequest,
    user_id: str = Depends(require_auth),
    session: AsyncSession = Depends(get_session)
):
    """Update existing script"""
    try:
        script_uuid = UUID(script_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid script ID format"
        )

    # Get existing script
    query = select(Script).where(Script.id == script_uuid)
    result = await session.execute(query)
    script = result.scalar_one_or_none()

    if not script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Script not found"
        )

    # Update fields
    if request.name is not None:
        script.name = request.name
    if request.description is not None:
        script.description = request.description
    if request.version is not None:
        script.version = request.version
    if request.tags is not None:
        script.tags = ",".join(request.tags)
    if request.status is not None:
        script.status = request.status

    # Handle content update with validation
    if request.content is not None:
        service = ScriptService()
        try:
            await service.validate_script_content(request.content)
            script_content = json.loads(request.content)

            content_json = json.dumps(script_content)
            service = ScriptService()
            checksum = service.calculate_checksum(content_json)

            # Update script content
            script_content_query = select(ScriptContent).where(
                ScriptContent.script_id == script_uuid
            )
            script_content_result = await session.execute(script_content_query)
            script_content_obj = script_content_result.scalar_one_or_none()

            if script_content_obj:
                script_content_obj.content = content_json
                script_content_obj.checksum = checksum
                script_content_obj.size_bytes = len(content_json.encode('utf-8'))
                script.content = content_json  # For response
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid script content: {str(e)}"
            )

    # Handle project_id update
    if request.project_id is not None:
        try:
            project_uuid = UUID(request.project_id)
            script.project_id = project_uuid
        except ValueError:
            pass

    script.updated_at = datetime.utcnow()
    await session.commit()

    return ScriptResponse(
        id=str(script.id),
        name=script.name,
        description=script.description,
        version=script.version,
        author_id=str(script.author_id),
        project_id=str(script.project_id) if script.project_id else None,
        tags=script.tags.split(",") if script.tags else [],
        status=script.status,
        created_at=script.created_at.isoformat(),
        updated_at=script.updated_at.isoformat(),
        content=getattr(script, 'content', None)
    )


@router.delete("/{script_id}")
async def delete_script(
    script_id: str,
    user_id: str = Depends(require_auth),
    session: AsyncSession = Depends(get_session)
):
    """Delete script"""
    try:
        script_uuid = UUID(script_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid script ID format"
        )

    # Get script to delete
    query = select(Script).where(Script.id == script_uuid)
    result = await session.execute(query)
    script = result.scalar_one_or_none()

    if not script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Script not found"
        )

    # Delete script and content (cascade)
    await session.delete(script)
    await session.commit()

    return {"message": "Script deleted successfully"}


def _calculate_checksum(content: str) -> str:
    """Calculate SHA-256 checksum of content"""
    import hashlib
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


# Enhanced API endpoints for T031
@router.post("/{script_id}/validate")
async def validate_script_content(
    script_id: str,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """Validate script content against schema"""
    try:
        script_uuid = UUID(script_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid script ID format"
        )

    # Get script content
    query = (
        select(Script, ScriptContent)
        .join(ScriptContent)
        .where(Script.id == script_uuid)
    )
    result = await session.execute(query)
    script_data = result.first()

    if not script_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Script not found"
        )

    script, content = script_data

    # Validate content
    service = ScriptService()
    try:
        is_valid = await service.validate_script_content(
            content.content,
            content.content_type
        )
        return {
            "valid": is_valid,
            "checksum": content.checksum,
            "content_type": content.content_type,
            "size_bytes": content.size_bytes
        }
    except ValueError as e:
        return {
            "valid": False,
            "error": str(e),
            "checksum": content.checksum,
            "content_type": content.content_type,
            "size_bytes": content.size_bytes
        }


@router.post("/export")
async def export_scripts(
    script_ids: List[str],
    format: str = Query("json", regex="^(json|yaml|compressed)$"),
    include_content: bool = Query(True),
    include_metadata: bool = Query(True),
    compress: bool = Query(False),
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """Export multiple scripts for backup or sharing"""
    service = ScriptService()

    try:
        # Validate script IDs
        validated_ids = []
        for script_id in script_ids:
            try:
                validated_ids.append(UUID(script_id))
            except ValueError:
                continue

        if not validated_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid script IDs provided"
            )

        # Export scripts
        options = ScriptImportExportOptions(
            format=format,
            include_content=include_content,
            include_metadata=include_metadata,
            compress=compress
        )

        export_data = await service.export_scripts(
            [str(id) for id in validated_ids],
            session,
            options
        )

        return export_data

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )


@router.post("/import")
async def import_scripts(
    import_data: Dict[str, Any],
    overwrite_existing: bool = Query(False),
    user_id: str = Depends(require_auth),
    session: AsyncSession = Depends(get_session)
):
    """Import scripts from exported data"""
    service = ScriptService()

    try:
        # Import scripts
        imported_scripts = await service.import_scripts(
            import_data,
            session,
            user_id
        )

        return {
            "message": f"Successfully imported {len(imported_scripts)} scripts",
            "imported_scripts": [
                {
                    "id": str(script.id),
                    "name": script.name,
                    "version": script.version
                }
                for script in imported_scripts
            ]
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )


@router.get("/statistics")
async def get_script_statistics(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """Get script system statistics"""
    service = ScriptService()

    try:
        stats = await service.get_script_statistics(session)
        return stats

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )


@router.post("/{script_id}/compress")
async def compress_script_content(
    script_id: str,
    user_id: str = Depends(require_auth),
    session: AsyncSession = Depends(get_session)
):
    """Compress script content to save storage space"""
    try:
        script_uuid = UUID(script_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid script ID format"
        )

    # Get script content
    query = (
        select(Script, ScriptContent)
        .join(ScriptContent)
        .where(Script.id == script_uuid)
    )
    result = await session.execute(query)
    script_data = result.first()

    if not script_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Script not found"
        )

    script, content = script_data

    # Check if already compressed (basic heuristic)
    if content.content_type == "application/gzip" or len(content.content) < 100:
        return {
            "message": "Content is already compressed or too small to benefit",
            "original_size": content.size_bytes,
            "compressed_size": content.size_bytes
        }

    service = ScriptService()

    try:
        # Compress content
        compressed_content = await service.compress_content(content.content)

        # Calculate new checksum
        new_checksum = service.calculate_checksum(compressed_content)

        # Update content
        content.content = compressed_content
        content.checksum = new_checksum
        content.content_type = "application/gzip"
        content.size_bytes = len(compressed_content.encode('utf-8'))

        await session.commit()

        return {
            "message": "Script content compressed successfully",
            "original_size": len(content.content),
            "compressed_size": content.size_bytes,
            "compression_ratio": f"{((len(content.content) - content.size_bytes) / len(content.content) * 100):.1f}%"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Compression failed: {str(e)}"
        )