import { useMemo, useState, useCallback } from 'react';
import {
  Card,
  CardBody,
  Stack,
  Heading,
  Text,
  HStack,
  Avatar,
  IconButton,
  Tooltip,
  Badge,
  useColorModeValue,
  Box,
  Skeleton,
  SkeletonText,
} from '@chakra-ui/react';
import { StarIcon, ChatIcon } from '@chakra-ui/icons';

function formatDate(ts) {
  try {
    const d = typeof ts === 'string' || typeof ts === 'number' ? new Date(ts) : ts;
    if (Number.isNaN(d?.getTime?.())) return '';
    return d.toLocaleString();
  } catch {
    return '';
  }
}

function deriveInitials(nameOrId) {
  if (!nameOrId) return 'U';
  const str = String(nameOrId);
  const parts = str.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * PostCard component
 * Props:
 * - post: { id, title, content, user_id, created_at, tags?: string[] }
 * - onClick: () => void
 * - onDiscuss?: () => void
 * - discussionCount?: number
 * - isDiscussOpen?: boolean
 */
export default function PostCard({ post, onClick, onDiscuss, discussionCount, isDiscussOpen }) {
  const [starred, setStarred] = useState(false);
  const [reacting, setReacting] = useState(false);

  const metaColor = useColorModeValue('gray.600', 'gray.400');
  const contentColor = useColorModeValue('gray.700', 'gray.200');

  const createdAt = useMemo(() => formatDate(post?.created_at), [post?.created_at]);
  const authorLabel = useMemo(() => (post?.author_username || post?.author_name || post?.user_name || post?.user_id || 'User'), [post]);
  const initials = useMemo(() => deriveInitials(authorLabel), [authorLabel]);

  const handleStar = useCallback(() => {
    if (reacting) return;
    // Optimistic toggle
    setReacting(true);
    setStarred((s) => !s);
    // Simulate async end; replace with API later
    setTimeout(() => setReacting(false), 200);
  }, [reacting]);

  return (
    <Card
      role="article"
      aria-label={post?.title || 'Post'}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      cursor="pointer"
      _hover={{ shadow: 'elevation2', filter: 'drop-shadow(0 0 10px var(--chakra-colors-glow))' }}
      _active={{ transform: 'scale(0.99)' }}
    >
      <CardBody>
        <Stack spacing={3}>
          <Heading size="md" noOfLines={2}>
            {post?.title}
          </Heading>

          <Text color={contentColor} noOfLines={3}>
            {post?.content}
          </Text>

          {Array.isArray(post?.tags) && post.tags.length > 0 && (
            <HStack spacing={2} flexWrap="wrap">
              {post.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} colorScheme="purple" variant="subtle">
                  #{tag}
                </Badge>
              ))}
              {post.tags.length > 4 && (
                <Badge variant="outline">+{post.tags.length - 4}</Badge>
              )}
            </HStack>
          )}

          <HStack justify="space-between" align="center" pt={1}>
            <HStack>
              <Avatar size="sm" name={authorLabel} bg="brand.500" color="white">
                {initials}
              </Avatar>
              <Stack spacing={0} lineHeight="1.2">
                <Text fontSize="sm">{authorLabel}</Text>
                <Text fontSize="xs" color={metaColor}>
                  {createdAt}
                </Text>
              </Stack>
            </HStack>

            <HStack spacing={1}>
              <Tooltip label={starred ? 'Bookmarked' : 'Bookmark'}>
                <IconButton
                  aria-label={starred ? 'Remove bookmark' : 'Add bookmark'}
                  icon={<StarIcon />}
                  size="sm"
                  variant={starred ? 'accent' : 'ghost'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStar();
                  }}
                  isDisabled={reacting}
                />
              </Tooltip>

              <Tooltip label="Open discussion">
                <HStack spacing={1}>
                  <IconButton
                    aria-label="Open discussion"
                    icon={<ChatIcon />}
                    size="sm"
                    variant={isDiscussOpen ? 'accent' : 'ghost'}
                    aria-expanded={isDiscussOpen ? 'true' : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDiscuss) {
                        onDiscuss();
                      } else {
                        onClick?.();
                      }
                    }}
                  />
                  {typeof discussionCount === 'number' && (
                    <Badge colorScheme="purple" borderRadius="full" px={1.5}>
                      {discussionCount}
                    </Badge>
                  )}
                </HStack>
              </Tooltip>
            </HStack>
          </HStack>
        </Stack>
      </CardBody>
    </Card>
  );
}

/**
 * Skeleton placeholder while loading list
 */
export function PostCardSkeleton() {
  return (
    <Card>
      <CardBody>
        <Stack spacing={3}>
          <Skeleton height="20px" width="70%" />
          <SkeletonText noOfLines={3} spacing="3" />
          <HStack justify="space-between" align="center" pt={1}>
            <HStack>
              <Skeleton boxSize="32px" borderRadius="full" />
              <Box>
                <Skeleton height="12px" width="120px" mb={1} />
                <Skeleton height="10px" width="80px" />
              </Box>
            </HStack>
            <HStack spacing={2}>
              <Skeleton boxSize="28px" borderRadius="md" />
              <Skeleton boxSize="28px" borderRadius="md" />
            </HStack>
          </HStack>
        </Stack>
      </CardBody>
    </Card>
  );
}