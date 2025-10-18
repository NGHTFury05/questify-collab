from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# =========================
# Auth Schemas
# =========================

class SignupRequest(BaseModel):
    email: str
    password: str
    username: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserInfo(BaseModel):
    id: str
    email: Optional[str] = None
    username: Optional[str] = None
    reputation_score: Optional[int] = 0


class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserInfo] = None
    message: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


# =========================
# AI Schemas
# =========================

class BlueprintRequest(BaseModel):
    goal_type: str
    topic: str
    level: str
    objective: str


class LessonRequest(BaseModel):
    course_title: str
    module_title: str
    level: str


class QuizRequest(BaseModel):
    # lesson_content should be the JSON of the generated lesson
    lesson_content: Dict[str, Any]


# =========================
# Community Schemas
# =========================

class PostCreate(BaseModel):
    topic: str
    title: str
    content: str
    # Up to 8 tags; sanitized to lowercase in the API layer
    tags: List[str] = Field(default_factory=list)


class PostOut(BaseModel):
    id: int
    user_id: str
    topic: str
    title: str
    content: str
    created_at: str
    tags: List[str] = Field(default_factory=list)


class AnswerCreate(BaseModel):
    post_id: int
    content: str


class AnswerOut(BaseModel):
    id: int
    post_id: int
    user_id: str
    content: str
    is_helpful_solution: bool
    created_at: str


class PostWithAnswers(BaseModel):
    post: PostOut
    answers: List[AnswerOut] = Field(default_factory=list)

class AnswerWithVotes(AnswerOut):
    upvotes: int = 0
    downvotes: int = 0


class PostOutDetailed(PostOut):
    upvotes: int = 0
    downvotes: int = 0
    answers_count: int = 0
    solutions_count: int = 0
    disputed: bool = False


class PostWithAnswersDetailed(BaseModel):
    post: PostOutDetailed
    answers: List[AnswerWithVotes] = Field(default_factory=list)

class TopicInteraction(BaseModel):
    topic: str
    delta: Optional[int] = 1


class FeedPost(PostOut):
    author_username: Optional[str] = None
    score: float = 0.0
    upvotes: int = 0
    downvotes: int = 0
    answers_count: int = 0
    solutions_count: int = 0
    disputed: bool = False


class FeedResponse(BaseModel):
    posts: List[FeedPost] = Field(default_factory=list)


class FriendInviteRequest(BaseModel):
    # Invite can be sent using ANY of these (priority: user_id > username > email)
    target_user_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None


class FriendActionRequest(BaseModel):
    request_id: int
    action: str  # accept | reject


class FriendRequestOut(BaseModel):
    id: int
    requester_id: str
    addressee_id: str
    status: str
    created_at: str
    updated_at: str

# Lightweight user record for search/autocomplete
class UserSearchResult(BaseModel):
    id: str
    username: Optional[str] = None
    email: Optional[str] = None


class FriendshipSummary(BaseModel):
    friend_id: str
    friend_username: Optional[str] = None
    status: str


class MessageCreate(BaseModel):
    recipient_id: str
    content: str


class MessageOut(BaseModel):
    id: int
    sender_id: str
    recipient_id: str
    content: str
    created_at: str


class ThreadOut(BaseModel):
    friend_id: str
    friend_username: Optional[str] = None
    messages: List[MessageOut] = Field(default_factory=list)

# =========================
# Community Quality & Personalization Schemas
# =========================

class VoteRequest(BaseModel):
    vote: Optional[int] = Field(default=None, description="-1 for downvote, 1 for upvote, 0 or None to remove")


class VoteSummary(BaseModel):
    upvotes: int
    downvotes: int
    total: int


class FlagRequest(BaseModel):
    reason: Optional[str] = None


class CommunityNoteCreate(BaseModel):
    entity_type: str  # 'post' or 'answer'
    entity_id: int
    content: str


class CommunityNoteOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    user_id: str
    content: str
    created_at: str


class LessonCompletionCreate(BaseModel):
    course_title: Optional[str] = None
    module_title: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    completed_at: Optional[str] = None  # ISO timestamp; server defaults to now if omitted


class LessonCompletionOut(BaseModel):
    id: int
    user_id: str
    course_title: Optional[str] = None
    module_title: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    completed_at: str
    created_at: str
# =========================
# AI Response Schemas
# =========================

class BlueprintModule(BaseModel):
    id: int
    title: str
    description: Optional[str] = None


class BlueprintOut(BaseModel):
    course_title: str
    modules: List[BlueprintModule] = Field(default_factory=list)


class LessonDetail(BaseModel):
    heading: str
    description: str


class LessonContent(BaseModel):
    overview: Optional[str] = ""
    key_concepts: List[str] = Field(default_factory=list)
    important_details: List[LessonDetail] = Field(default_factory=list)
    summary: Optional[str] = ""


class LessonOut(BaseModel):
    module_title: Optional[str] = None
    lesson_content: LessonContent


class QuizQuestion(BaseModel):
    question_text: str
    options: List[str] = Field(default_factory=list)
    correct_answer_index: int
    explanation: Optional[str] = None


class QuizOut(BaseModel):
    quiz_title: Optional[str] = None
    questions: List[QuizQuestion] = Field(default_factory=list)

# =========================
# Boards/Kanban Schemas
# =========================

class BoardCreate(BaseModel):
    title: str


class BoardOut(BaseModel):
    id: int
    user_id: str
    title: str
    created_at: str


class ColumnCreate(BaseModel):
    board_id: int
    title: str
    position: Optional[int] = None


class ColumnOut(BaseModel):
    id: int
    board_id: int
    title: str
    position: int
    created_at: str


class CardCreate(BaseModel):
    column_id: int
    title: str
    description: Optional[str] = None
    position: Optional[int] = None


class CardOut(BaseModel):
    id: int
    column_id: int
    user_id: str
    title: str
    description: Optional[str] = None
    position: int
    created_at: str


class CardMove(BaseModel):
    card_id: int
    to_column_id: int
    to_position: Optional[int] = None


class BoardFull(BaseModel):
    board: BoardOut
    columns: List[ColumnOut] = Field(default_factory=list)
    cards: List[CardOut] = Field(default_factory=list)