import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Flex,
  Card,
  CardBody,
  Heading,
  HStack,
  VStack,
  Text,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  useBreakpointValue,
  useToast,
  useColorModeValue,
  Spinner,
} from '@chakra-ui/react';
import {
  listFriendRequests,
  respondFriendInvite,
  listFriends,
  getThread,
  sendMessage,
} from '../lib/api';
import FriendListPane from '../components/FriendListPane';
import ChatPane from '../components/ChatPane';

// localStorage keys
const LS_LAST_READ = 'chat:lastReadAt';

function useLastRead() {
  const [map, setMap] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_LAST_READ);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const setFor = (friendId, iso = new Date().toISOString()) => {
    setMap((prev) => {
      const next = { ...prev, [friendId]: iso };
      try {
        localStorage.setItem(LS_LAST_READ, JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  return [map, setFor];
}

export default function ChatFriendsPage() {
  const toast = useToast();
  const { friendId: routeFriendId } = useParams();
  const navigate = useNavigate();
  const borderColor = useColorModeValue('blackAlpha.200', 'whiteAlpha.300');

  const isDesktop = useBreakpointValue({ base: false, lg: true });

  // Lists
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [error, setError] = useState('');

  // Selection and thread
  const [activeFriend, setActiveFriend] = useState(routeFriendId || null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState('');

  // Unread tracking
  const [lastReadAt, setLastReadFor] = useLastRead();

  // Mobile tab index
  const [tabIndex, setTabIndex] = useState(0);

  const loadLists = async () => {
    setLoading(true);
    setError('');
    try {
      const [reqs, frs] = await Promise.all([
        listFriendRequests().catch(() => []),
        listFriends().catch(() => []),
      ]);
      setRequests(reqs || []);
      setFriends(frs || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const openThread = async (fid) => {
    if (!fid) return;
    setActiveFriend(fid);
    setThread(null);
    setThreadError('');
    setThreadLoading(true);
    try {
      const t = await getThread(fid);
      setThread(t);
      // Mark as seen
      setLastReadFor(fid);
      if (!isDesktop) {
        setTabIndex(1); // switch to Chat tab on mobile
      }
      // Reflect deep link
      navigate(`/chat/${encodeURIComponent(fid)}`, { replace: true });
    } catch (e) {
      setThreadError(e?.response?.data?.detail || e?.message || 'Failed to load thread');
    } finally {
      setThreadLoading(false);
    }
  };

  const onRespond = async (request_id, action) => {
    try {
      await respondFriendInvite({ request_id, action });
      toast({
        title: action === 'accepted' ? 'Friend added' : 'Invite updated',
        status: 'success',
        duration: 1600,
        isClosable: true,
      });
      await loadLists();
    } catch (e) {
      toast({
        title: 'Action failed',
        description: e?.response?.data?.detail || e?.message,
        status: 'error',
        duration: 2400,
        isClosable: true,
      });
    }
  };

  // Compute unread counts using local lastReadAt timestamps
  const unreadCounts = useMemo(() => {
    const out = {};
    for (const f of friends) {
      const fid = f.friend_id;
      const last = lastReadAt[fid] ? new Date(lastReadAt[fid]).getTime() : 0;
      const msgs = (thread && activeFriend === fid ? thread.messages : []) || [];
      // Best-effort: only count current loaded thread for active friend; others show 0 unless optionally polled
      const count = msgs.filter((m) => new Date(m.created_at).getTime() > last).length;
      out[fid] = count;
    }
    return out;
  }, [friends, thread, activeFriend, lastReadAt]);

  // Presence heuristic (best-effort)
  const presence = useMemo(() => {
    const now = Date.now();
    const out = {};
    for (const f of friends) {
      const msgs = (thread && activeFriend === f.friend_id ? thread.messages : []) || [];
      const latest = msgs.length ? new Date(msgs[msgs.length - 1].created_at).getTime() : 0;
      out[f.friend_id] = now - latest < 2 * 60 * 1000 ? 'online' : 'offline';
    }
    return out;
  }, [friends, thread, activeFriend]);

  // Send a message
  const onSend = async (text) => {
    const content = String(text || '').trim();
    if (!activeFriend || !content) return;
    try {
      const msg = await sendMessage({ recipient_id: activeFriend, content });
      setThread((t) => {
        const next = t ? { ...t } : { friend_id: activeFriend, messages: [] };
        next.messages = [...(next.messages || []), msg];
        return next;
      });
      // Mark as seen (since user just sent)
      setLastReadFor(activeFriend, new Date().toISOString());
    } catch (e) {
      setThreadError(e?.response?.data?.detail || e?.message || 'Failed to send message');
    }
  };

  // Mark current thread seen
  const onSeen = () => {
    if (activeFriend) setLastReadFor(activeFriend, new Date().toISOString());
  };

  useEffect(() => {
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync route param selection
  useEffect(() => {
    if (routeFriendId) {
      openThread(routeFriendId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFriendId]);

  // Poll active thread every 8s
  useEffect(() => {
    if (!activeFriend) return;
    let timer = setInterval(async () => {
      try {
        const t = await getThread(activeFriend);
        setThread(t);
      } catch {
        /* ignore */
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [activeFriend]);

  // Layouts
  if (loading) {
    return (
      <Box maxW="6xl" mx="auto" mt={10} px={4} textAlign="center">
        <Spinner size="lg" />
      </Box>
    );
  }
  if (error) {
    return (
      <Box maxW="6xl" mx="auto" mt={10} px={4}>
        <Card>
          <CardBody>
            <Heading size="md" mb={2}>Chat</Heading>
            <Text color="red.400">{error}</Text>
          </CardBody>
        </Card>
      </Box>
    );
  }

  return (
    <Box maxW="6xl" mx="auto" mt={10} px={4}>
      <Heading size="lg" mb={4}>Chat</Heading>

      {isDesktop ? (
        <Flex gap={4} align="start">
          <Card minW="320px" maxW="360px" borderColor={borderColor} border="1px solid">
            <CardBody>
              <FriendListPane
                friends={friends}
                requests={requests}
                onRespond={onRespond}
                searchValue={''}
                onSearchChange={() => {}}
                onSelectFriend={openThread}
                unreadCounts={unreadCounts}
                presence={presence}
              />
            </CardBody>
          </Card>

          <Card flex="1" borderColor={borderColor} border="1px solid">
            <CardBody>
              <Heading size="md" mb={3}>Conversation</Heading>
              {threadError && <Text color="red.400" mb={2}>{threadError}</Text>}
              {!activeFriend ? (
                <Text color="gray.500">Select a friend to view messages</Text>
              ) : threadLoading ? (
                <Spinner size="sm" />
              ) : (
                <ChatPane
                  friendId={activeFriend}
                  thread={thread}
                  onSend={onSend}
                  onSeen={onSeen}
                />
              )}
            </CardBody>
          </Card>
        </Flex>
      ) : (
        <Card>
          <CardBody>
            <Tabs index={tabIndex} onChange={setTabIndex} isFitted variant="enclosed">
              <TabList>
                <Tab>Friends</Tab>
                <Tab>Chat</Tab>
              </TabList>
              <TabPanels>
                <TabPanel px={0}>
                  <FriendListPane
                    friends={friends}
                    requests={requests}
                    onRespond={onRespond}
                    searchValue={''}
                    onSearchChange={() => {}}
                    onSelectFriend={openThread}
                    unreadCounts={unreadCounts}
                    presence={presence}
                  />
                </TabPanel>
                <TabPanel px={0}>
                  {threadError && <Text color="red.400" mb={2}>{threadError}</Text>}
                  {!activeFriend ? (
                    <Text color="gray.500">Select a friend to start chatting</Text>
                  ) : threadLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <ChatPane
                      friendId={activeFriend}
                      thread={thread}
                      onSend={onSend}
                      onSeen={onSeen}
                    />
                  )}
                </TabPanel>
              </TabPanels>
            </Tabs>
          </CardBody>
        </Card>
      )}
    </Box>
  );
}