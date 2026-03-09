import { supabase } from './supabase';

// ─── HELPER: Get current user ID ──────────────────────────
const getUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');
  return user.id;
};

// Get the effective project owner ID (for members viewing a shared project)
export const getActiveProjectOwnerId = async (): Promise<string> => {
  const uid = await getUserId();

  // Check if this user is a member of another project
  const { data: membership } = await supabase
    .from('project_members')
    .select('owner_id')
    .eq('member_id', uid)
    .eq('status', 'accepted')
    .limit(1)
    .maybeSingle();

  // If member of a project, return the owner's ID; otherwise return own ID
  return membership?.owner_id || uid;
};

// Get the user's role in the current project
export const getUserRole = async (): Promise<string> => {
  const uid = await getUserId();

  // Check if member of another project
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('member_id', uid)
    .eq('status', 'accepted')
    .limit(1)
    .maybeSingle();

  return membership?.role || 'admin'; // Owner = admin by default
};

// ─── PROJECT MEMBERS ──────────────────────────────────────
export const fetchProjectMembers = async () => {
  const uid = await getUserId();
  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('owner_id', uid);
  if (error) console.error('fetchProjectMembers error:', error);
  return data || [];
};

export const inviteProjectMember = async (email: string, role: string) => {
  const uid = await getUserId();

  // Check if already invited
  const { data: existing } = await supabase
    .from('project_members')
    .select('id')
    .eq('owner_id', uid)
    .eq('member_email', email)
    .maybeSingle();

  if (existing) {
    throw new Error('Cette personne est déjà invitée.');
  }

  // Check if the invited user already has an account
  // We look for their user_id via their email in project_members or auth
  // For now, we just store the email and resolve member_id on login

  const { data, error } = await supabase.from('project_members').insert({
    owner_id: uid,
    member_email: email.toLowerCase().trim(),
    role,
    status: 'pending'
  }).select().single();

  if (error) {
    console.error('inviteProjectMember error:', error);
    throw error;
  }
  return data;
};

export const removeProjectMember = async (id: number) => {
  const { error } = await supabase.from('project_members').delete().eq('id', id);
  if (error) console.error('removeProjectMember error:', error);
};

export const updateMemberRole = async (id: number, role: string) => {
  const { error } = await supabase.from('project_members').update({ role }).eq('id', id);
  if (error) console.error('updateMemberRole error:', error);
};

// Called on login to accept pending invitations matching the user's email
export const acceptPendingInvitations = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;

  await supabase
    .from('project_members')
    .update({ member_id: user.id, status: 'accepted' })
    .eq('member_email', user.email.toLowerCase())
    .eq('status', 'pending');
};

// ─── BLOCKS ───────────────────────────────────────────────
export const fetchBlocks = async () => {
  const uid = await getActiveProjectOwnerId();
  const { data, error } = await supabase.from('blocks').select('*').eq('user_id', uid);
  if (error) console.error('fetchBlocks error:', error);
  return data || [];
};

export const createBlock = async (payload: { name: string; zone: string; description: string }) => {
  const uid = await getActiveProjectOwnerId();
  const { data, error } = await supabase.from('blocks').insert({ ...payload, user_id: uid }).select().single();
  if (error) console.error('createBlock error:', error);
  return data;
};

export const updateBlock = async (id: number, payload: { name: string; zone: string; description: string }) => {
  const { error } = await supabase.from('blocks').update(payload).eq('id', id);
  if (error) console.error('updateBlock error:', error);
};

export const deleteBlock = async (id: number) => {
  const { error } = await supabase.from('blocks').delete().eq('id', id);
  if (error) console.error('deleteBlock error:', error);
};

// ─── FLOORS ───────────────────────────────────────────────
export const fetchFloors = async () => {
  const uid = await getActiveProjectOwnerId();
  const { data, error } = await supabase
    .from('floors')
    .select('*, blocks(name)')
    .eq('user_id', uid)
    .order('order_number', { ascending: true });
  if (error) console.error('fetchFloors error:', error);
  return (data || []).map((f: any) => ({
    ...f,
    block_name: f.blocks?.name || 'Inconnu',
    blocks: undefined
  }));
};

export const createFloor = async (payload: { block_id: number; name: string; order_number: number }) => {
  const uid = await getActiveProjectOwnerId();
  const { data, error } = await supabase.from('floors').insert({ ...payload, user_id: uid }).select().single();
  if (error) console.error('createFloor error:', error);
  return data;
};

