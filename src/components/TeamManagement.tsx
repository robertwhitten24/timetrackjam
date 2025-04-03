import React, { useState, useEffect } from 'react';
import { Users, Mail, Key, Plus, Trash2, Crown, Shield, Eye, EyeOff, User, Lock, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AVAILABLE_PERMISSIONS } from '../lib/types';
import ProfileSettings from './ProfileSettings';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'standard';
  permissions?: string[];
  isCurrentUser?: boolean;
}

export default function TeamManagement() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'standard'>('standard');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['timer']);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'standard'>('standard');
  const [showPermissions, setShowPermissions] = useState(true);

  useEffect(() => {
    getCurrentUser();
    fetchTeamMembers();
  }, []);

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get current user's role
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (currentProfile) {
      setCurrentUserRole(currentProfile.role);
    }
  }

  async function fetchTeamMembers() {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    // Get current user's role
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (currentProfile) {
      setCurrentUserRole(currentProfile.role);
    }

    // Fetch all profiles including current user
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, permissions')
      .order('full_name');
    
    if (error) {
      console.error('Error fetching team members:', error);
      return;
    }
    
    if (data) {
      // Mark the current user in the team members list
      const membersWithCurrentUser = data.map(member => ({
        ...member,
        isCurrentUser: member.id === currentUser.id
      }));
      setTeamMembers(membersWithCurrentUser);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Check if current user is admin
      if (currentUserRole !== 'admin') {
        throw new Error('Only administrators can add team members');
      }

      // Check if user already exists
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingProfiles) {
        throw new Error('A user with this email already exists');
      }

      // Create new user account using signUp
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Failed to create user');

      // Create profile for the new user
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: fullName,
          email: email,
          role: role,
          permissions: selectedPermissions
        });

      if (profileError) throw profileError;

      // Clear form
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('standard');
      setSelectedPermissions(['timer']);
      
      // Refresh team members list
      await fetchTeamMembers();

    } catch (err) {
      console.error('Error adding team member:', err);
      setError(err instanceof Error ? err.message : 'Failed to invite team member');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      // Check if current user is admin
      if (currentUserRole !== 'admin') {
        throw new Error('Only administrators can remove team members');
      }

      // Delete the user's profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      // The auth user will be automatically deleted due to the ON DELETE CASCADE constraint
      await fetchTeamMembers();
    } catch (err) {
      console.error('Error removing team member:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove team member');
    }
  }

  async function handleUpdatePermissions(userId: string, permissions: string[]) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ permissions })
        .eq('id', userId);

      if (error) throw error;
      await fetchTeamMembers();
    } catch (err) {
      console.error('Error updating permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to update permissions');
    }
  }

  if (currentUserRole !== 'admin') {
    return (
      <div className="space-y-6">
        <ProfileSettings />
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Shield className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-800">Team Members</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className={`py-4 flex items-center justify-between ${
                  member.isCurrentUser ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  {member.role === 'admin' ? (
                    <Crown className="w-5 h-5 text-primary" />
                  ) : (
                    <Shield className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {member.full_name}
                      {member.isCurrentUser && (
                        <span className="ml-2 text-sm text-primary">(You)</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {member.email}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {member.role === 'admin' ? 'Administrator' : 'Standard User'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileSettings />

      {/* Add Team Member Form */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold text-gray-800">Add Team Member</h2>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                  required
                  placeholder="John Doe"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                  required
                  placeholder="john@example.com"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                  required
                  placeholder="••••••••"
                  minLength={6}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as 'admin' | 'standard');
                  if (e.target.value === 'admin') {
                    setSelectedPermissions(AVAILABLE_PERMISSIONS.map(p => p.id));
                  }
                }}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                required
              >
                <option value="standard">Standard User</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          {/* Permissions Section */}
          {role === 'standard' && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Key className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-medium text-gray-900">Permissions</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPermissions(!showPermissions)}
                  className="text-sm text-primary hover:text-primary-light flex items-center"
                >
                  {showPermissions ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Hide Permissions
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Show Permissions
                    </>
                  )}
                </button>
              </div>

              {showPermissions && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="text-sm text-gray-600 mb-4 flex items-start space-x-2">
                    <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <p>Select the permissions this user requires to perform their role effectively:</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {AVAILABLE_PERMISSIONS.map((permission) => (
                      <label
                        key={permission.id}
                        className={`
                          flex items-start space-x-3 p-4 rounded-lg border transition-colors duration-200
                          ${selectedPermissions.includes(permission.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-primary/30 bg-white'
                          }
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPermissions([...selectedPermissions, permission.id]);
                            } else {
                              setSelectedPermissions(selectedPermissions.filter(p => p !== permission.id));
                            }
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{permission.name}</div>
                          <div className="text-sm text-gray-600 mt-1">{permission.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              <Plus className="w-5 h-5 mr-2" />
              {loading ? 'Adding...' : 'Add Team Member'}
            </button>
          </div>
        </form>
      </div>

      {/* Team Members List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Team Members</h3>
          <div className="divide-y divide-gray-200">
            {teamMembers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No team members yet. Add your first team member above.
              </p>
            ) : (
              teamMembers.map((member) => (
                <div
                  key={member.id}
                  className={`py-4 ${member.isCurrentUser ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {member.role === 'admin' ? (
                        <Crown className="w-5 h-5 text-primary" />
                      ) : (
                        <Shield className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <div className="font-medium text-gray-900">
                          {member.full_name}
                          {member.isCurrentUser && (
                            <span className="ml-2 text-sm text-primary">(You)</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-500">
                        {member.role === 'admin' ? 'Administrator' : 'Standard User'}
                      </div>
                      {!member.isCurrentUser && (
                        <button
                          onClick={() => handleRemove(member.id)}
                          className="text-red-600 hover:text-red-900 p-2"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Member Permissions */}
                  {!member.isCurrentUser && member.role === 'standard' && (
                    <div className="mt-2 pl-8">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {AVAILABLE_PERMISSIONS.map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-center space-x-2"
                          >
                            <input
                              type="checkbox"
                              checked={member.permissions?.includes(permission.id)}
                              onChange={(e) => {
                                const newPermissions = e.target.checked
                                  ? [...(member.permissions || []), permission.id]
                                  : (member.permissions || []).filter(p => p !== permission.id);
                                handleUpdatePermissions(member.id, newPermissions);
                              }}
                              className="text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-gray-700">{permission.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}