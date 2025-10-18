import { useCallback, useMemo, useState } from 'react';
import {
  Card,
  CardBody,
  Stack,
  Heading,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  Textarea,
  Button,
  HStack,
  Switch,
  Text,
  Box,
  Divider,
  useToast,
  useColorModeValue,
} from '@chakra-ui/react';
import { api } from '../lib/api';
import useHaptics from '../hooks/useHaptics';

function validateTitle(title) {
  if (!title || !title.trim()) return 'Title is required';
  if (title.trim().length < 3) return 'Title must be at least 3 characters';
  if (title.trim().length > 120) return 'Title must be 120 characters or fewer';
  return '';
}

function validateContent(content) {
  if (!content || !content.trim()) return 'Content is required';
  if (content.trim().length < 10) return 'Please provide at least 10 characters of context';
  return '';
}

export default function Composer({ topic = 'general', onCreated }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState({ title: '', content: '' });

  // Drag-drop placeholder state (no backend upload in Phase 1)
  const [files, setFiles] = useState([]);

  const { success: hSuccess, error: hError, impact: hImpact } = useHaptics();
  const toast = useToast();

  const borderColor = useColorModeValue('blackAlpha.200', 'whiteAlpha.300');
  const dropBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100');

  const titleError = useMemo(() => validateTitle(title), [title]);
  const contentError = useMemo(() => validateContent(content), [content]);

  const [preview, setPreview] = useState(false);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const list = Array.from(e.dataTransfer?.files || []);
    if (list.length) {
      setFiles((prev) => [...prev, ...list]);
      hImpact();
      toast({
        title: 'Attachments added',
        description: `${list.length} file(s) attached (placeholder)`,
        status: 'info',
        duration: 2000,
        isClosable: true,
      });
    }
  }, [toast, hImpact]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();

    const tErr = titleError;
    const cErr = contentError;
    setErrors({ title: tErr, content: cErr });
    if (tErr || cErr) {
      hError();
      return;
    }

    setCreating(true);
    try {
      const payload = { topic, title: title.trim(), content: content.trim() };
      await api.post('/community/posts', payload);
      setTitle('');
      setContent('');
      setFiles([]);
      hSuccess();
      toast({
        title: 'Post created',
        description: 'Your discussion has been published.',
        status: 'success',
        duration: 2500,
        isClosable: true,
      });
      onCreated?.();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to create post';
      hError();
      toast({
        title: 'Failed to create post',
        description: msg,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setCreating(false);
    }
  }, [titleError, contentError, topic, title, content, onCreated, hSuccess, hError, toast]);

  return (
    <Card mb={6}>
      <CardBody as="form" onSubmit={handleSubmit}>
        <Stack spacing={4}>
          <HStack justify="space-between" align="center">
            <Heading size="md">Create a new post</Heading>
            <HStack>
              <Text fontSize="sm" color="muted">Preview</Text>
              <Switch
                isChecked={preview}
                onChange={(e) => setPreview(e.target.checked)}
                aria-label="Toggle preview"
              />
            </HStack>
          </HStack>

          <FormControl isInvalid={!!errors.title}>
            <FormLabel>Title</FormLabel>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((er) => ({ ...er, title: '' }));
              }}
              placeholder="What do you want to discuss?"
              maxLength={120}
              onBlur={() => setErrors((er) => ({ ...er, title: validateTitle(title) }))}
            />
            {errors.title && <FormErrorMessage>{errors.title}</FormErrorMessage>}
          </FormControl>

          <FormControl isInvalid={!!errors.content}>
            <FormLabel>Content</FormLabel>
            {!preview ? (
              <Textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  if (errors.content) setErrors((er) => ({ ...er, content: '' }));
                }}
                placeholder="Provide context, examples, or your question"
                rows={6}
                onBlur={() => setErrors((er) => ({ ...er, content: validateContent(content) }))}
              />
            ) : (
              <Box
                border="1px solid"
                borderColor={borderColor}
                borderRadius="md"
                p={3}
                bg="transparent"
                minH="136px"
                whiteSpace="pre-wrap"
              >
                {content || <Text color="muted">Nothing to preview yet…</Text>}
              </Box>
            )}
            {errors.content && <FormErrorMessage>{errors.content}</FormErrorMessage>}
          </FormControl>

          {/* Drag & drop area - placeholder UX in Phase 1 */}
          <Box
            border="1px dashed"
            borderColor={borderColor}
            borderRadius="md"
            p={3}
            onDragOver={onDragOver}
            onDrop={onDrop}
            bg={dropBg}
          >
            <Text fontSize="sm" color="muted">
              Drag and drop files here (placeholder). Attachments are not uploaded in Phase 1.
            </Text>
            {!!files.length && (
              <Text fontSize="sm" mt={2}>
                {files.length} file(s) attached
              </Text>
            )}
          </Box>

          <Divider />

          <HStack>
            <Button
              type="submit"
              colorScheme="teal"
              isLoading={creating}
              onMouseDown={() => hImpact()}
            >
              Publish
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTitle('');
                setContent('');
                setFiles([]);
              }}
            >
              Clear
            </Button>
          </HStack>
        </Stack>
      </CardBody>
    </Card>
  );
}