export const deleteFloor = async (id: number) => {
  const { error } = await supabase.from('floors').delete().eq('id', id);
  if (error) console.error('deleteFloor error:', error);
};

// ─── TEAMS ────────────────────────────────────────────────
export const fetchTeams = async () => {
  const uid = await getActiveProjectOwnerId();
  const { data, error } = await supabase
    .from('teams')
    .select('*, blocks(name)')
    .eq('user_id', uid);
  if (error) console.error('fetchTeams error:', error);
  return (data || []).map((t: any) => ({
    ...t,
    block_name: t.blocks?.name || null,
    blocks: undefined
  }));
};

export const createTeam = async (payload: { name: string; speciality: string; block_id: number | null; workers: number }) => {
  const uid = await getActiveProjectOwnerId();
  const { data, error } = await supabase.from('teams').insert({ ...payload, user_id: uid }).select().single();
  if (error) console.error('createTeam error:', error);
  return data;
};

export const updateTeam = async (id: number, payload: { name: string; speciality: string; block_id: number | null; workers: number }) => {
  const { error } = await supabase.from('teams').update(payload).eq('id', id);
  if (error) console.error('updateTeam error:', error);
};

export const deleteTeam = async (id: number) => {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) console.error('deleteTeam error:', error);
};

// ─── TASKS ────────────────────────────────────────────────
export const fetchTasks = async () => {
  const uid = await getActiveProjectOwnerId();
  const { data, error } = await supabase
    .from('tasks')
    .select('*, blocks(name), floors(name), teams(name)')
    .eq('user_id', uid)
    .order('start_date', { ascending: true });
  if (error) console.error('fetchTasks error:', error);
  return (data || []).map((t: any) => ({
    ...t,
    block_name: t.blocks?.name || null,
    floor_name: t.floors?.name || null,
    team_name: t.teams?.name || null,
    blocks: undefined,
    floors: undefined,
    teams: undefined
  }));
};

export const createTask = async (payload: any) => {
  const uid = await getActiveProjectOwnerId();
  let element_id = null;
  let slab_id = null;

  // Create structural element if type is specified
  if (payload.element_type === 'Dalle') {
    let finalBlockId = payload.block_id;
    let finalFloorId = payload.floor_id;

    if (!finalBlockId || !finalFloorId) {
      const { data: defaultBlock } = await supabase.from('blocks').select('id').eq('user_id', uid).order('id').limit(1).single();
      if (defaultBlock) {
        finalBlockId = finalBlockId || defaultBlock.id;
        const { data: defaultFloor } = await supabase.from('floors').select('id').eq('block_id', finalBlockId).order('id').limit(1).single();
        if (defaultFloor) finalFloorId = finalFloorId || defaultFloor.id;
      }
    }

    if (finalBlockId && finalFloorId) {
      const { data: slabData } = await supabase.from('slabs').insert({
        block_id: finalBlockId,
        floor_id: finalFloorId,
        name: payload.element,
        axes: payload.axes || null,
        surface: payload.surface ? parseFloat(payload.surface.toString()) : 0,
        start_date: payload.start_date,
        end_date: payload.end_date,
        status: payload.status || 'Non commencé',
        user_id: uid
      }).select('id').single();
      slab_id = slabData?.id || null;
    }
  } else if (['Poteau', 'Voile', 'Voile périphérique'].includes(payload.element_type)) {
    const { data: veData } = await supabase.from('vertical_elements').insert({
      block_id: payload.block_id,
      floor_id: payload.floor_id,
      type: payload.element_type,
      name: payload.element,
      axes: payload.axes || null,
      user_id: uid
    }).select('id').single();
    element_id = veData?.id || null;
  }

  const { data, error } = await supabase.from('tasks').insert({
    block_id: payload.block_id || null,
    floor_id: payload.floor_id || null,
    element: payload.element || null,
    description: (payload.description || payload.element) || null,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    duration: payload.duration || 0,
    status: payload.status || 'Non commencé',
    element_id: element_id,
    element_type: payload.element_type || null,
    slab_id: slab_id,
    axes: payload.axes || null,
    surface: payload.surface || 0,
    team_id: payload.team_id || null,
    user_id: uid
  }).select().single();

  if (error) console.error('createTask error:', error);
  return { ...(data || {}), element_id, slab_id };
};

