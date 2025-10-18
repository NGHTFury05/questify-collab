import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  Card,
  CardBody,
  Stack,
  Button,
  Spinner,
  Alert,
  Code,
} from '@chakra-ui/react';
import { api } from '../lib/api';
import InlineQuizBlock from '../components/InlineQuizBlock';

export default function LessonPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const course_title = location.state?.course_title;
  const module_title = location.state?.module_title;
  const level = location.state?.level || 'Beginner';
  const topic = location.state?.topic || 'general';

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState('');
  const didFetch = useRef(false);

  useEffect(() => {
    if (!course_title || !module_title) {
      navigate('/planner', { replace: true });
      return;
    }
    if (didFetch.current) return;
    didFetch.current = true;

    let cancelled = false;
    const run = async () => {
      setError('');
      setLoading(true);
      try {
        const { data } = await api.post('/ai/generate-lesson', {
          course_title,
          module_title,
          level,
        });
        if (!cancelled) setLesson(data);
      } catch (err) {
        const msg = err?.response?.data?.detail || err?.message || 'Failed to generate lesson';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();

    return () => { cancelled = true; };
  }, [course_title, module_title, level, navigate]);

  if (!course_title || !module_title) {
    return null;
  }

  const [searchParams, setSearchParams] = useSearchParams();
  const quizOpen = searchParams.get('quiz') === 'open';
  const openQuiz = () => {
    const sp = new URLSearchParams(searchParams);
    sp.set('quiz', 'open');
    setSearchParams(sp, { replace: true });
  };
  const closeQuiz = () => {
    const sp = new URLSearchParams(searchParams);
    sp.delete('quiz');
    setSearchParams(sp, { replace: true });
  };

  return (
    <Box maxW="4xl" mx="auto" mt={10} px={4}>
      <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align="center" mb={4}>
        <Heading size="lg">{module_title}</Heading>
        <Button colorScheme="blue" onClick={() => navigate(`/feed?tag=${encodeURIComponent(topic)}`)}>
          Collaborate on this Topic
        </Button>
      </Stack>
      <Text color="gray.600" mb={6}>
        Course: {course_title} • Level: {level}
      </Text>

      {loading && (
        <Box textAlign="center" my={10}>
          <Spinner size="lg" />
        </Box>
      )}

      {error && (
        <Alert status="error" mb={4}>
          {error}
        </Alert>
      )}

      {!loading && !error && lesson && (
        <Stack spacing={6}>
          <Card>
            <CardBody>
              <Heading size="md" mb={3}>
                Overview
              </Heading>
              <Text whiteSpace="pre-wrap">{lesson?.lesson_content?.overview || ''}</Text>
            </CardBody>
          </Card>

          {Array.isArray(lesson?.lesson_content?.key_concepts) && lesson.lesson_content.key_concepts.length > 0 && (
            <Card>
              <CardBody>
                <Heading size="md" mb={3}>Key Concepts</Heading>
                <Stack as="ul" spacing={2} pl={4}>
                  {lesson.lesson_content.key_concepts.map((k, idx) => (
                    <Text as="li" key={idx}>• {k}</Text>
                  ))}
                </Stack>
              </CardBody>
            </Card>
          )}

          {Array.isArray(lesson?.lesson_content?.important_details) && lesson.lesson_content.important_details.length > 0 && (
            <Card>
              <CardBody>
                <Heading size="md" mb={3}>Important Details</Heading>
                <Stack spacing={4}>
                  {lesson.lesson_content.important_details.map((d, idx) => (
                    <Box key={idx}>
                      <Heading size="sm" mb={1}>{d.heading}</Heading>
                      <Text whiteSpace="pre-wrap">{d.description}</Text>
                    </Box>
                  ))}
                </Stack>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <Heading size="md" mb={3}>
                Summary
              </Heading>
              <Text whiteSpace="pre-wrap">{lesson?.lesson_content?.summary || ''}</Text>
            </CardBody>
          </Card>

          {/* Inline Quiz (collapsible) */}
          <InlineQuizBlock
            topic={topic}
            lessonContent={lesson?.lesson_content || lesson}
            isOpen={quizOpen}
            onClose={closeQuiz}
          />
          <Stack direction={{ base: 'column', sm: 'row' }} spacing={3}>
            <Button colorScheme="teal" onClick={openQuiz}>
              Start Quiz
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>
              Back
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}