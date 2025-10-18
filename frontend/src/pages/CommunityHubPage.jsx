import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  Stack,
  SimpleGrid,
  Alert,
  useToast,
} from '@chakra-ui/react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PostCard, { PostCardSkeleton } from '../components/PostCard';
import Composer from '../components/Composer';

export default function CommunityHubPage() {
  const { topic = 'general' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');

  // Composer handles new post creation

  const loadPosts = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.get(`/community/posts/${encodeURIComponent(topic)}`);
      setPosts(data || []);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to fetch posts';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  // New post creation handled by Composer component

  return (
    <Box maxW="6xl" mx="auto" mt={10} px={4}>
      <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align="center" mb={4}>
        <Heading size="lg">Community: {topic}</Heading>
        <Text color="gray.600">{posts.length} posts</Text>
      </Stack>

      <Composer topic={topic} onCreated={loadPosts} />

      <Box h="1px" bg="gray.200" my={6} />

      {error && (
        <Alert status="error" mb={4}>
          {error}
        </Alert>
      )}

      {loading ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          {[0, 1, 2, 3].map((i) => (
            <PostCardSkeleton key={i} />
          ))}
        </SimpleGrid>
      ) : posts.length === 0 ? (
        <Text color="gray.500">No posts yet. Be the first to start a discussion!</Text>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onClick={() => navigate(`/community/post/${p.id}`)}
            />
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}