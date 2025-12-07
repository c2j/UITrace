"""
Script serialization and storage service
T031: Implement script serialization and storage
"""

import json
import gzip
import base64
import hashlib
from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from uuid import UUID
import structlog

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field, validator

from ..models.script import Script, ScriptContent
from ..models.user import User
from ..models.project import Project

logger = structlog.get_logger()

class TestStepSchema(BaseModel):
    """Schema for individual test step"""
    id: str = Field(..., description="Unique step identifier")
    action: str = Field(..., description="Action type (click, type, etc.)")
    type: Optional[str] = Field(None, description="Step type for categorization")
    target_element: Optional[Dict[str, Any]] = Field(None, description="Target element information")
    value: Optional[str] = Field(None, description="Input value or parameter")
    selectors: List[Dict[str, Any]] = Field(default_factory=list, description="Element selectors")
    wait_time: Optional[int] = Field(None, description="Wait time in milliseconds")
    duration: Optional[int] = Field(None, description="Duration for wait actions")
    url: Optional[str] = Field(None, description="URL for navigation actions")
    script: Optional[str] = Field(None, description="JavaScript code for execution")
    screenshot: Optional[str] = Field(None, description="Screenshot data")
    order_index: int = Field(..., description="Step execution order")
    description: Optional[str] = Field(None, description="Step description")

    @validator('action')
    def validate_action(cls, v):
        valid_actions = [
            'click', 'type', 'navigate', 'scroll', 'wait', 'hover',
            'double_click', 'right_click', 'select', 'upload_file',
            'screenshot', 'javascript'
        ]
        if v not in valid_actions:
            raise ValueError(f"Invalid action: {v}. Must be one of {valid_actions}")
        return v

class ScriptContentSchema(BaseModel):
    """Schema for script content validation"""
    steps: List[TestStepSchema] = Field(..., description="List of test steps")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")

    @validator('steps')
    def validate_steps(cls, v):
        if not v:
            raise ValueError("Script must contain at least one step")

        # Validate order indices
        order_indices = [step.order_index for step in v]
        if len(set(order_indices)) != len(order_indices):
            raise ValueError("Step order indices must be unique")

        if sorted(order_indices) != list(range(len(v))):
            raise ValueError("Step order indices must be sequential starting from 0")

        return v

class ScriptSerializationOptions(BaseModel):
    """Options for script serialization"""
    format: str = Field("json", description="Serialization format (json, yaml, compressed)")
    compress: bool = Field(False, description="Whether to compress the content")
    include_metadata: bool = Field(True, description="Include metadata in serialization")
    validate_schema: bool = Field(True, description="Validate against schema")

class ScriptImportExportOptions(BaseModel):
    """Options for script import/export operations"""
    format: str = Field("json", description="Export format (json, yaml, csv)")
    include_content: bool = Field(True, description="Include script content")
    include_metadata: bool = Field(True, description="Include metadata")
    compress: bool = Field(False, description="Compress exported data")

