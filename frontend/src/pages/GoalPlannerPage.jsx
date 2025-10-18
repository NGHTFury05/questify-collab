import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  Input,
  Select,
  Stack,
  Alert,
  Text,
} from '@chakra-ui/react';
import { api } from '../lib/api';

export default function GoalPlannerPage() {
  const navigate = useNavigate();

  const [goalType, setGoalType] = useState('Course');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [objective, setObjective] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        goal_type: goalType,
        topic,
        level,
        objective,
      };
      const { data } = await api.post('/ai/generate-blueprint', payload);
      // Navigate to blueprint page, pass data in state
      navigate('/blueprint', {
        state: {
          blueprint: data,
          context: payload,
        },
      });
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to generate course blueprint';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box maxW="2xl" mx="auto" mt={12} px={4}>
      <Heading size="lg" mb={6} textAlign="center">
        Plan Your Learning Goal
      </Heading>

      <Card>
        <CardBody>
          <form onSubmit={onSubmit}>
            <Stack spacing={4}>
              {error && (
                <Alert status="error">
                  {error}
                </Alert>
              )}
              <Stack spacing={1}>
                <Text fontWeight="medium">Goal Type</Text>
                <Select value={goalType} onChange={(e) => setGoalType(e.target.value)}>
                  <option value="Course">Course</option>
                  <option value="Exam Prep">Exam Prep</option>
                  <option value="Certification">Certification</option>
                  <option value="Project-based">Project-based</option>
                </Select>
              </Stack>

              <Stack spacing={1}>
                <Text fontWeight="medium">Topic</Text>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder='e.g., "Python", "CAT Exam"'
                />
              </Stack>

              <Stack spacing={1}>
                <Text fontWeight="medium">Level</Text>
                <Select value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </Select>
              </Stack>

              <Stack spacing={1}>
                <Text fontWeight="medium">Objective</Text>
                <Input
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Describe your objective in one sentence"
                />
              </Stack>

              <Button type="submit" colorScheme="teal" isLoading={submitting}>
                Generate Blueprint
              </Button>
            </Stack>
          </form>
        </CardBody>
      </Card>
    </Box>
  );
}