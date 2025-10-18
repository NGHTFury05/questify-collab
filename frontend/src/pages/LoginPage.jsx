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
} from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate('/planner');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Login failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box maxW="lg" mx="auto" mt={12} px={4}>
      <Heading size="lg" mb={6} textAlign="center" className="gradient-text">
        Welcome Back
      </Heading>

      <div className="glass-card float-animation">
        <Card bg="transparent" border="none" boxShadow="none">
          <CardBody p={8}>
            <form onSubmit={onSubmit}>
              <Stack spacing={6}>
                {error && (
                  <Alert status="error" borderRadius="md" bg="rgba(254, 202, 202, 0.1)">
                    {error}
                  </Alert>
                )}
                <Stack spacing={2}>
                  <Text fontWeight="medium" className="text-primary">Email Address</Text>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    bg="rgba(255, 255, 255, 0.05)"
                    border="1px solid rgba(255, 255, 255, 0.2)"
                    _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
                    _focus={{ bg: "rgba(255, 255, 255, 0.1)", borderColor: "#64ffda" }}
                    color="white"
                    _placeholder={{ color: "rgba(255, 255, 255, 0.6)" }}
                  />
                </Stack>

                <Stack spacing={2}>
                  <Text fontWeight="medium" className="text-primary">Password</Text>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    bg="rgba(255, 255, 255, 0.05)"
                    border="1px solid rgba(255, 255, 255, 0.2)"
                    _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
                    _focus={{ bg: "rgba(255, 255, 255, 0.1)", borderColor: "#64ffda" }}
                    color="white"
                    _placeholder={{ color: "rgba(255, 255, 255, 0.6)" }}
                  />
                </Stack>

                <Button 
                  type="submit" 
                  className="btn-glass"
                  isLoading={submitting}
                  loadingText="Signing in..."
                  _loading={{ bg: "rgba(255, 255, 255, 0.2)" }}
                >
                  Sign In
                </Button>

                <Text fontSize="sm" className="text-muted" textAlign="center">
                  New here?{' '}
                  <Link as={RouterLink} to="/signup" color="#64ffda" _hover={{ color: "#00bcd4" }}>
                    Create Account
                  </Link>
                </Text>
              </Stack>
            </form>
          </CardBody>
        </Card>
      </div>
    </Box>
  );
}
