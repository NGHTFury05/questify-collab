import { useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  Card,
  CardBody,
  Stack,
  HStack,
  VStack,
  Button,
  Alert,
  Spinner,
  Badge,
  Input,
  Textarea,
  Tag,
  TagLabel,
  TagCloseButton,
  InputGroup,
  InputLeftElement,
  Checkbox,
  Divider,
  Icon,
  useToast,
  Grid,
  GridItem,
  SimpleGrid,
  useColorModeValue,
} from '@chakra-ui/react';
import { VirtuosoGrid } from 'react-virtuoso';
import {
  getFeed,
  recordInterest,
  createCommunityPost,
  suggestTags,
  similarTags,
  searchUsers,
  sendFriendInviteBy,
  votePost,
  listFriends,
  getPostWithAnswers,
} from '../lib/api';
import ThreadInline from '../components/ThreadInline';

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function CommunityFeedPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const borderColor = useColorModeValue('blackAlpha.200', 'whiteAlpha.300');
  const subtleBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100');

  // Feed filters/search (Left column)
  const [q, setQ] = useState('');
  const [filterTags, setFilterTags] = useState([]);
  const [expandSimilar, setExpandSimilar] = useState(false); // default false
  const [view, setView] = useState('pulse'); // 'pulse' | 'personalised'
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [onlyHasSolution, setOnlyHasSolution] = useState(false);

  const dq = useDebouncedValue(q, 350);
  const dFilterTags = useDebouncedValue(filterTags, 350);
  const dExpand = useDebouncedValue(expandSimilar, 350);

  // Feed state (Center column)
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);

  // Inline thread state + URL mapping
  const [openThreadPostId, setOpenThreadPostId] = useState(null);
  const [openSort, setOpenSort] = useState('newest'); // 'newest' | 'top'
  const feedScrollRef = useRef(0);
  const [searchParams] = useSearchParams();

  // Composer (Center column top)
  const [cTopic, setCTopic] = useState('general');
  const [cTitle, setCTitle] = useState('');
  const [cContent, setCContent] = useState('');
  const [cTags, setCTags] = useState([]);
  const [cBusy, setCBusy] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef(null);

  // Right rail (suggestions)
  const [friends, setFriends] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [suggesting, setSuggesting] = useState(false);

  const limitReached = useMemo(() => cTags.length >= 8, [cTags.length]);

  const sanitizeTag = (t) => {
    const s = String(t || '').trim().toLowerCase();
    return s.replace(/\s+/g, '-');
  };

  const addFilterTag = (t) => {
    const s = sanitizeTag(t);
    if (!s) return;
    setFilterTags((prev) => (prev.includes(s) ? prev : [...prev, s]));
  };

  const removeFilterTag = (t) => setFilterTags((prev) => prev.filter((x) => x !== t));

  const handleAddComposerTag = () => {
    const s = sanitizeTag(tagInput);
    if (!s) return;
    if (!cTags.includes(s) && cTags.length < 8) setCTags((prev) => [...prev, s]);
    setTagInput('');
    tagInputRef.current?.focus();
  };

  const removeComposerTag = (t) => setCTags((prev) => prev.filter((x) => x !== t));

  // Prefetch cache and request de-duplication
  const prefetchCacheRef = useRef(new Map()); // postId -> data
  const feedSeqRef = useRef(0);
  const lastParamsRef = useRef('');

  const paramsKey = (p) =>
    JSON.stringify({
      q: p.q || '',
      tags: (p.tags || []).slice().sort(),
      expandSimilar: !!p.expandSimilar,
      view: p.view || '',
      unanswered: !!p.unanswered,
      hasSolution: !!p.hasSolution,
    });

  const loadFeed = async (params = {}) => {
    const key = paramsKey(params);
    if (key === lastParamsRef.current) return; // de-dupe identical requests
    lastParamsRef.current = key;

    const mySeq = ++feedSeqRef.current;
    setError('');
    setLoading(true);
    try {
      const res = await getFeed(params);
      // Ignore out-of-order responses
      if (mySeq !== feedSeqRef.current) return;
      setFeed(res?.posts || []);
    } catch (err) {
      if (mySeq !== feedSeqRef.current) return;
      const msg = err?.response?.data?.detail || err?.message || 'Failed to load feed';
      setError(msg);
    } finally {
      if (mySeq === feedSeqRef.current) setLoading(false);
    }
  };

  const prefetchPost = async (postId) => {
    if (!postId) return;
    const cache = prefetchCacheRef.current;
    if (cache.has(postId)) return;
    try {
      const data = await getPostWithAnswers(postId);
      cache.set(postId, { data, ts: Date.now() });
      // prune
      if (cache.size > 20) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]?.[0];
        if (oldest) cache.delete(oldest);
      }
    } catch {
      // ignore prefetch errors
    }
  };

  // Initial + whenever filters change (debounced)
  useEffect(() => {
    loadFeed({
      q: dq,
      tags: dFilterTags,
      expandSimilar: !!dExpand,
      view,
      unanswered: !!onlyUnanswered,
      hasSolution: !!onlyHasSolution,
    });
  }, [dq, dFilterTags, dExpand, view, onlyUnanswered, onlyHasSolution]);

  // Read thread and sort from URL on mount
  useEffect(() => {
    const t = searchParams.get('thread');
    const s = searchParams.get('sort');
    if (t) {
      const idNum = Number(t);
      if (!Number.isNaN(idNum)) {
        setOpenThreadPostId(idNum);
        if (s === 'top' || s === 'newest') setOpenSort(s);
        prefetchPost(idNum);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When feed finishes loading and a thread is targeted, scroll the post card into view
  useEffect(() => {
    if (!loading && openThreadPostId) {
      const el = document.querySelector(`[data-post-id="post-${openThreadPostId}"]`);
      if (el?.scrollIntoView) {
        el.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
    }
  }, [loading, openThreadPostId]);

  // Right rail bootstrap (friends + suggested users by generic query)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const fr = await listFriends().catch(() => []);
        if (active) setFriends(fr || []);
      } catch {
        /* ignore */
      }
      try {
        setSuggesting(true);
        // Seed with broad query to populate suggestions (server dedupes)
        const seedUsers = await searchUsers('a', 8).catch(() => []);
        if (active) setTopUsers(seedUsers || []);
      } finally {
        if (active) setSuggesting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleMoreLikeThis = async (topic) => {
    try {
      await recordInterest(topic, 1);
      // Optimistically adjust scores and re-sort locally
      const upd = feed.map((p) => (p.topic === topic ? { ...p, score: (p.score || 0) + 1 } : p));
      upd.sort((a, b) => {
        const ak = a.score || 0;
        const bk = b.score || 0;
        const at = new Date(a.created_at).getTime();
        const bt = new Date(b.created_at).getTime();
        if (bk !== ak) return bk - ak;
        return bt - at;
      });
      setFeed(upd);
    } catch {
      // ignore (non-blocking UX)
    }
  };

  const handleVote = async (postId, vote) => {
    try {
      const res = await votePost(postId, vote);
      setFeed((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, upvotes: res.upvotes, downvotes: res.downvotes } : p
        )
      );
    } catch {
      // ignore
    }
  };

  const onComposerSubmit = async () => {
    setComposeError('');
    setCBusy(true);
    try {
      const payload = {
        topic: cTopic || 'general',
        title: cTitle,
        content: cContent,
        tags: cTags,
      };
      const created = await createCommunityPost(payload);
      // Prepend optimistic
      setFeed((prev) => [created, ...prev]);
      setCTitle('');
      setCContent('');
      setCTags([]);
      toast({
        title: 'Posted',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to create post';
      setComposeError(msg);
      toast({ title: 'Failed to post', description: msg, status: 'error', duration: 3000, isClosable: true });
    } finally {
      setCBusy(false);
    }
  };

  const onSuggestTags = async () => {
    const basis = `${cTitle} ${cContent}`.trim();
    if (!basis) return;
    try {
      const { tags } = await suggestTags(basis);
      if (Array.isArray(tags)) {
        const merged = [...new Set([...cTags, ...tags.map(sanitizeTag)])].slice(0, 8);
        setCTags(merged);
      }
    } catch {
      // ignore
    }
  };

  const onExpandSimilarFilters = async () => {
    if (!filterTags.length) return;
    try {
      const { tags } = await similarTags(filterTags);
      if (Array.isArray(tags)) {
        const merged = [...new Set([...filterTags, ...tags])];
        setFilterTags(merged);
      }
    } catch {
      // ignore
    }
  };

  const visible = feed.slice(0, visibleCount);

  // Right rail: compute trending tags from current feed
  const trendingTags = useMemo(() => {
    const freq = {};
    for (const p of feed) {
      (p.tags || []).forEach((t) => {
        const s = sanitizeTag(t);
        if (!s) return;
        freq[s] = (freq[s] || 0) + 1;
      });
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([t, c]) => ({ tag: t, count: c }));
  }, [feed]);

  return (
    <Box maxW="7xl" mx="auto" mt={6} px={4}>
      <Grid templateColumns={{ base: '1fr', lg: '260px 1fr 300px' }} gap={4} alignItems="start">
        {/* LEFT: Filters */}
        <GridItem as="aside" display={{ base: 'none', lg: 'block' }} position="sticky" top="72px">
          <Card>
            <CardBody>
              <VStack align="stretch" spacing={4}>
                <Heading size="sm">Search</Heading>
                <InputGroup>
                  <InputLeftElement>
                    <Icon viewBox="0 0 24 24">
                      <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5 1.5-1.5-5-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                    </Icon>
                  </InputLeftElement>
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or content..." />
                </InputGroup>

                <Divider />

                <Heading size="sm">Tags</Heading>
                <HStack wrap="wrap" spacing={2}>
                  {filterTags.map((t) => (
                    <Tag key={t} colorScheme="purple" borderRadius="full">
                      <TagLabel>#{t}</TagLabel>
                      <TagCloseButton onClick={() => removeFilterTag(t)} />
                    </Tag>
                  ))}
                </HStack>
                <Input
                  placeholder="Add tag and press Enter"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addFilterTag(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <HStack>
                  <Checkbox isChecked={expandSimilar} onChange={(e) => setExpandSimilar(e.target.checked)}>
                    Expand with AI
                  </Checkbox>
                  <Button size="xs" variant="ghost" onClick={onExpandSimilarFilters} isDisabled={!filterTags.length}>
                    Expand now
                  </Button>
                </HStack>

                <Divider />

                <Heading size="sm">View</Heading>
                <HStack>
                  <Button
                    size="sm"
                    colorScheme={view === 'pulse' ? 'teal' : 'gray'}
                    variant={view === 'pulse' ? 'solid' : 'outline'}
                    onClick={() => setView('pulse')}
                  >
                    Hot
                  </Button>
                  <Button
                    size="sm"
                    colorScheme={view === 'personalised' ? 'teal' : 'gray'}
                    variant={view === 'personalised' ? 'solid' : 'outline'}
                    onClick={() => setView('personalised')}
                  >
                    For You
                  </Button>
                </HStack>

                <HStack>
                  <Checkbox isChecked={onlyUnanswered} onChange={(e) => setOnlyUnanswered(e.target.checked)}>
                    Unanswered
                  </Checkbox>
                  <Checkbox isChecked={onlyHasSolution} onChange={(e) => setOnlyHasSolution(e.target.checked)}>
                    Has Solution
                  </Checkbox>
                </HStack>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    loadFeed({
                      q,
                      tags: filterTags,
                      expandSimilar,
                      view,
                      unanswered: onlyUnanswered,
                      hasSolution: onlyHasSolution,
                    })
                  }
                >
                  Apply
                </Button>
              </VStack>
            </CardBody>
          </Card>
        </GridItem>

        {/* CENTER: Composer + Feed */}
        <GridItem as="main" role="feed" aria-busy={loading ? 'true' : 'false'}>
          {/* Composer */}
          <Card mb={4}>
            <CardBody>
              <VStack align="stretch" spacing={3}>
                <HStack justify="space-between">
                  <Heading size="md">Share with the community</Heading>
                  <HStack spacing={2}>
                    <Badge colorScheme="purple" variant="subtle">Q&A</Badge>
                    <Badge colorScheme="blue" variant="subtle">Discussion</Badge>
                    <Badge colorScheme="green" variant="subtle">Info</Badge>
                  </HStack>
                </HStack>
                <HStack>
                  <Input
                    value={cTopic}
                    onChange={(e) => setCTopic(e.target.value)}
                    maxW="220px"
                    placeholder="Topic (e.g., python)"
                  />
                  <Input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="Post title" />
                </HStack>
                <Textarea value={cContent} onChange={(e) => setCContent(e.target.value)} placeholder="Write your question or start a discussion..." />

                <HStack align="center" spacing={2} wrap="wrap">
                  {cTags.map((t) => (
                    <Tag key={t} colorScheme="teal" borderRadius="full">
                      <TagLabel>#{t}</TagLabel>
                      <TagCloseButton onClick={() => removeComposerTag(t)} />
                    </Tag>
                  ))}
                </HStack>

                <HStack wrap="wrap">
                  <Input
                    ref={tagInputRef}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddComposerTag();
                      }
                    }}
                    maxW="280px"
                    placeholder={limitReached ? 'Max 8 tags reached' : 'Add a tag and press Enter'}
                    isDisabled={limitReached}
                  />
                  <Button size="sm" onClick={handleAddComposerTag} isDisabled={limitReached}>
                    Add tag
                  </Button>
                  <Button size="sm" variant="outline" onClick={onSuggestTags} isDisabled={!cTitle && !cContent}>
                    Suggest tags (AI)
                  </Button>
                  <Button colorScheme="teal" onClick={onComposerSubmit} isLoading={cBusy}>
                    Post
                  </Button>
                </HStack>

                {composeError && <Alert status="error">{composeError}</Alert>}
              </VStack>
            </CardBody>
          </Card>

          <Divider mb={4} />

          {error && <Alert status="error" mb={4}>{error}</Alert>}

          {loading ? (
            <Box textAlign="center" my={10}>
              <Spinner size="lg" />
            </Box>
          ) : visible.length === 0 ? (
            <Box p={4} border="1px solid" borderColor={borderColor} borderRadius="md" bg={subtleBg}>
              <Text color="gray.600" mb={2}>
                No posts match your filters. Try expanding with AI or explore trending tags from the right rail.
              </Text>
              <HStack wrap="wrap">
                {trendingTags.map(({ tag }) => (
                  <Button key={`tt-${tag}`} size="xs" variant="outline" onClick={() => addFilterTag(tag)}>
                    #{tag}
                  </Button>
                ))}
              </HStack>
            </Box>
          ) : (
            <>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {visible.map((p) => (
                  <Card key={p.id} data-post-id={`post-${p.id}`} _hover={{ shadow: 'md' }}>
                    <CardBody>
                      <Stack spacing={2}>
                        <HStack justify="space-between" align="start" wrap="wrap">
                          <HStack spacing={2}>
                            <Badge colorScheme="purple">{p.topic}</Badge>
                            {p.disputed && <Badge colorScheme="red">Disputed</Badge>}
                            {p.solutions_count > 0 && <Badge colorScheme="green">Solved</Badge>}
                            <HStack spacing={1} wrap="wrap">
                              {(p.tags || []).map((t) => (
                                <Tag key={`${p.id}-${t}`} size="sm" variant="subtle" colorScheme="gray" onClick={() => addFilterTag(t)} cursor="pointer">
                                  <TagLabel>#{t}</TagLabel>
                                </Tag>
                              ))}
                            </HStack>
                          </HStack>
                          <Text fontSize="xs" color="gray.500">score {Number(p.score || 0).toFixed(0)}</Text>
                        </HStack>

                        <Heading size="md" noOfLines={1}>{p.title}</Heading>
                        <Text color="gray.300" noOfLines={3}>{p.content}</Text>
                        <Text fontSize="sm" color="gray.500">
                          {new Date(p.created_at).toLocaleString()}
                        </Text>
                        <HStack spacing={2} flexWrap="wrap" align="center">
                          <HStack spacing={1}>
                            <Button
                              size="sm"
                              colorScheme={openThreadPostId === p.id ? 'purple' : 'teal'}
                              aria-expanded={openThreadPostId === p.id ? 'true' : 'false'}
                              onClick={() => {
                                if (openThreadPostId === p.id) {
                                  setOpenThreadPostId(null);
                                  navigate('/feed', { replace: true });
                                  if (typeof window !== 'undefined') {
                                    window.scrollTo({ top: feedScrollRef.current || 0, behavior: 'auto' });
                                  }
                                } else {
                                  feedScrollRef.current = typeof window !== 'undefined' ? window.scrollY : 0;
                                  setOpenThreadPostId(p.id);
                                  navigate(`/feed?thread=${p.id}&sort=${openSort}`, { replace: true });
                                  prefetchPost(p.id);
                                }
                              }}
                            >
                              Discuss
                            </Button>
                            <Badge colorScheme="purple" borderRadius="full">
                              {(prefetchCacheRef.current.get(p.id)?.data?.answers?.length) ?? 0}
                            </Badge>
                          </HStack>
                          <Button size="sm" variant="outline" onClick={() => handleMoreLikeThis(p.topic)}>
                            Similar
                          </Button>
                          <HStack spacing={2} ml="auto">
                            <Button size="xs" onClick={() => handleVote(p.id, 1)}>▲</Button>
                            <Text fontSize="sm" color="gray.400">{p.upvotes || 0}</Text>
                            <Button size="xs" onClick={() => handleVote(p.id, -1)}>▼</Button>
                            <Text fontSize="sm" color="gray.400">{p.downvotes || 0}</Text>
                          </HStack>
                        </HStack>
                      </Stack>
                    {openThreadPostId === p.id && (
                      <Box mt={3}>
                        <ThreadInline
                          postId={p.id}
                          isOpen
                          onClose={() => {
                            setOpenThreadPostId(null);
                            navigate('/feed', { replace: true });
                            if (typeof window !== 'undefined') {
                              window.scrollTo({ top: feedScrollRef.current || 0, behavior: 'auto' });
                            }
                          }}
                          initialSort={openSort}
                          initialExpandedPath={[]}
                          onCountUpdate={() => {}}
                        />
                      </Box>
                    )}
                    </CardBody>
                  </Card>
                ))}
              </SimpleGrid>

              {visibleCount < feed.length && (
                <Box textAlign="center" mt={6}>
                  <Button onClick={() => setVisibleCount((c) => c + 12)}>Load more</Button>
                </Box>
              )}
            </>
          )}
        </GridItem>

        {/* RIGHT: Suggestions & Trending */}
        <GridItem as="aside" display={{ base: 'none', lg: 'block' }} position="sticky" top="72px">
          <VStack align="stretch" spacing={4}>
            <Card>
              <CardBody>
                <Stack spacing={3}>
                  <Heading size="sm">Trending tags</Heading>
                  {trendingTags.length === 0 ? (
                    <Text color="gray.500">No tags yet</Text>
                  ) : (
                    <HStack wrap="wrap" spacing={2}>
                      {trendingTags.map(({ tag, count }) => (
                        <Button key={`trend-${tag}`} size="xs" variant="outline" onClick={() => addFilterTag(tag)}>
                          #{tag} <Badge ml={1}>{count}</Badge>
                        </Button>
                      ))}
                    </HStack>
                  )}
                </Stack>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stack spacing={3}>
                  <Heading size="sm">Suggested people</Heading>
                  {suggesting ? (
                    <Text color="gray.500">Loading…</Text>
                  ) : topUsers.length === 0 ? (
                    <Text color="gray.500">No suggestions yet</Text>
                  ) : (
                    <VStack align="stretch" spacing={2}>
                      {topUsers.map((u) => (
                        <HStack key={u.id} justify="space-between" p={2} border="1px solid" borderColor={borderColor} borderRadius="md">
                          <Box>
                            <Text fontWeight="semibold">{u.username || '(no username)'}</Text>
                            <Text fontSize="sm" color="gray.500">{u.email || u.id}</Text>
                          </Box>
                          <Button size="xs" onClick={() => sendFriendInviteBy({ user_id: u.id }).then(() => toast({ title: 'Invite sent', status: 'success', duration: 2000, isClosable: true })).catch((e) => toast({ title: 'Invite failed', description: e?.response?.data?.detail || e?.message, status: 'error', duration: 3000, isClosable: true }))}>
                            Invite
                          </Button>
                        </HStack>
                      ))}
                    </VStack>
                  )}
                </Stack>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stack spacing={3}>
                  <Heading size="sm">Friends online</Heading>
                  {friends.length === 0 ? (
                    <Text color="gray.500">No friends yet</Text>
                  ) : (
                    <VStack align="stretch" spacing={2}>
                      {friends.slice(0, 6).map((f, idx) => (
                        <HStack key={`${f.friend_id}-${idx}`} justify="space-between" p={2} border="1px solid" borderColor={borderColor} borderRadius="md">
                          <Text>{f.friend_username || f.friend_id}</Text>
                          <Badge colorScheme="green">{f.status || 'accepted'}</Badge>
                        </HStack>
                      ))}
                      {friends.length > 6 && (
                        <Text fontSize="xs" color="gray.500">+ {friends.length - 6} more</Text>
                      )}
                    </VStack>
                  )}
                </Stack>
              </CardBody>
            </Card>
          </VStack>
        </GridItem>
      </Grid>
    </Box>
  );
}