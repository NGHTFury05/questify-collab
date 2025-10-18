import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  Stack,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Alert,
  Progress,
  useColorModeValue,
} from '@chakra-ui/react';
import { aiGenerateQuiz, recordLessonCompletion } from '../lib/api';

/**
 * InlineQuizBlock.jsx
 * Collapsible inline quiz block for LessonPage.
 *
 * Props:
 * - topic: string
 * - lessonContent: object (AI lesson content payload)
 * - isOpen: boolean
 * - onClose: () => void
 */
export default function InlineQuizBlock({ topic = 'general', lessonContent, isOpen, onClose }) {
  const borderColor = useColorModeValue('blackAlpha.200', 'whiteAlpha.300');
  const subtleBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100');

  // Guard: do not render if closed
  if (!isOpen) return null;

  // Fetch state
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState('');
  const didFetch = useRef(false);

  // Quiz interaction state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // index -> selected option index (number)
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch quiz when opening first time or lessonContent changes
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!lessonContent) {
        setError('No lesson content available for quiz.');
        setLoading(false);
        return;
      }
      setError('');
      setLoading(true);
      try {
        const data = await aiGenerateQuiz({ lesson_content: lessonContent });
        if (!cancelled) setQuiz(data);
      } catch (err) {
        const msg = err?.response?.data?.detail || err?.message || 'Failed to generate quiz';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Only fetch on first mount for a given lessonContent identity
    // If lessonContent reference changes, refetch
    const signature = JSON.stringify({ t: topic, lc: lessonContent });
    if (!didFetch.current || didFetch.current !== signature) {
      didFetch.current = signature;
      run();
    }

    return () => {
      cancelled = true;
    };
  }, [topic, lessonContent]);

  const questions = useMemo(() => quiz?.questions || [], [quiz]);
  const total = questions.length;
  const progress = total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  const handleSelect = (idx) => {
    if (typeof idx !== 'number') return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: idx }));
  };

  const nextQuestion = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const submitQuiz = async () => {
    if (total === 0) return;
    setSubmitting(true);
    try {
      setSubmitted(true);
      // Optionally record completion for personalization
      try {
        await recordLessonCompletion({
          topic,
          completed_at: new Date().toISOString(),
        });
      } catch {
        // non-blocking
      }
    } finally {
      setSubmitting(false);
    }
  };

  const restartQuiz = () => {
    setAnswers({});
    setSubmitted(false);
    setCurrentIndex(0);
  };

  const score = useMemo(() => {
    if (!submitted) return 0;
    let s = 0;
    for (let i = 0; i < total; i++) {
      const chosen = answers[i];
      const correct = questions[i]?.correct_answer_index;
      if (typeof chosen === 'number' && typeof correct === 'number' && chosen === correct) {
        s += 1;
      }
    }
    return s;
  }, [submitted, answers, questions, total]);

  const q = questions[currentIndex] || {};
  const selected = answers[currentIndex];

  return (
    <Box
      role="region"
      aria-label="Inline quiz"
      mt={2}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="md"
      bg={subtleBg}
      overflow="hidden"
    >
      {/* Header */}
      <HStack justify="space-between" align="center" px={4} py={3} borderBottom="1px solid" borderColor={borderColor}>
        <HStack spacing={3}>
          <Heading size="md">Quiz</Heading>
          <Text fontSize="sm" color="gray.500">Topic: {topic}</Text>
        </HStack>
        <HStack spacing={2}>
          <Button size="sm" variant="outline" onClick={restartQuiz} isDisabled={loading}>
            Reset
          </Button>
          <Button size="sm" onClick={onClose} variant="ghost">
            Close
          </Button>
        </HStack>
      </HStack>

      {/* Body */}
      <Card m={3} bg="transparent" border="none" boxShadow="none">
        <CardBody>
          {loading ? (
            <Box textAlign="center" my={6}>
              <Heading size="sm" mb={3}>Generating Quiz…</Heading>
              <Progress size="sm" isIndeterminate colorScheme="cyan" />
            </Box>
          ) : error ? (
            <Alert status="error">{error}</Alert>
          ) : !quiz || total === 0 ? (
            <Box p={4}>
              <Heading size="sm" mb={1}>No Quiz Available</Heading>
              <Text color="gray.500">The AI did not return quiz questions.</Text>
            </Box>
          ) : (
            <Stack spacing={6}>
              {/* Progress */}
              {!submitted && (
                <Progress value={progress} size="sm" colorScheme="cyan" />
              )}

              {/* Questions */}
              {!submitted ? (
                <Stack spacing={6}>
                  <Text fontWeight="semibold" fontSize="sm" color="gray.500">
                    Question {currentIndex + 1} of {total}
                  </Text>
                  <Heading size="md">{q.question_text}</Heading>

                  <VStack align="stretch" spacing={3}>
                    {(q.options || []).map((opt, idx) => {
                      const isSel = selected === idx;
                      return (
                        <Button
                          key={idx}
                          onClick={() => handleSelect(idx)}
                          variant={isSel ? 'solid' : 'outline'}
                          colorScheme={isSel ? 'cyan' : 'gray'}
                          justifyContent="flex-start"
                          h="auto"
                          py={3}
                          px={4}
                          borderRadius="md"
                        >
                          {opt}
                        </Button>
                      );
                    })}
                  </VStack>

                  {/* Nav */}
                  <HStack justify="space-between" pt={2}>
                    <Button onClick={prevQuestion} isDisabled={currentIndex === 0} variant="outline">
                      Previous
                    </Button>
                    {currentIndex < total - 1 ? (
                      <Button onClick={nextQuestion} isDisabled={typeof selected !== 'number'}>
                        Next
                      </Button>
                    ) : (
                      <Button onClick={submitQuiz} isDisabled={Object.keys(answers).length !== total} isLoading={submitting}>
                        Submit Quiz
                      </Button>
                    )}
                  </HStack>
                </Stack>
              ) : (
                <Stack spacing={6}>
                  {/* Results */}
                  <Box p={4} border="1px solid" borderColor={borderColor} borderRadius="md">
                    <Heading size="md" mb={2}>Quiz Results</Heading>
                    <Text fontSize="xl" fontWeight="bold">
                      Score: {score} / {total}
                    </Text>
                    <Text color="gray.500" mt={2}>
                      {score / total >= 0.8
                        ? 'Excellent work! 🎉'
                        : score / total >= 0.6
                        ? 'Good job! 👍'
                        : 'Keep practicing! 💪'}
                    </Text>
                  </Box>

                  {/* Review */}
                  <Stack spacing={4}>
                    <Heading size="sm">Review</Heading>
                    <VStack align="stretch" spacing={3}>
                      {questions.map((qq, idx) => {
                        const choose = answers[idx];
                        const correct = qq.correct_answer_index;
                        const isCorrect = choose === correct;
                        return (
                          <Box
                            key={idx}
                            p={3}
                            border="1px solid"
                            borderColor={isCorrect ? 'green.300' : borderColor}
                            borderRadius="md"
                            bg={isCorrect ? 'green.50' : 'transparent'}
                            _dark={{ bg: isCorrect ? 'whiteAlpha.100' : 'transparent' }}
                          >
                            <Text fontWeight="semibold" mb={1}>
                              Q{idx + 1}. {qq.question_text}
                            </Text>
                            <Text color={isCorrect ? 'green.600' : 'red.400'}>
                              Your answer: {typeof choose === 'number' ? qq.options?.[choose] : 'No answer'} {isCorrect ? '✓' : '✗'}
                            </Text>
                            {!isCorrect && (
                              <Text mt={1}>
                                Correct answer: <b>{qq.options?.[correct]}</b>
                              </Text>
                            )}
                          </Box>
                        );
                      })}
                    </VStack>
                  </Stack>

                  <HStack>
                    <Button onClick={restartQuiz} variant="outline">Retry</Button>
                    <Button onClick={onClose}>Close</Button>
                  </HStack>
                </Stack>
              )}
            </Stack>
          )}
        </CardBody>
      </Card>
    </Box>
  );
}