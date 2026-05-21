'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { supabase } from '@/lib/supabase';

// Get all active users with their roles for a specific pharmacy
export async function getUsers(pharmacyId: string) {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        full_name,
        avatar_url,
        is_active,
        created_at,
        updated_at,
        role:roles(id, name),
        pharmacy_id
      `)
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: users, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// Get or Create Role
async function getOrCreateRole(roleName: string) {
  // First, check if role exists
  const { data: existingRole, error: fetchError } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .single();

  if (existingRole) {
    return existingRole.id;
  }

  // Create role if it doesn't exist
  const { data: newRole, error: insertError } = await supabaseAdmin
    .from('roles')
    .insert({ name: roleName, permissions: {} })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return newRole.id;
}

// Create a new user
export async function createUser(data: {
  username: string;
  fullName: string;
  password?: string;
  roleName: string;
  pharmacyId: string;
}) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to create users. Please add it to your environment variables.");
    }

    // Ensure role exists
    const roleId = await getOrCreateRole(data.roleName);

    // 1. Create auth user using admin API
    const password = data.password || '12345678'; // Default password if none provided
    const normalizedUsername = data.username.trim().replace(/\s+/g, '').toLowerCase();
    const email = normalizedUsername.includes('@') ? normalizedUsername : `${normalizedUsername}@pharmacyos.admin`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Failed to create auth user");

    // 2. Insert into public.users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: data.fullName,
        role_id: roleId,
        pharmacy_id: data.pharmacyId,
        is_active: true
      });

    if (dbError) {
      // Rollback auth user creation if db insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }

    return { data: authData.user, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// Update an existing user
export async function updateUser(id: string, data: {
  fullName?: string;
  roleName?: string;
  isActive?: boolean;
  avatarUrl?: string | null;
}) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to update users.");
    }

    const updates: any = {};
    if (data.fullName !== undefined) updates.full_name = data.fullName;
    if (data.isActive !== undefined) updates.is_active = data.isActive;
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;
    
    if (data.roleName) {
      updates.role_id = await getOrCreateRole(data.roleName);
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    // Optionally update auth user metadata if full_name changes
    if (data.fullName) {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: { full_name: data.fullName }
      });
    }

    return { data: true, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// Delete user (or deactivate)
export async function deleteUser(id: string) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to delete users.");
    }

    // Delete from auth (cascades to public.users because of ON DELETE CASCADE)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    return { data: true, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// Freeze or unfreeze all users of a specific role
export async function freezeUsersByRole(pharmacyId: string, roleName: string, active: boolean) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to manage roles.");
    }
    const roleId = await getOrCreateRole(roleName);
    
    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_active: active })
      .eq('pharmacy_id', pharmacyId)
      .eq('role_id', roleId);

    if (error) throw error;
    return { data: true, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}
