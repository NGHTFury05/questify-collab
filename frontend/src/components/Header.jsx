import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Flex,
  Heading,
  Spacer,
  HStack,
  Button,
  Link,
  IconButton,
  useColorMode,
  useColorModeValue,
} from '@chakra-ui/react';
import { SunIcon, MoonIcon } from '@chakra-ui/icons';
import { useAuth } from '../context/AuthContext';

export default function Header({ appName = 'Questify Collab' }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { colorMode, toggleColorMode } = useColorMode();
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.300');
  const userTextColor = useColorModeValue('gray.600', 'gray.300');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const NavLink = ({ to, children }) => {
    const isActive =
      location.pathname === to || location.pathname.startsWith(`${to}/`);
    return (
      <Link
        as={RouterLink}
        to={to}
        aria-current={isActive ? 'page' : undefined}
        fontWeight={isActive ? 'semibold' : 'normal'}
        _hover={{ textDecoration: 'none', color: 'teal.400' }}
      >
        {children}
      </Link>
    );
  };

  return (
    <Box as="header" borderBottom="1px" borderColor={borderColor} mb={4} px={4} py={3}>
      <Flex align="center" gap={4}>
        <Heading size="md">
          <Link as={RouterLink} to="/" _hover={{ textDecoration: 'none' }}>
            {appName}
          </Link>
        </Heading>

        <HStack spacing={4}>
          {isAuthenticated && (
            <>
              <NavLink to="/planner">Planner</NavLink>
              <NavLink to="/community/general">Community</NavLink>
            </>
          )}
        </HStack>

        <Spacer />

        <HStack spacing={2}>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Toggle color mode"
            onClick={toggleColorMode}
            icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
          />
          {!isAuthenticated ? (
            <>
              <Button as={RouterLink} to="/login" size="sm" variant="outline">
                Log in
              </Button>
              <Button as={RouterLink} to="/signup" size="sm" colorScheme="teal">
                Sign up
              </Button>
            </>
          ) : (
            <>
              <Box fontSize="sm" color={userTextColor} display={{ base: 'none', md: 'block' }}>
                {user?.username || user?.email}
              </Box>
              <Button onClick={handleLogout} size="sm" variant="solid" colorScheme="red">
                Logout
              </Button>
            </>
          )}
        </HStack>
      </Flex>
    </Box>
  );
}