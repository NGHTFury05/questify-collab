import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Shared axios instance for the app
export const api = axios.create({
  baseURL,
});

// Simple token store that syncs with localStorage
let authToken = localStorage.getItem('access_token') || null;
let refreshTokenStore = localStorage.getItem('refresh_token') || null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('access_token', token);
  } else {
    localStorage.removeItem('access_token');
  }
}

export function setRefreshToken(token) {
  refreshTokenStore = token;
  if (token) {
    localStorage.setItem('refresh_token', token);
  } else {
    localStorage.removeItem('refresh_token');
  }
}

function getRefreshToken() {
  return refreshTokenStore || localStorage.getItem('refresh_token');
}

// single-flight refresh control
let isRefreshing = false;
let refreshPromise = null;

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Basic response interceptor (optional place for global error handling)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {};
    const status = error?.response?.status;

    // Attempt token refresh once on 401
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const rt = getRefreshToken();
      if (!rt) {
        // No refresh token available; clear and fail
        setAuthToken(null);
        setRefreshToken(null);
        return Promise.reject(error);
      }

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          // Use bare axios to avoid interceptors and stale Authorization header
          refreshPromise = axios.post(`${baseURL}/auth/refresh`, { refresh_token: rt });
        }
        const resp = await refreshPromise;
        const newAccess = resp?.data?.access_token;
        const newRefresh = resp?.data?.refresh_token || rt;

        if (!newAccess) {
          throw new Error('No access_token returned from refresh');
        }

        // Persist new tokens
        setAuthToken(newAccess);
        setRefreshToken(newRefresh);

        // Retry original request with new Authorization
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (e) {
        // Refresh failed; clear tokens
        setAuthToken(null);
        setRefreshToken(null);
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    }

    return Promise.reject(error);
  }
);

// Convenience API wrappers for AI and Community features

// AI
export async function aiGenerateBlueprint(payload) {
  const { data } = await api.post('/ai/generate-blueprint', payload);
  return data;
}

export async function aiGenerateLesson(payload) {
  const { data } = await api.post('/ai/generate-lesson', payload);
  return data;
}

export async function aiGenerateQuiz(payload) {
  const { data } = await api.post('/ai/generate-quiz', payload);
  return data;
}

// Community
export async function listPostsByTopic(topic) {
  const { data } = await api.get(`/community/posts/${encodeURIComponent(topic)}`);
  return data;
}

export async function createCommunityPost({ topic, title, content, tags = [] }) {
  const { data } = await api.post('/community/posts', { topic, title, content, tags });
  return data;
}

export async function getPostWithAnswers(postId) {
  const { data } = await api.get(`/community/post/${postId}`);
  return data;
}

export async function createAnswer({ post_id, content }) {
  const { data } = await api.post('/community/answers', { post_id, content });
  return data;
}

export async function markAnswerAsSolution(answerId) {
  const { data } = await api.put(`/community/answers/${answerId}/mark-solution`);
  return data;
}

// Community Feed & Social APIs

export async function getFeed(params = {}) {
  const {
    q,
    tags = [],
    expandSimilar = false,
    view,
    unanswered = false,
    hasSolution = false,
  } = params || {};

  const qs = new URLSearchParams();
  if (q && String(q).trim()) qs.set('q', String(q).trim());
  if (Array.isArray(tags) && tags.length) qs.set('tags', tags.join(','));
  if (expandSimilar) qs.set('expand_similar', 'true');
  if (view && String(view).trim()) qs.set('view', String(view).trim());
  if (unanswered) qs.set('unanswered', 'true');
  if (hasSolution) qs.set('has_solution', 'true');

  const url = qs.toString() ? `/community/feed?${qs.toString()}` : '/community/feed';
  const { data } = await api.get(url);
  return data;
}

export async function recordInterest(topic, delta = 1) {
  await api.post('/community/interest', { topic, delta });
  return true;
}

