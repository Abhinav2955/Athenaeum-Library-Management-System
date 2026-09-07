import {
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import Login
  from '../pages/Login';

import Register
  from '../pages/Register';

import VerifyEmail
  from '../pages/VerifyEmail';

import ForgotPassword
  from '../pages/ForgotPassword';

import ResetPassword
  from '../pages/ResetPassword';

import Dashboard
  from '../pages/Dashboard';

import Catalog
  from '../pages/Catalog';

import BookDetail
  from '../pages/BookDetail';

import MyLoans
  from '../pages/MyLoans';

import Reservations
  from '../pages/Reservations';

import Fines
  from '../pages/Fines';

import AdminDashboard
  from '../pages/AdminDashboard';

import AdminBooks
  from '../pages/AdminBooks';

import AdminBookCopies
  from '../pages/AdminBookCopies';

import CirculationDesk
  from '../pages/CirculationDesk';

import ProtectedRoute
  from './ProtectedRoute';

export default function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Login />
        }
      />

      <Route
        path="/register"
        element={
          <Register />
        }
      />

      <Route
        path="/verify-email"
        element={
          <VerifyEmail />
        }
      />

      <Route
        path="/forgot-password"
        element={
          <ForgotPassword />
        }
      />

      <Route
        path="/reset-password"
        element={
          <ResetPassword />
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/catalog"
        element={
          <ProtectedRoute>
            <Catalog />
          </ProtectedRoute>
        }
      />

      <Route
        path="/catalog/:id"
        element={
          <ProtectedRoute>
            <BookDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/loans"
        element={
          <ProtectedRoute>
            <MyLoans />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reservations"
        element={
          <ProtectedRoute>
            <Reservations />
          </ProtectedRoute>
        }
      />

      <Route
        path="/fines"
        element={
          <ProtectedRoute>
            <Fines />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute
            roles={[
              'admin',
              'librarian',
            ]}
          >
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/circulation"
        element={
          <ProtectedRoute
            roles={[
              'admin',
              'librarian',
            ]}
          >
            <CirculationDesk />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/books"
        element={
          <ProtectedRoute
            roles={[
              'admin',
              'librarian',
            ]}
          >
            <AdminBooks />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/books/:bookId/copies"
        element={
          <ProtectedRoute
            roles={[
              'admin',
              'librarian',
            ]}
          >
            <AdminBookCopies />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
}