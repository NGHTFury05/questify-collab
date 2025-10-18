import { extendTheme } from '@chakra-ui/react';

const config = {
  initialColorMode: 'system',
  useSystemColorMode: true,
};

const colors = {
  brand: {
    50: '#efeaff',
    100: '#d7cdff',
    200: '#b7a6ff',
    300: '#9780ff',
    400: '#7759ff',
    500: '#5227ff', // primary baseColor from DotGrid
    600: '#421ecc',
    700: '#311699',
    800: '#210f66',
    900: '#140a3d',
  },
  accent: {
    50: '#e6fcff',
    100: '#c0f6ff',
    200: '#8deeff',
    300: '#55e4ff',
    400: '#22d9ff',
    500: '#00d4ff', // activeColor from DotGrid
    600: '#00a9cc',
    700: '#008099',
    800: '#005866',
    900: '#003444',
  },
};

const shadows = {
  // Subtle elevation tiers
  elevation1: '0 1px 2px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.04)',
  elevation2: '0 3px 6px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)',
  elevation3: '0 8px 20px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.10)',
  focusRing: '0 0 0 2px var(--chakra-colors-accent-400)',
};

const semanticTokens = {
  colors: {
    bg: {
      default: 'gray.50',
      _dark: '#0b1020',
    },
    bgPanel: {
      default: 'white',
      _dark: 'rgba(15, 23, 42, 0.55)',
    },
    text: {
      default: 'gray.800',
      _dark: '#FFFFFF',
    },
    muted: {
      default: 'gray.600',
      _dark: 'rgba(255,255,255,0.78)',
    },
    border: {
      default: 'blackAlpha.200',
      _dark: 'whiteAlpha.300',
    },
    ring: {
      default: 'brand.500',
      _dark: 'brand.300',
    },
    glow: {
      default: 'rgba(82,39,255,0.18)',
      _dark: 'rgba(0,212,255,0.22)',
    },
  },
};

const styles = {
  global: {
    'html, body, #root': {
      minHeight: '100%',
      bg: 'bg',
      color: 'text',
    },
    // Accessible focus rings
    '*:focus-visible': {
      outline: 'none',
      boxShadow: shadows.focusRing,
    },
    // Placeholder/disabled legibility (WCAG AA)
    '.chakra-ui-dark input::placeholder, .chakra-ui-dark textarea::placeholder': {
      color: 'rgba(255,255,255,0.60)',
    },
    '.chakra-ui-light input::placeholder, .chakra-ui-light textarea::placeholder': {
      color: 'rgba(0,0,0,0.55)',
    },
    // Respect prefers-reduced-motion
    '@media (prefers-reduced-motion: reduce)': {
      '*': {
        animationDuration: '0.01ms !important',
        animationIterationCount: '1 !important',
        transitionDuration: '0.01ms !important',
        scrollBehavior: 'auto !important',
      },
    },
  },
};

const radii = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  '2xl': '22px',
  full: '9999px',
};

const fonts = {
  heading: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  body: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

// Baseline component microinteractions
const components = {
  Button: {
    baseStyle: {
      borderRadius: 'md',
      _focusVisible: {
        boxShadow: shadows.focusRing,
      },
    },
    sizes: {
      md: {
        px: 4,
        py: 2,
      },
    },
    variants: {
      solid: {
        bg: 'brand.500',
        color: 'white',
        _hover: {
          bg: 'brand.600',
          shadow: 'elevation2',
          filter: 'drop-shadow(0 0 12px var(--chakra-colors-glow))',
        },
        _active: {
          bg: 'brand.700',
          transform: 'scale(0.98)',
          shadow: 'elevation1',
        },
        // Reduced motion override
        '@media (prefers-reduced-motion: reduce)': {
          _active: { transform: 'none' },
          transition: 'none',
        },
      },
      outline: {
        borderColor: 'border',
        color: 'text',
        _hover: {
          bg: 'blackAlpha.50',
          _dark: { bg: 'whiteAlpha.100' },
        },
        _active: {
          transform: 'scale(0.98)',
        },
        '@media (prefers-reduced-motion: reduce)': {
          _active: { transform: 'none' },
          transition: 'none',
        },
      },
      ghost: {
        color: 'text',
        _hover: {
          bg: 'blackAlpha.50',
          _dark: { bg: 'whiteAlpha.100' },
        },
        _active: {
          transform: 'scale(0.98)',
        },
        '@media (prefers-reduced-motion: reduce)': {
          _active: { transform: 'none' },
          transition: 'none',
        },
      },
      accent: {
        bg: 'accent.500',
        color: 'black',
        _hover: { bg: 'accent.400' },
        _active: { bg: 'accent.600', transform: 'scale(0.98)' },
        '@media (prefers-reduced-motion: reduce)': {
          _active: { transform: 'none' },
          transition: 'none',
        },
      },
    },
    defaultProps: {
      size: 'md',
      variant: 'solid',
    },
  },

  Link: {
    baseStyle: {
      color: 'brand.400',
      _hover: {
        color: 'brand.300',
        textDecoration: 'none',
      },
      _focusVisible: {
        boxShadow: shadows.focusRing,
      },
      transitionProperty: 'color, filter, transform',
      transitionDuration: '150ms',
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
      },
    },
  },

  Card: {
    baseStyle: {
      container: {
        bg: 'bgPanel',
        borderWidth: '1px',
        borderColor: 'border',
        borderRadius: 'lg',
        boxShadow: 'elevation1',
        backdropFilter: 'blur(8px)',
        transitionProperty: 'box-shadow, transform, filter',
        transitionDuration: '160ms',
        _hover: {
          boxShadow: 'elevation2',
          filter: 'drop-shadow(0 0 10px var(--chakra-colors-glow))',
        },
        _active: {
          transform: 'scale(0.99)',
          boxShadow: 'elevation1',
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          _active: { transform: 'none' },
        },
      },
    },
  },

  Input: {
    baseStyle: {
      field: {
        _focusVisible: { boxShadow: shadows.focusRing, borderColor: 'ring' },
      },
    },
    variants: {
      outline: {
        field: {
          bg: 'transparent',
          borderColor: 'border',
          _hover: { borderColor: 'brand.400' },
        },
      },
    },
  },

  Select: {
    variants: {
      outline: {
        field: {
          bg: 'transparent',
          borderColor: 'border',
          _focusVisible: { boxShadow: shadows.focusRing, borderColor: 'ring' },
        },
      },
    },
  },

  Textarea: {
    variants: {
      outline: {
        bg: 'transparent',
        borderColor: 'border',
        _focusVisible: { boxShadow: shadows.focusRing, borderColor: 'ring' },
      },
    },
  },
};

export const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  styles,
  radii,
  fonts,
  shadows,
  components,
});

export default theme;