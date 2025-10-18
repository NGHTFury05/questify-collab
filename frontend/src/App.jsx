// frontend/src/App.jsx
import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ChakraProvider, Box } from '@chakra-ui/react'
import { AuthProvider } from './context/AuthContext'
import Header from './components/Header'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import GoalPlannerPage from './pages/GoalPlannerPage'
import CourseBlueprintPage from './pages/CourseBlueprintPage'
import LessonPage from './pages/LessonPage'
import ProtectedRoute from './components/ProtectedRoute'
import DotGrid from './components/DotGrid'

function App() {
  return (
    <ChakraProvider>
      <AuthProvider>
        <Router>
          <Box minH="100vh" position="relative" overflow="hidden">
            {/* DotGrid Background */}
            <Box position="fixed" top={0} left={0} w="100%" h="100%" zIndex={-1}>
              <DotGrid
                dotSize={10}
                gap={15}
                baseColor="#5227FF"
                activeColor="#00D4FF"
                proximity={120}
                shockRadius={250}
                shockStrength={5}
                resistance={750}
                returnDuration={1.5}
              />
            </Box>
            
            <Header />
            <Box as="main" position="relative" zIndex={1}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/planner" element={
                  <ProtectedRoute>
                    <GoalPlannerPage />
                  </ProtectedRoute>
                } />
                <Route path="/community/*" element={<Navigate to="/feed" replace />} />
                <Route path="/community/post/:id" element={<Navigate to="/feed" replace />} />
                <Route path="/course" element={
                  <ProtectedRoute>
                    <CourseBlueprintPage />
                  </ProtectedRoute>
                } />
                <Route path="/lesson/:id" element={
                  <ProtectedRoute>
                    <LessonPage />
                  </ProtectedRoute>
                } />
                <Route path="/quiz/*" element={<Navigate to="/lesson?quiz=open" replace />} />
                <Route path="/" element={<LoginPage />} />
              </Routes>
            </Box>
          </Box>
        </Router>
      </AuthProvider>
    </ChakraProvider>
  )
}

export default App
