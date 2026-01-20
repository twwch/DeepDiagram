from typing import Optional
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.chat import ChatSession, ChatMessage

class ChatService:
    def __init__(self, session: AsyncSession, user_id: Optional[str] = None):
        self.session = session
        self.user_id = user_id

    async def create_session(self, title: str = "New Chat") -> ChatSession:
        chat_session = ChatSession(title=title, user_id=self.user_id)
        self.session.add(chat_session)
        await self.session.commit()
        await self.session.refresh(chat_session)
        return chat_session

    async def get_session(self, session_id: int) -> ChatSession | None:
        statement = select(ChatSession).where(ChatSession.id == session_id)
        result = await self.session.exec(statement)
        session = result.first()
        # Verify ownership if user_id is set
        if session and self.user_id and session.user_id != self.user_id:
            return None
        return session

    async def verify_session_ownership(self, session_id: int) -> bool:
        """Verify that the current user owns this session."""
        session = await self.get_session(session_id)
        if not session:
            return False
        # Allow if no user_id filter (anonymous) and session has no user_id
        if not self.user_id and not session.user_id:
            return True
        # Allow if user_ids match
        return session.user_id == self.user_id

    async def add_message(
        self, 
        session_id: int, 
        role: str, 
        content: str, 
        images: list[str] | None = None,
        files: list[dict] | None = None,
        file_context: str | None = None,
        steps: list[any] | None = None,
        agent: str | None = None,
        parent_id: int | None = None
    ) -> ChatMessage:
        turn_index = 0
        if parent_id and parent_id > 0:
            parent_statement = select(ChatMessage).where(ChatMessage.id == parent_id)
            parent_result = await self.session.exec(parent_statement)
            parent = parent_result.first()
            if parent:
                turn_index = parent.turn_index + 1

        message = ChatMessage(
            session_id=session_id, 
            role=role, 
            content=content,
            images=images,
            files=files,
            file_context=file_context,
            steps=steps,
            agent=agent,
            parent_id=parent_id,
            turn_index=turn_index
        )
        self.session.add(message)
        
        # Update session updated_at
        from datetime import datetime, timezone
        statement = select(ChatSession).where(ChatSession.id == session_id)
        result = await self.session.exec(statement)
        chat_session = result.first()
        if chat_session:
            chat_session.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            self.session.add(chat_session)
            
        await self.session.commit()
        await self.session.refresh(message)
        return message

    async def update_message(self, message_id: int, **kwargs) -> ChatMessage | None:
        statement = select(ChatMessage).where(ChatMessage.id == message_id)
        result = await self.session.exec(statement)
        message = result.first()
        if message:
            for key, value in kwargs.items():
                if hasattr(message, key):
                    setattr(message, key, value)
            self.session.add(message)
            await self.session.commit()
            await self.session.refresh(message)
        return message

    async def get_history(self, session_id: int):
        statement = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
        result = await self.session.exec(statement)
        return result.all()

    async def get_all_sessions(self):
        # Filter by user_id if provided for data isolation
        if self.user_id:
            statement = select(ChatSession).where(ChatSession.user_id == self.user_id).order_by(ChatSession.updated_at.desc())
        else:
            # For anonymous users, show sessions without user_id
            statement = select(ChatSession).where(ChatSession.user_id == None).order_by(ChatSession.updated_at.desc())
        result = await self.session.exec(statement)
        return result.all()

    async def delete_session(self, session_id: int):
        # SQLModel/SQLAlchemy will handle cascade if configured, but let's be safe or just delete session
        # Actually ChatMessage has foreign key to chatsession.id. 
        # If we didn't specify ondelete="CASCADE" in models/chat.py, we should delete messages first.
        
        from sqlmodel import delete
        
        # Delete messages
        msg_statement = delete(ChatMessage).where(ChatMessage.session_id == session_id)
        await self.session.exec(msg_statement)
        
        # Delete session
        sess_statement = delete(ChatSession).where(ChatSession.id == session_id)
        await self.session.exec(sess_statement)
        
        await self.session.commit()
