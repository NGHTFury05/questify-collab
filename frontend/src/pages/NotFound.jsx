import { Box, Heading, Text, Button, Stack } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

export default function NotFound() {
  return (
    <Box maxW="2xl" mx="auto" py={20} px={6} textAlign="center">
      <Stack spacing={4}>
        <Heading size="2xl" className="gradient-text">404</Heading>
        <Heading size="lg">Page not found</Heading>
        <Text color="muted">
          The page you are looking for doesn't exist or has been moved.
        </Text>
        <Stack direction={{ base: 'column', sm: 'row' }} spacing={3} justify="center" pt={2}>
          <Button as={RouterLink} to="/planner" colorScheme="teal">
            Go to Planner
          </Button>
          <Button as={RouterLink} to="/community/general" variant="outline">
            Visit Community
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}