export const updateTask = async (id: number, payload: any) => {
  const { data: task } = await supabase.from('tasks').select('element_id, slab_id, element_type').eq('id', id).single();

  const { error } = await supabase.from('tasks').update({
    block_id: payload.block_id || null,
    floor_id: payload.floor_id || null,
    element: payload.element || null,
    description: payload.description || null,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    duration: payload.duration || 0,
    status: payload.status || null,
    element_type: payload.element_type || null,
    axes: payload.axes || null,
    surface: payload.surface || 0,
    team_id: payload.team_id || null
  }).eq('id', id);

  if (error) console.error('updateTask error:', error);

  if (task) {
    if (task.slab_id) {
      await supabase.from('slabs').update({
        block_id: payload.block_id, floor_id: payload.floor_id, name: payload.element,
        axes: payload.axes, surface: payload.surface, start_date: payload.start_date,
        end_date: payload.end_date, status: payload.status
      }).eq('id', task.slab_id);
    } else if (task.element_id && ['Poteau', 'Voile', 'Voile périphérique'].includes(task.element_type)) {
      await supabase.from('vertical_elements').update({
        block_id: payload.block_id, floor_id: payload.floor_id, name: payload.element,
        axes: payload.axes, type: payload.element_type
      }).eq('id', task.element_id);
    }
  }
};

export const deleteTask = async (id: number) => {
  const { data: task } = await supabase.from('tasks').select('element_id, slab_id, element_type').eq('id', id).single();
  if (task) {
    if (task.slab_id) {
      await supabase.from('slabs').delete().eq('id', task.slab_id);
    } else if (task.element_id && ['Poteau', 'Voile', 'Voile périphérique'].includes(task.element_type)) {
      await supabase.from('vertical_elements').delete().eq('id', task.element_id);
    }
  }
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) console.error('deleteTask error:', error);
};

export const bulkDeleteTasks = async (ids: number[]) => {
  const { error } = await supabase.from('tasks').delete().in('id', ids);
  if (error) console.error('bulkDeleteTasks error:', error);
};

// ─── VERTICAL ELEMENTS ───────────────────────────────────
export const fetchVerticalElements = async () => {
  const uid = await getActiveProjectOwnerId();
  const { data, error } = await supabase
    .from('vertical_elements')
    .select('*, blocks(name), floors(name)')
    .eq('user_id', uid);
  if (error) console.error('fetchVerticalElements error:', error);
  return (data || []).map((e: any) => ({
    ...e,
    block_name: e.blocks?.name || null,
    floor_name: e.floors?.name || null,
    blocks: undefined,
    floors: undefined
  }));
};

export const createVerticalElement = async (payload: any) => {
  const uid = await getActiveProjectOwnerId();
  const { data: veData, error } = await supabase.from('vertical_elements').insert({
    block_id: payload.block_id || null,
    floor_id: payload.floor_id || null,
    type: payload.type || null,
    name: payload.name || null,
    axes: payload.axes || null,
    user_id: uid
  }).select('id').single();
  if (error) console.error('createVerticalElement error:', error);
  const elementId = veData?.id;

  // Auto-create planning task
  const startDate = payload.start_date || new Date().toISOString().split('T')[0];
  const endDate = payload.end_date || new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0];
  const duration = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));

  await supabase.from('tasks').insert({
    block_id: payload.block_id, floor_id: payload.floor_id,
    element: payload.name, description: payload.name,
    start_date: startDate, end_date: endDate, duration,
    status: 'Non commencé', element_id: elementId,
    element_type: payload.type, axes: payload.axes,
    user_id: uid
  });

  return elementId;
};

export const deleteVerticalElement = async (id: number) => {
  const { error: delError } = await supabase.from('vertical_elements').delete().eq('id', id);
  if (delError) console.error('deleteVerticalElement error:', delError);
  const { error: taskError } = await supabase.from('tasks').delete().eq('element_id', id);
  if (taskError) console.error('deleteVerticalElement task cleanup error:', taskError);
};

export const updateVerticalElementStatus = async (id: number, field: string, newStatus: string) => {
  const { data, error } = await supabase
    .from('vertical_elements')
    .update({ [field]: newStatus })
    .eq('id', id)
    .select();
  
  if (error) {
    console.error('updateVerticalElementStatus error:', error);
    return;
  }

  if (field === 'coulage_status' && newStatus === 'Terminé') {
    await supabase.from('tasks').update({ status: 'Terminé' }).eq('element_id', id);
  } else if (newStatus === 'En cours') {
    await supabase.from('tasks').update({ status: 'En cours' }).eq('element_id', id);
  }
};

