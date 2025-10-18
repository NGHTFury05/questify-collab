import { useMemo, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Badge,
  Divider,
  Icon,
  useColorModeValue,
} from '@chakra-ui/react';
import { CheckIcon, SmallCloseIcon } from '@chakra-ui/icons';

/**
 * FriendListPane
 *
 * Props:
 * - friends: Array<{ friend_id: string, friend_username?: string, status?: string }>
 * - requests: Array<{ id: string|number, requester_id: string }>
 * - onRespond: (request_id, action: 'accepted'|'rejected') => Promise<void>
 * - searchValue: string
 * - onSearchChange: (value: string) => void
 * - onSelectFriend: (friendId: string) => void
 * - unreadCounts: Record<string, number>
 * - presence: Record<string, 'online'|'offline'|'idle'>
 */
export default function FriendListPane({
  friends = [],
  requests = [],
  onRespond,
  searchValue = '',
  onSearchChange,
  onSelectFriend,
  unreadCounts = {},
  presence = {},
}) {
  const [q, setQ] = useState(searchValue || '');
  const borderColor = useColorModeValue('blackAlpha.200', 'whiteAlpha.300');

  const filtered = useMemo(() => {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return friends;
    return friends.filter((f) => {
      const label = (f.friend_username || f.friend_id || '').toLowerCase();
      return label.includes(s);
    });
  }, [friends, q]);

  return (
    <VStack align="stretch" spacing={4}>
      {/* Incoming requests */}
      <Box>
        <Text fontWeight="semibold" mb={2}>Incoming requests</Text>
        {requests.length === 0 ? (
          <Text color="gray.500" fontSize="sm">No pending requests</Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {requests.map((r) => (
              <HStack
                key={r.id}
                justify="space-between"
                p={2}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="md"
              >
                <Text fontSize="sm">From {r.requester_id}</Text>
                <HStack>
                  <Button
                    size="xs"
                    colorScheme="teal"
                    leftIcon={<CheckIcon boxSize={3} />}
                    onClick={() => onRespond?.(r.id, 'accepted')}
                  >
                    Accept
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    colorScheme="red"
                    leftIcon={<SmallCloseIcon boxSize={3} />}
                    onClick={() => onRespond?.(r.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </HStack>
              </HStack>
            ))}
          </VStack>
        )}
      </Box>

      <Divider />

      {/* Search */}
      <Box>
        <Text fontWeight="semibold" mb={2}>Friends</Text>
        <Input
          placeholder="Search friends…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onSearchChange?.(e.target.value);
          }}
          mb={2}
        />
        {filtered.length === 0 ? (
          <Text color="gray.500" fontSize="sm">No friends match your search</Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {filtered.map((f) => {
              const fid = f.friend_id;
              const label = f.friend_username || fid;
              const unread = unreadCounts[fid] || 0;
              const pres = presence[fid] || 'offline';
              const presColor = pres === 'online' ? 'green' : pres === 'idle' ? 'yellow' : 'gray';

              return (
                <HStack
                  key={fid}
                  justify="space-between"
                  p={2}
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius="md"
                >
                  <HStack>
                    <Badge colorScheme={presColor} borderRadius="full">
                      {pres}
                    </Badge>
                    <Text>{label}</Text>
                  </HStack>
                  <HStack>
                    {unread > 0 && (
                      <Badge colorScheme="purple" borderRadius="full">{unread}</Badge>
                    )}
                    <Button size="xs" onClick={() => onSelectFriend?.(fid)}>
                      Open
                    </Button>
                  </HStack>
                </HStack>
              );
            })}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}