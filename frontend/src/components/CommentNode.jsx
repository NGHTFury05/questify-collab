import { useState } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Button,
  IconButton,
  useColorModeValue,
} from '@chakra-ui/react';
import { ChevronRightIcon, ChevronDownIcon } from '@chakra-ui/icons';

/**
 * CommentNode
 * Renders a single comment with optional nested children and collapse/expand.
 *
 * This component supports both:
 * - Flat list (no parent_id): pass children=[] and it will render a single node.
 * - Nested threads (if parent_id exists in live DB): recursively render children.
 *
 * Props:
 * - comment: {
 *     id: string|number,
 *     user_id: string,
 *     content: string,
 *     created_at: string | Date,
 *     upvotes?: number,
 *     downvotes?: number
 *   }
 * - childrenNodes?: Array<comment> (defaults: [])
 * - depth?: number (defaults: 0)
 * - collapsed?: boolean (initial collapsed state)
 * - onToggle?: (id: string|number, collapsed: boolean) => void
 */
export default function CommentNode({
  comment,
  childrenNodes = [],
  depth = 0,
  collapsed: initialCollapsed = false,
  onToggle,
}) {
  const border = useColorModeValue('blackAlpha.200', 'whiteAlpha.300');
  const subtle = useColorModeValue('blackAlpha.50', 'whiteAlpha.100');
  const [collapsed, setCollapsed] = useState(!!initialCollapsed);

  if (!comment) return null;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    onToggle?.(comment.id, next);
  };

  const hasChildren = Array.isArray(childrenNodes) && childrenNodes.length > 0;

  return (
    <VStack align="stretch" spacing={2}>
      <Box
        pl={depth * 12}
        p={2}
        border="1px solid"
        borderColor={border}
        borderRadius="md"
        bg="transparent"
      >
        <HStack justify="space-between" align="start">
          <HStack>
            {hasChildren && (
              <IconButton
                aria-label={collapsed ? 'Expand replies' : 'Collapse replies'}
                icon={collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                size="xs"
                variant="ghost"
                onClick={toggle}
              />
            )}
            <VStack align="start" spacing={0}>
              <Text fontSize="sm" color="gray.500">
                {comment.user_id} • {new Date(comment.created_at).toLocaleString()}
              </Text>
              <Text whiteSpace="pre-wrap">{comment.content}</Text>
            </VStack>
          </HStack>
          <HStack spacing={2}>
            <Text fontSize="xs" color="gray.500">▲ {comment.upvotes || 0}</Text>
            <Text fontSize="xs" color="gray.500">▼ {comment.downvotes || 0}</Text>
          </HStack>
        </HStack>

        {hasChildren && !collapsed && (
          <Box mt={2} ml={3} borderLeft="2px solid" borderColor={border} pl={3} bg={subtle} borderRadius="sm">
            <VStack align="stretch" spacing={2}>
              {childrenNodes.map((child) => (
                <CommentNode
                  key={child.id}
                  comment={child}
                  childrenNodes={[]}
                  depth={depth + 1}
                  collapsed={false}
                  onToggle={onToggle}
                />
              ))}
            </VStack>
          </Box>
        )}
      </Box>
    </VStack>
  );
}