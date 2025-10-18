import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  useColorModeValue,
  Spinner,
} from '@chakra-ui/react';

/**
 * ChatPane
 *
 * Props:
 * - friendId: string | null
 * - thread: { friend_id: string, messages: Array<{ id, sender_id, content, created_at }> } | null
 * - onSend: (text: string) => Promise<void>
 * - onSeen: () => void
 */
export default function ChatPane({ friendId, thread, onSend, onSeen }) {
  const border = useColorModeValue('blackAlpha.200', 'whiteAlpha.300');
  const meBubbleBg = useColorModeValue('teal.500', 'teal.400');
  const meText = useColorModeValue('white', 'black');
  const otherBubbleBg = useColorModeValue('gray.100', 'whiteAlpha.200');
  const otherText = useColorModeValue('gray.800', 'white');

  const listRef = useRef(null);
  const atBottomRef = useRef(true);

  const [text, setText] = useState('');
  const messages = useMemo(() => thread?.messages || [], [thread]);

  // Track whether user is near bottom
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 60;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  // Auto-scroll when new messages arrive only if near bottom
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Mark seen when the pane becomes active or when the user scrolls to bottom
  useEffect(() => {
    // on initial mount when thread changes
    if (typeof onSeen === 'function') onSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId]);

  const handleSend = async () => {
    const t = String(text || '').trim();
    if (!t) return;
    await onSend?.(t);
    setText('');
    // After sending, we will be at bottom; mark seen
    onSeen?.();
  };

  if (!friendId) {
    return <Text color="gray.500">Select a friend to start chatting</Text>;
  }

  if (!thread) {
    return (
      <Box textAlign="center" py={6}>
        <Spinner size="sm" />
      </Box>
    );
  }

  return (
    <VStack align="stretch" spacing={3}>
      <Box
        ref={listRef}
        onScroll={onScroll}
        maxH="55vh"
        overflowY="auto"
        p={2}
        border="1px solid"
        borderColor={border}
        borderRadius="md"
        aria-label="Chat messages"
      >
        {messages.length === 0 ? (
          <Text color="gray.500">No messages yet</Text>
        ) : (
          <VStack align="stretch" spacing={3}>
            {messages.map((m) => {
              const isMe = m.sender_id && thread?.self_id ? m.sender_id === thread.self_id : false;
              // Fallback: if no self_id provided by API, infer "me" if sender_id !== friendId
              const meInfer = m.sender_id !== friendId;
              const mine = isMe || meInfer;

              return (
                <Box
                  key={m.id}
                  alignSelf={mine ? 'flex-end' : 'flex-start'}
                  maxW="80%"
                >
                  <Box
                    p={2.5}
                    bg={mine ? meBubbleBg : otherBubbleBg}
                    color={mine ? meText : otherText}
                    borderRadius="md"
                  >
                    <Text whiteSpace="pre-wrap">{m.content}</Text>
                  </Box>
                  <Text fontSize="xs" color="gray.500" mt={1} textAlign={mine ? 'right' : 'left'}>
                    {new Date(m.created_at).toLocaleString()}
                  </Text>
                </Box>
              );
            })}
          </VStack>
        )}
      </Box>

      <HStack>
        <Input
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend} colorScheme="teal">Send</Button>
      </HStack>
    </VStack>
  );
}