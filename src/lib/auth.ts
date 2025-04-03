import { supabase } from './supabase';

// Get Microsoft Graph token from Supabase
export async function getGraphToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    // Get Microsoft token from user metadata
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.user_metadata?.microsoft_token) {
      throw new Error('No Microsoft token found');
    }

    return user.user_metadata.microsoft_token;
  } catch (error) {
    console.error('Error getting Microsoft token:', error);
    throw error;
  }
}

// Helper function to check if user has Microsoft token
export async function hasMicrosoftToken(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return !!user?.user_metadata?.microsoft_token;
  } catch (error) {
    console.error('Error checking Microsoft token:', error);
    return false;
  }
}

// Link Microsoft account
export async function linkMicrosoftAccount(token: string) {
  try {
    const { data: { user }, error } = await supabase.auth.updateUser({
      data: { microsoft_token: token }
    });

    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error linking Microsoft account:', error);
    throw error;
  }
}