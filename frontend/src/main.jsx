import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider, ColorModeScript, Box, Flex, Link, useColorMode } from '@chakra-ui/react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, ProtectedRoute } from './context/AuthContext.jsx'
import Header from './components/Header.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import GoalPlannerPage from './pages/GoalPlannerPage.jsx'
import CourseBlueprintPage from './pages/CourseBlueprintPage.jsx'
import LessonPage from './pages/LessonPage.jsx'
import NotFound from './pages/NotFound.jsx'
import CommunityFeedPage from './pages/CommunityFeedPage.jsx'
import ChatFriendsPage from './pages/ChatFriendsPage.jsx'
import DotGrid from './components/DotGrid.jsx'
import LeftNav from './components/LeftNav.jsx'
import MobileTabBar from './components/MobileTabBar.jsx'
import './index.css'
import theme from './theme/theme.js'

const appName = import.meta.env.VITE_APP_NAME || 'Questify Collab'

document.title = appName

// Legacy route adapters (redirects)
function LegacyPostToFeed() {
  const { id } = useParams();
  return <Navigate to={`/feed?thread=${encodeURIComponent(id)}`} replace />;
}
function LegacyTopicToFeed() {
  const { topic } = useParams();
  const to = topic ? `/feed?tag=${encodeURIComponent(topic)}` : '/feed';
  return <Navigate to={to} replace />;
}
function LegacyQuizToLesson() {
  return <Navigate to="/lesson?quiz=open" replace />;
}
function FriendsToChat() {
  return <Navigate to="/chat" replace />;
}

function AppRouter() {
  return (
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <AuthProvider>
        {/* Fullscreen animated background layer */}
        <DotGridWrapper />
        <BrowserRouter>
          {/* Foreground content above background */}
          <div className="content-layer">
            <Link
              href="#main-content"
              position="absolute"
              left="-9999px"
              _focus={{
                left: '8px',
                top: '8px',
                bg: 'accent.500',
                color: 'black',
                px: 3,
                py: 2,
                zIndex: 'tooltip',
                borderRadius: 'md',
              }}
            >
              Skip to content
            </Link>
            <Header appName={appName} />
            <Flex align="flex-start">
              <LeftNav />
              <Box as="main" id="main-content" flex="1" px={{ base: 3, md: 6 }} py={4}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route
                    path="/planner"
                    element={
                      <ProtectedRoute>
                        <GoalPlannerPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/blueprint"
                    element={
                      <ProtectedRoute>
                        <CourseBlueprintPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/lesson"
                    element={
                      <ProtectedRoute>
                        <LessonPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/quiz" element={<LegacyQuizToLesson />} />
                  <Route
                    path="/feed"
                    element={
                      <ProtectedRoute>
                        <CommunityFeedPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/friends" element={<FriendsToChat />} />
                  <Route
                    path="/chat"
                    element={
                      <ProtectedRoute>
                        <ChatFriendsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/chat/:friendId"
                    element={
                      <ProtectedRoute>
                        <ChatFriendsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/community/:topic" element={<LegacyTopicToFeed />} />
                  <Route path="/community/post/:id" element={<LegacyPostToFeed />} />
                  <Route path="/" element={<Navigate to="/feed" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Box>
            </Flex>
            <MobileTabBar />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ChakraProvider>
  )
}

// Separate wrapper to access color mode for DotGrid
function DotGridWrapper() {
  const { colorMode } = useColorMode();
  const isLight = colorMode === 'light';
  return (
    <DotGrid
      className={`app-bg-layer ${!isLight ? 'dot-grid--subdued' : ''}`}
      baseColor={isLight ? '#FF0000' : '#5227FF'}
      activeColor={isLight ? '#FF6666' : '#00D4FF'}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppRouter />
)
