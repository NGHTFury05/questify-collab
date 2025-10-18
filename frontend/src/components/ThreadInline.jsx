import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Button,
  Select,
  Textarea,
  Divider,
  Spinner,
  Alert,
  useColorModeValue,
  IconButton,
  Badge,
} from '@chakra-ui/react';
import { CloseIcon } from '@chakra-ui/icons';
import { getPostWithAnswers, createAnswer } from '../lib/api';

/**
 * ThreadInline
 * Inline, independently scrollable discussion thread for a Feed post.
 *
 * Props:
 * - postId: number (required)
 * - isOpen: boolean
 * - onClose: () => void
 * - initialSort: 'top' | 'newest'
 * - initialExpandedPath: string[] (unused in linear fallback, reserved for future nesting)
 * - onCountUpdate?: (count: number) => void
 */
export default function ThreadInline({
  postId,
  isOpen = false,
  onClose,
  initialSort = 'newest',
  initialExpandedPath = [],
  onCountUpdate,
}) {
  const border = useColorModeValue('blackAlpha.200', 'whiteAlpha.300');
  const subtleBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100');
  const headerBg = useColorModeValue('white', 'rgba(15, 23, 42, 0.55)');

  // Guard: do not render when closed
  if (!isOpen) return null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [post, setPost] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [sort, setSort] = useState(initialSort === 'top' ? 'top' : 'newest');

  const [newAnswer, setNewAnswer] = useState('');
  const [sending, setSending] = useState(false);

  const scrollRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const pollTimerRef = useRef(null);

  const computeIsNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    const threshold = 60; // px
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  const onScroll = () => {
    isAtBottomRef.current = computeIsNearBottom();
  };

  const fetchThread = useCallback(async (signal) => {
    if (!postId) return;
    setError('');
    try {
      const data = await getPostWithAnswers(postId);
      // data shape expected: { post, answers }
      const a = Array.isArray(data?.answers) ? data.answers : [];
      setPost(data?.post || null);
      setAnswers(a);
      if (typeof onCountUpdate === 'function') {
        onCountUpdate(a.length);
      }
    } catch (e) {
      if (signal?.aborted) return;
      const msg = e?.response?.data?.detail || e?.message || 'Failed to load thread';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [postId, onCountUpdate]);

  useEffect(() => {
    let abort = new AbortController();
    setLoading(true);
    fetchThread(abort.signal);

    // Poll while open
    pollTimerRef.current = setInterval(() => {
      fetchThread(abort.signal);
    }, 15000); // 15s

    return () => {
      abort.abort();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchThread]);

  // Auto-scroll to bottom on first load; on subsequent updates, only if near bottom previously
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      // scroll to bottom
      el.scrollTop = el.scrollHeight;
    }
  }, [answers?.length]);

  const sortedAnswers = useMemo(() => {
    const arr = Array.isArray(answers) ? [...answers] : [];
    if (sort === 'top') {
      // Sort by (upvotes - downvotes) desc, then newest
      arr.sort((a, b) => {
        const as = (a.upvotes || 0) - (a.downvotes || 0);
        const bs = (b.upvotes || 0) - (b.downvotes || 0);
        if (bs !== as) return bs - as;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else {
      // newest
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return arr;
  }, [answers, sort]);

  const handleSend = async () => {
    const content = String(newAnswer || '').trim();
    if (!content) return;
    setSending(true);
    try {
      await createAnswer({ post_id: Number(postId), content });
      setNewAnswer('');
      // Optimistically append to bottom (newest)
      const msg = {
        id: `temp-${Date.now()}`,
        user_id: 'you',
        content,
        created_at: new Date().toISOString(),
        upvotes: 0,
        downvotes: 0,
      };
      setAnswers((prev) => [...prev, msg]);
      if (typeof onCountUpdate === 'function') {
        onCountUpdate((answers?.length || 0) + 1);
      }
      // Fetch fresh to sync real record
      fetchThread();
    } catch (e) {
      // Show inline error
      const msg = e?.response?.data?.detail || e?.message || 'Failed to send reply';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Box
      role="region"
      aria-label="Discussion thread"
      border="1px solid"
      borderColor={border}
      borderRadius="md"
      bg={subtleBg}
      overflow="hidden"
    >
      {/* Header */}
      <HStack
        justify="space-between"
        align="center"
        px={3}
        py={2}
        borderBottom="1px solid"
        borderColor={border}
        bg={headerBg}
      >
        <HStack spacing={3}>
          <Text fontWeight="semibold">Discussion</Text>
          {typeof answers?.length === 'number' && (
            <Badge colorScheme="purple">{answers.length}</Badge>
          )}
          <Select
            size="sm"
            value={sort}
            onChange={(e) => setSort(e.target.value === 'top' ? 'top' : 'newest')}
            aria-label="Sort replies"
          >
            <option value="newest">Newest</option>
            <option value="top">Top</option>
          </Select>
        </HStack>
        <IconButton
          aria-label="Close thread"
          icon={<CloseIcon boxSize={3} />}
          size="sm"
          variant="ghost"
          onClick={onClose}
        />
      </HStack>

      {/* Body */}
      {loading ? (
        <Box textAlign="center" py={6}>
          <Spinner size="sm" />
        </Box>
      ) : error ? (
        <Alert status="error" borderRadius={0}>{error}</Alert>
      ) : (
        <Box>
          {/* Post summary */}
          {post && (
            <Box px={3} py={2} borderBottom="1px solid" borderColor={border}>
              <Text fontWeight="semibold" noOfLines={1}>{post.title}</Text>
              <Text fontSize="sm" color="gray.500" noOfLines={2}>{post.content}</Text>
            </Box>
          )}

          {/* Messages list */}
          <Box
            ref={scrollRef}
            onScroll={onScroll}
            maxH="420px"
            overflowY="auto"
            px={3}
            py={2}
            aria-label="Thread messages"
          >
            {sortedAnswers.length === 0 ? (
              <Text color="gray.500">No replies yet. Be the first to respond.</Text>
            ) : (
              <VStack align="stretch" spacing={3}>
                {sortedAnswers.map((a) => (
                  <Box
                    key={a.id}
                    p={2}
                    border="1px solid"
                    borderColor={border}
                    borderRadius="md"
                    bg="transparent"
                  >
                    <HStack justify="space-between" align="start">
                      <Text fontSize="sm" color="gray.500">
                        {(a.author_username || a.user_id)} • {new Date(a.created_at).toLocaleString()}
                      </Text>
                      <HStack spacing={2}>
                        <Badge variant="subtle">▲ {a.upvotes || 0}</Badge>
                        <Badge variant="subtle">▼ {a.downvotes || 0}</Badge>
                      </HStack>
                    </HStack>
                    <Divider my={2} />
                    <Text whiteSpace="pre-wrap">{a.content}</Text>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>

          <Divider />

          {/* Composer */}
          <Box px={3} py={2}>
            <VStack align="stretch" spacing={2}>
              <Textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Write a reply…"
                minH="72px"
              />
              <HStack justify="flex-end">
                <Button onClick={handleSend} isLoading={sending} colorScheme="teal">
                  Reply
                </Button>
              </HStack>
            </VStack>
          </Box>
        </Box>
      )}
    </Box>
  );
}