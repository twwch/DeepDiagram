from typing import Optional
from datetime import datetime, timezone
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.user import User

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_user(
        self,
        user_id: str,
        auth_type: str = "google",
        user_info: Optional[dict] = None
    ) -> User:
        """Get existing user or create new one."""
        # Try to find existing user
        result = await self.db.execute(
            select(User).where(User.user_id == user_id)
        )
        user = result.scalar_one_or_none()

        if user:
            # Update user_info and updated_at if provided
            if user_info:
                user.user_info = user_info
                user.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                self.db.add(user)
                await self.db.commit()
                await self.db.refresh(user)
            return user

        # Create new user
        user = User(
            user_id=user_id,
            type=auth_type,
            user_info=user_info
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by their OAuth user_id."""
        result = await self.db.execute(
            select(User).where(User.user_id == user_id)
        )
        return result.scalar_one_or_none()