// Friend system
export async function sendFriendInviteBy({ user_id, username, email }) {
  const payload = {};
  if (user_id) payload.target_user_id = user_id;
  if (username) payload.username = username;
  if (email) payload.email = email;
  const { data } = await api.post('/community/friend-invite', payload);
  return data;
}

// Back-compat helper: invite by UUID only
export async function sendFriendInvite(target_user_id) {
  return sendFriendInviteBy({ user_id: target_user_id });
}

export async function listFriendRequests() {
  const { data } = await api.get('/community/friend-requests');
  return data;
}

export async function respondFriendInvite({ request_id, action }) {
  const { data } = await api.post('/community/friend-action', { request_id, action });
  return data;
}

export async function listFriends() {
  const { data } = await api.get('/community/friends');
  return data;
}

// Search users by username or email (server dedupes and limits)
export async function searchUsers(q, limit = 8) {
  const qs = new URLSearchParams();
  if (q && String(q).trim()) qs.set('q', String(q).trim());
  if (limit) qs.set('limit', String(limit));
  const { data } = await api.get(`/community/users/search?${qs.toString()}`);
  return data; // Array<{ id, username, email }>
}

// Messaging (only between accepted friends)
export async function sendMessage({ recipient_id, content }) {
  const { data } = await api.post('/community/messages', { recipient_id, content });
  return data;
}

export async function getThread(friend_id) {
  const { data } = await api.get(`/community/threads/${friend_id}`);
  return data;
}

/* Tag utilities */

// Suggest tags for a given query/title/content using AI (with server-side fallback)
export async function suggestTags(q) {
  const qs = new URLSearchParams();
  if (q && String(q).trim()) qs.set('q', String(q).trim());
  const { data } = await api.get(`/community/tags/suggest?${qs.toString()}`);
  return data; // { tags: string[] }
}

// Expand one or more tags with similar tags using AI (with server-side fallback)
export async function similarTags(tags) {
  const list = Array.isArray(tags)
    ? tags
    : String(tags || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  const qs = new URLSearchParams();
  if (list.length) qs.set('tags', list.join(','));
  const { data } = await api.get(`/community/tags/similar?${qs.toString()}`);
  return data; // { tags: string[] }
}

/* Voting */
export async function votePost(postId, vote) {
  const { data } = await api.post(`/community/posts/${postId}/vote`, { vote });
  return data; // { upvotes, downvotes, total }
}

export async function getPostVotes(postId) {
  const { data } = await api.get(`/community/posts/${postId}/votes`);
  return data; // { upvotes, downvotes, total }
}

export async function voteAnswer(answerId, vote) {
  const { data } = await api.post(`/community/answers/${answerId}/vote`, { vote });
  return data; // { upvotes, downvotes, total }
}

export async function getAnswerVotes(answerId) {
  const { data } = await api.get(`/community/answers/${answerId}/votes`);
  return data; // { upvotes, downvotes, total }
}

/* Flagging */
export async function flagPost(postId, reason) {
  const { data } = await api.post(`/community/posts/${postId}/flag`, { reason });
  return data; // { ok: true }
}

export async function flagAnswer(answerId, reason) {
  const { data } = await api.post(`/community/answers/${answerId}/flag`, { reason });
  return data; // { ok: true }
}

/* Community Notes */
export async function addCommunityNote({ entity_type, entity_id, content }) {
  const { data } = await api.post('/community/notes', { entity_type, entity_id, content });
  return data; // CommunityNoteOut
}

export async function listCommunityNotes({ entity_type, entity_id }) {
  const qs = new URLSearchParams();
  qs.set('entity_type', entity_type);
  qs.set('entity_id', String(entity_id));
  const { data } = await api.get(`/community/notes?${qs.toString()}`);
  return data; // CommunityNoteOut[]
}

/* Lesson Completion for personalization */
export async function recordLessonCompletion(payload) {
  // payload: { course_title?, module_title?, keywords?: string[], completed_at? }
  const { data } = await api.post('/community/lesson-completion', payload);
  return data;
}