// ─── SLABS ────────────────────────────────────────────────
export const fetchSlabs = async () => {
  const uid = await getActiveProjectOwnerId();
  const { data, error } = await supabase
    .from('slabs')
    .select('*, blocks(name), floors(name)')
    .eq('user_id', uid);
  if (error) console.error('fetchSlabs error:', error);
  return (data || []).map((s: any) => ({
    ...s,
    block_name: s.blocks?.name || null,
    floor_name: s.floors?.name || null,
    blocks: undefined,
    floors: undefined
  }));
};

export const createSlab = async (payload: any) => {
  const uid = await getActiveProjectOwnerId();
  const { data: slabData, error } = await supabase.from('slabs').insert({
    block_id: payload.block_id || null,
    floor_id: payload.floor_id || null,
    name: payload.name || null,
    axes: payload.axes || null,
    surface: payload.surface ? parseFloat(payload.surface.toString()) : 0,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    status: 'Non commencé',
    user_id: uid
  }).select('id').single();
  if (error) console.error('createSlab error:', error);
  const slabId = slabData?.id;

  // Auto-create planning task
  const startDate = payload.start_date || new Date().toISOString().split('T')[0];
  const endDate = payload.end_date || new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0];
  const duration = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));

  await supabase.from('tasks').insert({
    block_id: payload.block_id, floor_id: payload.floor_id,
    element: payload.name, description: payload.name,
    start_date: startDate, end_date: endDate, duration,
    status: 'Non commencé', element_type: 'Dalle',
    slab_id: slabId, axes: payload.axes,
    surface: payload.surface ? parseFloat(payload.surface.toString()) : 0,
    user_id: uid
  });

  return slabId;
};

export const updateSlabStatus = async (id: number, field: string, newStatus: string) => {
  await supabase.from('slabs').update({ [field]: newStatus }).eq('id', id);

  if (field === 'coulage_status' && newStatus === 'Terminé') {
    await supabase.from('tasks').update({ status: 'Terminé' }).eq('slab_id', id);
    await supabase.from('slabs').update({ status: 'Terminé' }).eq('id', id);
  } else if (newStatus === 'En cours') {
    await supabase.from('tasks').update({ status: 'En cours' }).eq('slab_id', id);
    await supabase.from('slabs').update({ status: 'En cours' }).eq('id', id);
  }
};

export const deleteSlab = async (id: number) => {
  await supabase.from('tasks').delete().eq('slab_id', id);
  const { error } = await supabase.from('slabs').delete().eq('id', id);
  if (error) console.error('deleteSlab error:', error);
};

export const updateSlab = async (id: number, payload: any) => {
  const { error } = await supabase.from('slabs').update({
    name: payload.name,
    block_id: payload.block_id,
    floor_id: payload.floor_id,
    axes: payload.axes || null,
    surface: payload.surface ? parseFloat(payload.surface.toString()) : 0,
  }).eq('id', id);
  if (error) console.error('updateSlab error:', error);

  await supabase.from('tasks').update({
    element: payload.name,
    description: payload.name,
    block_id: payload.block_id,
    floor_id: payload.floor_id,
    axes: payload.axes || null,
    surface: payload.surface ? parseFloat(payload.surface.toString()) : 0,
  }).eq('slab_id', id);
};

// ─── PRODUCTIVITY ─────────────────────────────────────────
export const fetchProductivity = async () => {
  const uid = await getActiveProjectOwnerId();
  const { data, error } = await supabase
    .from('productivity')
    .select('*, blocks(name), teams(name), tasks(element)')
    .eq('user_id', uid);
  if (error) console.error('fetchProductivity error:', error);
  return (data || []).map((p: any) => ({
    ...p,
    block_name: p.blocks?.name || null,
    team_name: p.teams?.name || null,
    task_name: p.tasks?.element || null,
    blocks: undefined,
    teams: undefined,
    tasks: undefined
  }));
};

export const createProductivity = async (payload: {
  block_id: number; team_id: number; task_id: number | null;
  work_type: string; workers_count: number; quantity_realized: number; date: string;
}) => {
  const uid = await getActiveProjectOwnerId();
  const { data, error } = await supabase.from('productivity').insert({ ...payload, user_id: uid }).select().single();
  if (error) console.error('createProductivity error:', error);
  return data;
};
