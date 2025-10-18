import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  Input,
  Link,
  Stack,
  Text,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      const data = await signup({ email, password, username });
      if (data?.access_token) {
        // Token available -> proceed to planner
        navigate('/planner');
      } else {
        // Most likely email confirmation required
        setInfo(
          data?.message ||
            'Signup successful. Please check your email to confirm your account, then log in.'
        );
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      let msg = 'Signup failed';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (detail && typeof detail === 'object') {
        // Backend may return { detail: { message, debug } }
        msg = detail.message || msg;
        if (detail.debug?.message) {
          msg += ` (${detail.debug.message})`;
        }
      } else if (err?.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box maxW="lg" mx="auto" mt={12} px={4}>
      <Heading size="lg" mb={6} textAlign="center">
        Sign up
      </Heading>

      <Card>
        <CardBody>
          <form onSubmit={onSubmit}>
            <Stack spacing={4}>
              {error && (
                <Alert status="error" alignItems="start">
                  <Box>
                    <AlertTitle>Signup failed</AlertTitle>
                    <AlertDescription>{String(error)}</AlertDescription>
                  </Box>
                </Alert>
              )}

              {info && (
                <Alert status="info" alignItems="start">
                  <Box>
                    <AlertTitle>Check your email</AlertTitle>
                    <AlertDescription>{info}</AlertDescription>
                  </Box>
                </Alert>
              )}

              <Stack spacing={1}>
                <Text fontWeight="medium">Email</Text>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Stack>

              <Stack spacing={1}>
                <Text fontWeight="medium">Username</Text>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your-handle"
                />
              </Stack>

              <Stack spacing={1}>
                <Text fontWeight="medium">Password</Text>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Stack>

              <Button type="submit" colorScheme="teal" isLoading={submitting}>
                Create account
              </Button>

              <Text fontSize="sm" color="gray.600" textAlign="center">
                Already have an account?{' '}
                <Link as={RouterLink} to="/login" color="teal.500">
                  Log in
                </Link>
              </Text>
            </Stack>
          </form>
        </CardBody>
      </Card>
    </Box>
  );
}