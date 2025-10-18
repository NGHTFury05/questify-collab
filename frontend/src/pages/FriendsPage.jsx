import { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Card,
  CardBody,
  Stack,
  HStack,
  VStack,
  Text,
  Input,
  Button,
  Badge,
  Divider,
  useToast,
  IconButton,
  useColorModeValue,
} from '@chakra-ui/react';
import { SmallCloseIcon, CheckIcon } from '@chakra-ui/icons';
import {
  listFriendRequests,
  listFriends,
  sendFriendInviteBy,
  respondFriendInvite,
  searchUsers,
} from '../lib/api';

export default function FriendsPage() {
  const toast = useToast();
  const borderColor = useColorModeValue('blackAlpha.200', 'whiteAlpha.300');

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);

  // Invite form
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // Suggestions
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, frs] = await Promise.all([
        listFriendRequests().catch(() => []),
        listFriends().catch(() => []),
      ]);
      setRequests(reqs || []);
      setFriends(frs || []);
    } catch (e) {
      // Ignore network-level issues here; UI shows empty state gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onInvite = async () => {
    if (!inviteUsername && !inviteEmail) {
      toast({
        title: 'Provide a username or email',
        status: 'info',
        duration: 2000,
        isClosable: true,
      });
      return;
    }
    setInviting(true);
    try {
      await sendFriendInviteBy({
        username: inviteUsername || undefined,
        email: inviteEmail || undefined,
      });
      setInviteUsername('');
      setInviteEmail('');
      toast({
        title: 'Invite sent',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to send invite';
      toast({ title: 'Invite failed', description: msg, status: 'error', duration: 3000, isClosable: true });
    } finally {
      setInviting(false);
    }
  };

  const onRespond = async (request_id, action) => {
    try {
      await respondFriendInvite({ request_id, action });
      toast({
        title: action === 'accepted' ? 'Friend added' : 'Invite rejected',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      await loadData();
    } catch (e) {
      toast({
        title: 'Action failed',
        description: e?.response?.data?.detail || e?.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const onSuggest = async () => {
    const q = String(query || '').trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    setSuggesting(true);
    try {
      const found = await searchUsers(q, 8);
      setSuggestions(found || []);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <Box maxW="6xl" mx="auto" mt={10} px={4}>
      <Heading size="lg" mb={6}>Friends</Heading>

      <Stack direction={{ base: 'column', lg: 'row' }} spacing={6} align="start">
        {/* Left column: Requests & Invite */}
        <Stack flex="1" spacing={6}>
          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Heading size="md">Incoming requests</Heading>
                {loading ? (
                  <Text color="gray.500">Loading...</Text>
                ) : requests.length === 0 ? (
                  <Text color="gray.500">No pending requests</Text>
                ) : (
                  <VStack align="stretch" spacing={3}>
                    {requests.map((r) => (
                      <HStack
                        key={r.id}
                        justify="space-between"
                        border="1px solid"
                        borderColor={borderColor}
                        borderRadius="md"
                        p={3}
                      >
                        <HStack spacing={3}>
                          <Badge colorScheme="purple">Request</Badge>
                          <Text fontWeight="medium">Request #{r.id}</Text>
                        </HStack>
                        <HStack>
                          <IconButton
                            aria-label="Accept"
                            icon={<CheckIcon />}
                            size="sm"
                            colorScheme="green"
                            onClick={() => onRespond(r.id, 'accepted')}
                          />
                          <IconButton
                            aria-label="Reject"
                            icon={<SmallCloseIcon />}
                            size="sm"
                            colorScheme="red"
                            variant="outline"
                            onClick={() => onRespond(r.id, 'rejected')}
                          />
                        </HStack>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Stack>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Heading size="md">Invite a friend</Heading>
                <Text color="gray.500" fontSize="sm">Invite by username or email</Text>
                <HStack>
                  <Input
                    placeholder="username"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                  />
                  <Text color="gray.400">or</Text>
                  <Input
                    placeholder="email@example.com"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </HStack>
                <Button onClick={onInvite} isLoading={inviting} colorScheme="teal">
                  Send invite
                </Button>

                <Divider />

                <Heading size="sm">Find people</Heading>
                <HStack>
                  <Input
                    placeholder="Search users by name or email"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSuggest()}
                  />
                  <Button onClick={onSuggest} isLoading={suggesting}>Search</Button>
                </HStack>
                {suggestions.length > 0 && (
                  <VStack align="stretch" spacing={2}>
                    {suggestions.map((u) => (
                      <HStack key={u.id} justify="space-between" p={2} border="1px solid" borderColor={borderColor} borderRadius="md">
                        <Text>{u.username || u.email || u.id}</Text>
                        <Button size="sm" onClick={() => {
                          setInviteUsername(u.username || '');
                          setInviteEmail(u.email || '');
                        }}>
                          Invite
                        </Button>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Stack>
            </CardBody>
          </Card>
        </Stack>

        {/* Right column: Friends list */}
        <Card flex="1">
          <CardBody>
            <Stack spacing={4}>
              <Heading size="md">Your friends</Heading>
              {loading ? (
                <Text color="gray.500">Loading...</Text>
              ) : friends.length === 0 ? (
                <Text color="gray.500">No friends yet. Invite someone to start chatting.</Text>
              ) : (
                <VStack align="stretch" spacing={2}>
                  {friends.map((f, idx) => (
                    <HStack key={`${f.friend_id}-${idx}`} justify="space-between" p={2} border="1px solid" borderColor={borderColor} borderRadius="md">
                      <Text>
                        {f.friend_username || f.friend_id}
                      </Text>
                      <Badge colorScheme="green">{f.status || 'accepted'}</Badge>
                    </HStack>
                  ))}
                </VStack>
              )}
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    </Box>
  );
}