class ScriptService:
    """
    Service for script serialization, storage, and validation
    """

    def __init__(self):
        self.logger = logger.bind(service="ScriptService")

    async def validate_script_content(self, content: str, content_type: str = "application/json") -> bool:
        """
        Validate script content against schema

        Args:
            content: Script content as string
            content_type: Content type (application/json, application/yaml, etc.)

        Returns:
            True if content is valid

        Raises:
            ValueError: If content is invalid
        """
        try:
            if content_type == "application/json":
                data = json.loads(content)
            else:
                # For now, only support JSON
                raise ValueError(f"Unsupported content type: {content_type}")

            # Validate against schema
            ScriptContentSchema(**data)
            return True

        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON content: {str(e)}")
        except Exception as e:
            raise ValueError(f"Content validation failed: {str(e)}")

    async def compress_content(self, content: str) -> str:
        """
        Compress content using gzip and base64 encoding

        Args:
            content: Content to compress

        Returns:
            Compressed content as base64 string
        """
        try:
            # Compress with gzip
            compressed = gzip.compress(content.encode('utf-8'))

            # Encode to base64 for storage
            encoded = base64.b64encode(compressed).decode('utf-8')

            self.logger.info("Content compressed",
                           original_size=len(content),
                           compressed_size=len(encoded))

            return encoded

        except Exception as e:
            self.logger.error("Content compression failed", error=str(e))
            raise ValueError(f"Failed to compress content: {str(e)}")

    async def decompress_content(self, compressed_content: str) -> str:
        """
        Decompress content that was compressed with gzip and base64

        Args:
            compressed_content: Base64 encoded compressed content

        Returns:
            Decompressed content string
        """
        try:
            # Decode from base64
            compressed = base64.b64decode(compressed_content.encode('utf-8'))

            # Decompress with gzip
            decompressed = gzip.decompress(compressed).decode('utf-8')

            self.logger.info("Content decompressed",
                           compressed_size=len(compressed_content),
                           decompressed_size=len(decompressed))

            return decompressed

        except Exception as e:
            self.logger.error("Content decompression failed", error=str(e))
            raise ValueError(f"Failed to decompress content: {str(e)}")

    def calculate_checksum(self, content: str) -> str:
        """
        Calculate SHA-256 checksum of content

        Args:
            content: Content to checksum

        Returns:
            Hexadecimal checksum string
        """
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    async def serialize_script(
        self,
        script: Script,
        session: AsyncSession,
        options: ScriptSerializationOptions = ScriptSerializationOptions()
    ) -> Dict[str, Any]:
        """
        Serialize script with content and metadata

        Args:
            script: Script model instance
            session: Database session
            options: Serialization options

        Returns:
            Serialized script data
        """
        try:
            # Get script content
            content_query = select(ScriptContent).where(ScriptContent.script_id == script.id)
            content_result = await session.execute(content_query)
            script_content = content_result.scalar_one_or_none()

            if not script_content:
                raise ValueError(f"Script content not found for script {script.id}")

            content = script_content.content

            # Validate content if requested
            if options.validate_schema:
                await self.validate_script_content(content, script_content.content_type)

            # Compress content if requested
            if options.compress:
                content = await self.compress_content(content)

            # Build serialized data
            serialized_data = {
                "id": str(script.id),
                "name": script.name,
                "description": script.description,
                "version": script.version,
                "author_id": str(script.author_id),
                "project_id": str(script.project_id) if script.project_id else None,
                "status": script.status,
                "tags": script.tags.split(",") if script.tags else [],
                "created_at": script.created_at.isoformat(),
                "updated_at": script.updated_at.isoformat(),
            }

            # Add content if requested
            if options.include_metadata:
                serialized_data.update({
                    "content": content,
                    "content_type": script_content.content_type,
                    "checksum": script_content.checksum,
                    "size_bytes": script_content.size_bytes,
                    "compressed": options.compress,
                })

            self.logger.info("Script serialized successfully",
                           script_id=str(script.id),
                           format=options.format,
                           compressed=options.compress)

            return serialized_data

        except Exception as e:
            self.logger.error("Script serialization failed",
                           script_id=str(script.id),
                           error=str(e))
            raise ValueError(f"Failed to serialize script: {str(e)}")

    async def deserialize_script(
        self,
        serialized_data: Dict[str, Any],
        session: AsyncSession,
        user_id: str
    ) -> Script:
        """
        Deserialize script data and create/update script in database

        Args:
            serialized_data: Serialized script data
            session: Database session
            user_id: User ID creating/updating the script

        Returns:
            Created/updated Script instance
        """
        try:
            # Extract content
            content = serialized_data.get("content")
            if not content:
                raise ValueError("Script content is required")

            # Decompress content if needed
            if serialized_data.get("compressed", False):
                content = await self.decompress_content(content)

            # Validate content
            await self.validate_script_content(content)

            # Calculate checksum
            checksum = self.calculate_checksum(content)

            # Create or update script
            script_id = serialized_data.get("id")
            if script_id:
                # Update existing script
                script = await self._update_script_from_data(
                    UUID(script_id), serialized_data, content, checksum, session
                )
            else:
                # Create new script
                script = await self._create_script_from_data(
                    serialized_data, content, checksum, session, user_id
                )

            self.logger.info("Script deserialized successfully",
                           script_id=str(script.id),
                           operation="update" if script_id else "create")

            return script

        except Exception as e:
            self.logger.error("Script deserialization failed",
                           error=str(e))
            raise ValueError(f"Failed to deserialize script: {str(e)}")

    async def _create_script_from_data(
        self,
        data: Dict[str, Any],
        content: str,
        checksum: str,
        session: AsyncSession,
        user_id: str
    ) -> Script:
        """Create new script from deserialized data"""
        from ..models.user import User

        # Validate user
        user_query = select(User).where(User.id == UUID(user_id))
        user_result = await session.execute(user_query)
        user = user_result.scalar_one_or_none()

        if not user:
            raise ValueError(f"User {user_id} not found")

        # Create script
        new_script = Script(
            name=data.get("name", "Untitled Script"),
            description=data.get("description"),
            version=data.get("version", "1.0.0"),
            author_id=user.id,
            project_id=UUID(data["project_id"]) if data.get("project_id") else None,
            status=data.get("status", "draft"),
            tags=",".join(data.get("tags", [])),
        )

        session.add(new_script)
        await session.flush()

        # Create script content
        script_content = ScriptContent(
            script_id=new_script.id,
            content=content,
            checksum=checksum,
            content_type="application/json",
            size_bytes=len(content.encode('utf-8'))
        )

        session.add(script_content)
        await session.commit()

        return new_script

    async def _update_script_from_data(
        self,
        script_id: UUID,
        data: Dict[str, Any],
        content: str,
        checksum: str,
        session: AsyncSession
    ) -> Script:
        """Update existing script from deserialized data"""
        # Get existing script
        script_query = select(Script).where(Script.id == script_id)
        script_result = await session.execute(script_query)
        script = script_result.scalar_one_or_none()

        if not script:
            raise ValueError(f"Script {script_id} not found")

        # Update script metadata
        if "name" in data:
            script.name = data["name"]
        if "description" in data:
            script.description = data["description"]
        if "version" in data:
            script.version = data["version"]
        if "status" in data:
            script.status = data["status"]
        if "tags" in data:
            script.tags = ",".join(data["tags"])
        if "project_id" in data:
            script.project_id = UUID(data["project_id"]) if data["project_id"] else None

        script.updated_at = datetime.utcnow()

        # Update script content
        content_query = select(ScriptContent).where(ScriptContent.script_id == script_id)
        content_result = await session.execute(content_query)
        script_content = content_result.scalar_one_or_none()

        if script_content:
            script_content.content = content
            script_content.checksum = checksum
            script_content.size_bytes = len(content.encode('utf-8'))

        await session.commit()

        return script

    async def export_scripts(
        self,
        script_ids: List[str],
        session: AsyncSession,
        options: ScriptImportExportOptions = ScriptImportExportOptions()
    ) -> Dict[str, Any]:
        """
        Export multiple scripts for backup or sharing

        Args:
            script_ids: List of script IDs to export
            session: Database session
            options: Export options

        Returns:
            Exported scripts data
        """
        try:
            exported_scripts = []

            for script_id in script_ids:
                script_query = select(Script).where(Script.id == UUID(script_id))
                script_result = await session.execute(script_query)
                script = script_result.scalar_one_or_none()

                if not script:
                    self.logger.warning(f"Script {script_id} not found, skipping")
                    continue

                # Serialize script
                serialized = await self.serialize_script(
                    script,
                    session,
                    ScriptSerializationOptions(
                        compress=options.compress,
                        include_metadata=options.include_metadata
                    )
                )

                exported_scripts.append(serialized)

            export_data = {
                "export_version": "1.0",
                "export_timestamp": datetime.utcnow().isoformat(),
                "total_scripts": len(exported_scripts),
                "scripts": exported_scripts
            }

            self.logger.info("Scripts exported successfully",
                           total_scripts=len(exported_scripts))

            return export_data

        except Exception as e:
            self.logger.error("Script export failed", error=str(e))
            raise ValueError(f"Failed to export scripts: {str(e)}")

    async def import_scripts(
        self,
        import_data: Dict[str, Any],
        session: AsyncSession,
        user_id: str
    ) -> List[Script]:
        """
        Import scripts from exported data

        Args:
            import_data: Exported scripts data
            session: Database session
            user_id: User ID importing the scripts

        Returns:
            List of imported scripts
        """
        try:
            # Validate import data
            if "scripts" not in import_data:
                raise ValueError("Invalid import data: missing scripts")

            scripts_data = import_data["scripts"]
            if not isinstance(scripts_data, list):
                raise ValueError("Invalid import data: scripts must be a list")

            imported_scripts = []

            for script_data in scripts_data:
                try:
                    # Remove ID to create new script
                    if "id" in script_data:
                        del script_data["id"]

                    # Deserialize and create script
                    script = await self.deserialize_script(script_data, session, user_id)
                    imported_scripts.append(script)

                except Exception as e:
                    self.logger.warning(f"Failed to import script",
                                      error=str(e),
                                      script_name=script_data.get("name", "unknown"))
                    continue

            self.logger.info("Scripts imported successfully",
                           total_imported=len(imported_scripts),
                           total_attempted=len(scripts_data))

            return imported_scripts

        except Exception as e:
            self.logger.error("Script import failed", error=str(e))
            raise ValueError(f"Failed to import scripts: {str(e)}")

    async def get_script_statistics(self, session: AsyncSession) -> Dict[str, Any]:
        """
        Get statistics about scripts in the system

        Args:
            session: Database session

        Returns:
            Script statistics
        """
        try:
            # Total scripts count
            total_query = select(func.count(Script.id))
            total_result = await session.execute(total_query)
            total_scripts = total_result.scalar()

            # Scripts by status
            status_query = select(Script.status, func.count(Script.id)).group_by(Script.status)
            status_result = await session.execute(status_query)
            status_counts = dict(status_result.fetchall())

            # Average script size
            size_query = select(func.avg(ScriptContent.size_bytes)).join(ScriptContent)
            size_result = await session.execute(size_query)
            avg_size = size_result.scalar() or 0

            # Total storage used
            storage_query = select(func.sum(ScriptContent.size_bytes)).join(ScriptContent)
            storage_result = await session.execute(storage_query)
            total_storage = storage_result.scalar() or 0

            return {
                "total_scripts": total_scripts,
                "status_distribution": status_counts,
                "average_size_bytes": int(avg_size),
                "total_storage_bytes": int(total_storage),
                "statistics_timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            self.logger.error("Failed to get script statistics", error=str(e))
            raise ValueError(f"Failed to get script statistics: {str(e)}")