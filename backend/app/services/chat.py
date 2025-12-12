from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.chat import ChatSession, ChatMessage

class ChatService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_session(self, title: str = "New Chat") -> ChatSession:
        chat_session = ChatSession(title=title)
        self.session.add(chat_session)
        await self.session.commit()
        await self.session.refresh(chat_session)
        return chat_session

    async def get_session(self, session_id: int) -> ChatSession | None:
        statement = select(ChatSession).where(ChatSession.id == session_id)
        result = await self.session.exec(statement)
        return result.first()

    async def add_message(self, session_id: int, role: str, content: str) -> ChatMessage:
        message = ChatMessage(session_id=session_id, role=role, content=content)
        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)
        return message

    async def get_history(self, session_id: int):
        statement = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
        result = await self.session.exec(statement)
        return result.all()
