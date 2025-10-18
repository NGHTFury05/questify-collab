import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  Card,
  CardBody,
  Stack,
  SimpleGrid,
  Button,
} from '@chakra-ui/react';

export default function CourseBlueprintPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const blueprint = location.state?.blueprint;
  const context = location.state?.context;

  useEffect(() => {
    if (!blueprint || !context) {
      navigate('/planner', { replace: true });
    }
  }, [blueprint, context, navigate]);

  if (!blueprint || !context) {
    return null;
  }

  const { course_title, modules = [] } = blueprint;
  const { level, topic } = context;

  const goToLesson = (mod) => {
    navigate('/lesson', {
      state: {
        course_title: course_title,
        module_title: mod.title,
        level,
        topic,
      },
    });
  };

  return (
    <Box maxW="5xl" mx="auto" mt={10} px={4}>
      <Heading size="lg" mb={2}>
        {course_title}
      </Heading>
      <Text color="gray.600" mb={6}>
        Goal: {context.goal_type} • Topic: {topic} • Level: {level}
      </Text>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        {modules.map((mod) => (
          <Card key={mod.id} _hover={{ shadow: 'md' }}>
            <CardBody>
              <Stack spacing={2}>
                <Heading size="md">{mod.title}</Heading>
                <Text color="gray.700">{mod.description}</Text>
                <Button
                  alignSelf="flex-start"
                  colorScheme="teal"
                  onClick={() => goToLesson(mod)}
                >
                  View Lesson
                </Button>
              </Stack>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
    </Box>
  );
}