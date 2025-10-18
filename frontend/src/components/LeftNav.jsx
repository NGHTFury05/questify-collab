import { useEffect, useMemo, useState } from 'react';
import { NavLink as RouterLink, useLocation } from 'react-router-dom';
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Button,
  IconButton,
  Tooltip,
  useColorModeValue,
  Badge,
  Divider,
} from '@chakra-ui/react';
import {
  CalendarIcon,
  ChatIcon,
  EditIcon,
  ViewIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@chakra-ui/icons';

const STORAGE_KEY = 'nav:collapsed';

const NAV_ITEMS = [
  { to: '/feed', label: 'Feed', icon: ViewIcon },
  { to: '/planner', label: 'Planner', icon: CalendarIcon },
  { to: '/blueprint', label: 'Course', icon: EditIcon },
  { to: '/chat', label: 'Chat', icon: ChatIcon, badgeKey: 'chat' },
];

export default function LeftNav() {
  const location = useLocation();
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.300');
  const activeBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100');

  const [collapsed, setCollapsed] = useState(true);
  const [badges, setBadges] = useState({ chat: 0 });

  // Hydrate collapse state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved != null) setCollapsed(saved === 'true');
    } catch {
      /* noop */
    }
  }, []);
  const persistCollapsed = (val) => {
    setCollapsed(val);
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
    } catch {
      /* noop */
    }
  };

  // Placeholder: could pull counts (friend requests, unread) later
  useEffect(() => {
    setBadges((b) => ({ ...b })); // no-op now; reserved for future hook
  }, []);

  const width = useMemo(() => (collapsed ? '16' : '72'), [collapsed]); // 4rem vs 18rem

  const ToggleButton = (
    <Tooltip label={collapsed ? 'Expand navigation' : 'Collapse navigation'} placement="right" isDisabled={!collapsed}>
      <IconButton
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        aria-expanded={!collapsed}
        icon={collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        variant="ghost"
        size="sm"
        onClick={() => persistCollapsed(!collapsed)}
      />
    </Tooltip>
  );

  return (
    <Box
      as="nav"
      aria-label="Primary"
      display={{ base: 'none', md: 'block' }}
      w={width}
      flex="0 0 auto"
      borderRight="1px"
      borderColor={borderColor}
      py={3}
      px={collapsed ? 2 : 3}
      position="sticky"
      top={0}
      h="100vh"
      overflowY="auto"
      transitionProperty="width, padding"
      transitionDuration="160ms"
    >
      <VStack align="stretch" spacing={2} role="list">
        <HStack justify={collapsed ? 'center' : 'space-between'} px={collapsed ? 0 : 1} py={1}>
          {!collapsed && (
            <Text fontSize="sm" color="muted" fontWeight="semibold">
              Navigation
            </Text>
          )}
          {ToggleButton}
        </HStack>

        {!collapsed && <Divider />}

        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          const Btn = (
            <Button
              as={RouterLink}
              to={item.to}
              key={item.to}
              role="listitem"
              justifyContent={collapsed ? 'center' : 'flex-start'}
              variant="ghost"
              leftIcon={
                <Icon as={item.icon} boxSize={5} aria-hidden />
              }
              aria-current={isActive ? 'page' : undefined}
              borderRadius="full"
              px={collapsed ? 0 : 3}
              py={collapsed ? 3 : 6}
              fontWeight={isActive ? 'semibold' : 'normal'}
              bg={isActive ? activeBg : 'transparent'}
              _hover={{ bg: activeBg }}
              _active={{ transform: 'scale(0.99)' }}
              transitionProperty="background, transform, box-shadow, padding"
              transitionDuration="150ms"
              width="100%"
              tabIndex={0}
            >
              {!collapsed && (
                <HStack spacing={3} flex="1" justify="space-between">
                  <Text>{item.label}</Text>
                  {item.badgeKey && badges[item.badgeKey] > 0 && (
                    <Badge colorScheme="purple" borderRadius="full">
                      {badges[item.badgeKey]}
                    </Badge>
                  )}
                </HStack>
              )}
            </Button>
          );

          return collapsed ? (
            <Tooltip key={item.to} label={item.label} placement="right">
              <Box>{Btn}</Box>
            </Tooltip>
          ) : (
            <Box key={item.to}>{Btn}</Box>
          );
        })}
      </VStack>
    </Box>
  );
}