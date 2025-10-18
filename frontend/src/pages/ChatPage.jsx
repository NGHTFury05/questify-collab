import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  Card,
  CardBody,
  Stack,
  HStack,
  VStack,
  Input,
  Button,
  Alert,
  Badge,
  Divider,
  Spinner,
} from '@chakra-ui/react';
import {
  listFriendRequests,
  respondFriendInvite,
  listFriends,
  getThread,
  sendMessage,
  sendFriendInvite,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function ChatPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Friend requests
  const [requests, setRequests] = useState([]);
  const [reqError, setReqError] = useState('');

  // Friends
  const [friends, setFriends] = useState([]);
  const [friendsError, setFriendsError] = useState('');

  // Thread
  const [activeFriend, setActiveFriend] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadError, setThreadError] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Invite
  const [inviteId, setInviteId] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSending, setInviteSending] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load friend requests and friends in parallel
      const [reqs, frs] = await Promise.all([
        listFriendRequests().catch((e) => {
          const msg = e?.response?.data?.detail || e?.message || 'Failed to load requests';
          setReqError(msg);
          return [];
        }),
        listFriends().catch((e) => {
          const msg = e?.response?.data?.detail || e?.message || 'Failed to load friends';
          setFriendsError(msg);
          return [];
        }),
      ]);
      setRequests(reqs || []);
      setFriends(frs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openThread = async (friendId) => {
    setThreadError('');
    setThread(null);
    setActiveFriend(friendId);
    try {
      const t = await getThread(friendId);
      setThread(t);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to load thread';
      setThreadError(msg);
    }
  };

  const acceptRequest = async (request_id) => {
    try {
      await respondFriendInvite({ request_id, action: 'accepted' });
      await loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to accept request';
      setReqError(msg);
    }
  };

  const rejectRequest = async (request_id) => {
    try {
      await respondFriendInvite({ request_id, action: 'rejected' });
      await loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to reject request';
      setReqError(msg);
    }
  };

  const sendMsg = async () => {
    if (!activeFriend || !messageText.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessage({ recipient_id: activeFriend, content: messageText.trim() });
      setMessageText('');
      // append locally
      setThread((t) => {
        const next = t ? { ...t } : { friend_id: activeFriend, messages: [] };
        next.messages = [...(next.messages || []), msg];
        return next;
      });
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to send message';
      setThreadError(msg);
    } finally {
      setSending(false);
    }
  };

  const doInvite = async () => {
    setInviteError('');
    if (!inviteId.trim()) return;
    setInviteSending(true);
    try {
      await sendFriendInvite(inviteId.trim());
      setInviteId('');
      await loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to send invite';
      setInviteError(msg);
    } finally {
      setInviteSending(false);
    }
  };

  const messages = useMemo(() => thread?.messages || [], [thread]);

  return (
    <Box maxW="6xl" mx="auto" mt={10} px={4}>
      <Heading size="lg" mb={4}>Chat & Collaboration</Heading>

      {loading ? (
        <Box textAlign="center" my={10}><Spinner size="lg" /></Box>
      ) : (
        <Stack direction={{ base: 'column', lg: 'row' }} spacing={6} align="start">
          {/* Left column: requests + friends + invite */}
          <Stack minW={{ base: '100%', lg: '320px' }} spacing={6}>
            <Card>
              <CardBody>
                <Heading size="md" mb={3}>Friend Requests</Heading>
                {reqError && <Alert status="error" mb={3}>{reqError}</Alert>}
                <Stack spacing={3}>
                  {(requests || []).length === 0 && (
                    <Text color="gray.600">No incoming requests</Text>
                  )}
                  {(requests || []).map((r) => (
                    <HStack key={r.id} justify="space-between">
                      <Stack spacing={0}>
                        <Text fontWeight="semibold" fontSize="sm">From</Text>
                        <Text fontSize="sm" color="gray.600">{r.requester_id}</Text>
                      </Stack>
                      <HStack>
                        <Button size="xs" colorScheme="teal" onClick={() => acceptRequest(r.id)}>Accept</Button>
                        <Button size="xs" variant="outline" onClick={() => rejectRequest(r.id)}>Reject</Button>
                      </HStack>
                    </HStack>
                  ))}
                </Stack>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Heading size="md" mb={3}>Invite by User ID</Heading>
                {inviteError && <Alert status="error" mb={3}>{inviteError}</Alert>}
                <HStack>
                  <Input
                    placeholder="paste user UUID"
                    value={inviteId}
                    onChange={(e) => setInviteId(e.target.value)}
                  />
                  <Button onClick={doInvite} isLoading={inviteSending} colorScheme="teal">Invite</Button>
                </HStack>
                <Text mt={2} fontSize="xs" color="gray.500">You can find another user's id in profile areas or backend data.</Text>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Heading size="md" mb={3}>Friends</Heading>
                {friendsError && <Alert status="error" mb={3}>{friendsError}</Alert>}
                <Stack spacing={2}>
                  {(friends || []).length === 0 ? (
                    <Text color="gray.600">No accepted friends yet</Text>
                  ) : (
                    friends.map((f) => (
                      <HStack key={f.friend_id} justify="space-between">
                        <Stack spacing={0}>
                          <Text fontWeight="semibold">{f.friend_username || f.friend_id}</Text>
                          <Badge>{f.status}</Badge>
                        </Stack>
                        <Button size="xs" onClick={() => openThread(f.friend_id)}>Open</Button>
                      </HStack>
                    ))
                  )}
                </Stack>
              </CardBody>
            </Card>
          </Stack>

          {/* Right column: thread */}
          <Card flex="1">
            <CardBody>
              <Heading size="md" mb={3}>Conversation</Heading>
              {threadError && <Alert status="error" mb={3}>{threadError}</Alert>}
              {!activeFriend ? (
                <Text color="gray.600">Select a friend to view messages</Text>
              ) : (
                <Stack spacing={3}>
                  <Text fontSize="sm" color="gray.600">Talking with: {thread?.friend_username || activeFriend}</Text>
                  <Divider />
                  <VStack align="stretch" spacing={3} maxH="50vh" overflowY="auto" p={2} border="1px" borderColor="gray.200" borderRadius="md">
                    {messages.length === 0 ? (
                      <Text color="gray.500">No messages yet</Text>
                    ) : (
                      messages.map((m) => (
                        <Box key={m.id} alignSelf={m.sender_id === user?.id ? 'flex-end' : 'flex-start'} maxW="70%">
                          <Box p={2} bg={m.sender_id === user?.id ? 'teal.500' : 'gray.100'} color={m.sender_id === user?.id ? 'white' : 'gray.800'} borderRadius="md">
                            <Text whiteSpace="pre-wrap">{m.content}</Text>
                          </Box>
                          <Text fontSize="xs" color="gray.500" mt={1}>{new Date(m.created_at).toLocaleString()}</Text>
                        </Box>
                      ))
                    )}
                  </VStack>
                  <HStack>
                    <Input
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMsg();
                        }
                      }}
                    />
                    <Button onClick={sendMsg} isLoading={sending} colorScheme="teal">Send</Button>
                  </HStack>
                </Stack>
              )}
            </CardBody>
          </Card>
        </Stack>
      )}
    </Box>
  );
}