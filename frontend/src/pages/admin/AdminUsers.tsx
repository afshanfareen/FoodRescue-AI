import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { Users, CheckCircle, XCircle, UserCheck } from 'lucide-react'

export function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState('')
  const qc = useQueryClient()

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', roleFilter],
    queryFn: () => adminApi.users({ role: roleFilter || undefined, limit: 100 }).then(r => r.data),
  })

  const { data: volunteers } = useQuery({
    queryKey: ['admin-volunteers-list'],
    queryFn: () => adminApi.users({ role: 'VOLUNTEER', limit: 100 }).then(r => r.data),
  })

  const { data: ngos } = useQuery({
    queryKey: ['admin-ngos-list'],
    queryFn: () => adminApi.users({ role: 'NGO', limit: 100 }).then(r => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: string }) =>
      adminApi.updateUserStatus(userId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Roles</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="DONOR">Donor</SelectItem>
              <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
              <SelectItem value="NGO">NGO</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> All Users ({users?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">User</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Joined</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map((u: { id: number; name: string; email: string; role: string; status: string; created_at: string }) => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{u.name}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-medium px-2 py-1 rounded bg-blue-50 text-blue-700">{u.role}</span>
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={u.status} /></td>
                      <td className="py-3 px-4 text-xs text-gray-400">{formatDate(u.created_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {u.status !== 'ACTIVE' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-300"
                              onClick={() => statusMutation.mutate({ userId: u.id, status: 'ACTIVE' })}>
                              Activate
                            </Button>
                          )}
                          {u.status === 'ACTIVE' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-300"
                              onClick={() => statusMutation.mutate({ userId: u.id, status: 'SUSPENDED' })}>
                              Suspend
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PendingApprovalCard
            title="Pending Volunteer Approvals"
            users={volunteers?.filter((v: { role: string; is_approved: boolean | null }) => v.role === 'VOLUNTEER' && v.is_approved === false) || []}
            type="volunteer"
          />
          <PendingApprovalCard
            title="Pending NGO Approvals"
            users={ngos?.filter((n: { role: string; is_approved: boolean | null }) => n.role === 'NGO' && n.is_approved === false) || []}
            type="ngo"
          />
        </div>
      </div>
    </DashboardLayout>
  )
}

function PendingApprovalCard({ title, users, type }: { title: string; users: { id: number; name: string; email: string }[]; type: string }) {
  const qc = useQueryClient()

  const approveMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      type === 'volunteer'
        ? adminApi.approveVolunteer(id, approved)
        : adminApi.approveNGO(id, approved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-volunteers-list'] })
      qc.invalidateQueries({ queryKey: ['admin-ngos-list'] })
      toast.success('Decision recorded')
    },
    onError: () => toast.error('Action failed'),
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-orange-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-center text-gray-400 py-6 text-sm">No pending approvals</p>
        ) : (
          <div className="space-y-2">
            {users.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <div className="font-medium text-sm text-gray-900">{u.name}</div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => approveMutation.mutate({ id: u.id, approved: true })}>
                    <CheckCircle className="w-3 h-3" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-300"
                    onClick={() => approveMutation.mutate({ id: u.id, approved: false })}>
                    <XCircle className="w-3 h-3" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
