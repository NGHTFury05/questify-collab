import { NavLink as RouterLink, useLocation } from 'react-router-dom';
import {
  Box,
  HStack,
  VStack,
  Text,
  Icon,
  useColorModeValue,
  Button,
} from '@chakra-ui/react';
import {
  CalendarIcon,
  ChatIcon,
  StarIcon,
  EditIcon,
} from '@chakra-ui/icons';

const NAV_ITEMS = [
  { to: '/planner', label: 'Planner', icon: CalendarIcon },
  { to: '/community/general', label: 'Community', icon: ChatIcon },
  { to: '/blueprint', label: 'Course', icon: EditIcon },
  { to: '/quiz', label: 'Quiz', icon: StarIcon },
];

export default function MobileTabBar() {
  const location = useLocation();
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.300');
  const bg = useColorModeValue('rgba(255,255,255,0.8)', 'rgba(15,23,42,0.65)');
  const activeColor = useColorModeValue('brand.600', 'accent.300');
  const inactiveColor = useColorModeValue('gray.600', 'gray.300');

  return (
    <Box
      as="nav"
      aria-label="Bottom Navigation"
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      borderTop="1px"
      borderColor={borderColor}
      bg={bg}
      backdropFilter="blur(10px)"
      display={{ base: 'block', md: 'none' }}
      zIndex="docked"
    >
      <HStack
        justify="space-around"
        px={2}
        py={2}
        // Safe-area padding for notched devices
        pb="calc(0.5rem + env(safe-area-inset-bottom))"
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.to ||
            location.pathname.startsWith(`${item.to}/`);
          return (
            <Button
              key={item.to}
              as={RouterLink}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              variant="ghost"
              height="auto"
              px={3}
              py={1}
              borderRadius="md"
              _active={{ transform: 'scale(0.98)' }}
              transition="transform 120ms"
            >
              <VStack spacing={0.5}>
                <Icon
                  as={item.icon}
                  boxSize={5}
                  color={isActive ? activeColor : inactiveColor}
                  aria-hidden
                />
                <Text
                  fontSize="xs"
                  color={isActive ? activeColor : inactiveColor}
                  fontWeight={isActive ? 'semibold' : 'normal'}
                >
                  {item.label}
                </Text>
              </VStack>
            </Button>
          );
        })}
      </HStack>
    </Box>
  );
}