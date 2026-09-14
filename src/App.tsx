import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { DialogProvider } from '@/hooks/DialogProvider'
import { HouseholdProvider } from '@/hooks/HouseholdProvider'
import { AuthProvider } from '@/lib/auth'
import { CloseFdPage } from '@/pages/CloseFdPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { FdDetailPage } from '@/pages/FdDetailPage'
import { FdFormPage } from '@/pages/FdFormPage'
import { FamilyFormPage } from '@/pages/FamilyFormPage'
import { FdListPage } from '@/pages/FdListPage'
import { ReceiptViewerPage } from '@/pages/ReceiptViewerPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { LoginPage } from '@/pages/LoginPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { MemberFormPage } from '@/pages/MemberFormPage'
import { MembersPage } from '@/pages/MembersPage'
import { AdminAccountsPage } from '@/pages/AdminAccountsPage'
import { ManageFamiliesPage } from '@/pages/ManageFamiliesPage'
import { MoveFdsPage } from '@/pages/MoveFdsPage'
import { PassbookListPage } from '@/pages/PassbookListPage'
import { PassbookPage } from '@/pages/PassbookPage'
import { SettingsPage } from '@/pages/SettingsPage'

export default function App() {
  return (
    <DialogProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<ProtectedRoute />}>
              <Route
                element={
                  <HouseholdProvider>
                    <AppShell />
                  </HouseholdProvider>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/members" element={<MembersPage />} />
                <Route path="/members/new" element={<MemberFormPage />} />
                <Route path="/members/:memberId" element={<MemberFormPage />} />
                <Route path="/families/new" element={<FamilyFormPage />} />
                <Route path="/families/:familyId" element={<FamilyFormPage />} />
                <Route path="/fds" element={<FdListPage />} />
                <Route path="/fds/new" element={<FdFormPage />} />
                <Route path="/fds/:fdId/edit" element={<FdFormPage />} />
                <Route path="/fds/:fdId/renew" element={<FdFormPage />} />
                <Route path="/fds/:fdId/close" element={<CloseFdPage />} />
                <Route path="/fds/:fdId/receipt" element={<ReceiptViewerPage />} />
                <Route path="/fds/:fdId" element={<FdDetailPage />} />
                <Route path="/passbooks" element={<PassbookListPage />} />
                <Route path="/passbooks/:memberId" element={<PassbookPage />} />
                <Route path="/settings/accounts" element={<AdminAccountsPage />} />
                <Route path="/settings/families" element={<ManageFamiliesPage />} />
                <Route path="/settings/move-fds" element={<MoveFdsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </DialogProvider>
  )
}
