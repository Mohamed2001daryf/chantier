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

// ─── ELEMENT TYPES ──────────────────────────────────────────
export const fetchElementTypes = async () => {
  const ownerId = await getActiveProjectOwnerId();
  const { data, error } = await supabase
    .from('element_types')
    .select('*')
    .eq('user_id', ownerId)
    .order('name');
  if (error) console.error('fetchElementTypes error:', error);
  return data || [];
};

export const createElementType = async (name: string, category: 'suivi' | 'planning' | 'les deux') => {
  const uid = await getUserId();
  const { data, error } = await supabase
    .from('element_types')
    .insert({ user_id: uid, name: name.trim(), category })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Ce type existe déjà.');
    console.error('createElementType error:', error);
    throw error;
  }
  return data;
};

export const deleteElementType = async (id: number) => {
  const { error } = await supabase.from('element_types').delete().eq('id', id);
  if (error) {
    console.error('deleteElementType error:', error);
    throw error;
  }
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

export const updateFloor = async (id: number, payload: { name: string; order_number: number; surface_totale_dalle?: number }) => {
  const { error } = await supabase.from('floors').update({
    name: payload.name,
    order_number: payload.order_number,
    surface_totale_dalle: payload.surface_totale_dalle ?? null,
  }).eq('id', id);
  if (error) console.error('updateFloor error:', error);
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

// ─── STATUS MAPPING ───────────────────────────────────────
export const mapStatusSuiviToPlanning = (status: string) => {
  if (status === 'Terminé' || status === 'termine') return 'Terminé';
  if (status === 'En cours' || status === 'en_cours') return 'En cours';
  return 'Non commencé';
};

export const mapStatusPlanningToSuivi = (status: string) => {
  if (status === 'Terminé' || status === 'termine') return 'termine';
  if (status === 'En cours' || status === 'en_cours') return 'en_cours';
  return 'non_commence';
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

  // 1. Insert Task first to get its ID
  const { data: taskData, error: taskError } = await supabase.from('tasks').insert({
    block_id: payload.block_id || null,
    floor_id: payload.floor_id || null,
    element: payload.element || null,
    description: (payload.description || payload.element) || null,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    duration: payload.duration || 0,
    status: payload.status || 'Non commencé',
    element_type: payload.element_type || null,
    axes: payload.axes || null,
    surface: payload.surface || 0,
    team_id: payload.team_id || null,
    user_id: uid
  }).select().single();

  if (taskError) {
    console.error('createTask error:', taskError);
    throw taskError;
  }

  let element_id = null;
  let slab_id = null;

  // 2. Create structural element if a type is provided
  if (payload.element_type) {
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
          task_id: taskData.id,
          user_id: uid
        }).select('id').single();
        slab_id = slabData?.id || null;
      }
    } else {
      const initRaw = payload.status?.trim().toLowerCase();
      let initStatus = 'Non commencé';
      if (initRaw === 'terminé' || initRaw === 'termine') initStatus = 'Terminé';
      else if (initRaw === 'en cours') initStatus = 'En cours';

      const { data: veData } = await supabase.from('vertical_elements').insert({
        block_id: payload.block_id,
        floor_id: payload.floor_id,
        type: payload.element_type,
        name: payload.element,
        axes: payload.axes || null,
        ferraillage_status: initStatus,
        coffrage_status: initStatus,
        coulage_status: initStatus,
        task_id: taskData.id,
        user_id: uid
      }).select('id').single();
      element_id = veData?.id || null;
    }
  }

  // 3. Update task with element_id / slab_id
  if (element_id || slab_id) {
    await supabase.from('tasks').update({
      element_id: element_id,
      slab_id: slab_id
    }).eq('id', taskData.id);

    taskData.element_id = element_id;
    taskData.slab_id = slab_id;
  }

  return taskData;
};

export const updateTask = async (id: number, payload: any) => {
  const { data: task } = await supabase.from('tasks').select('element_id, slab_id, element_type, user_id').eq('id', id).single();

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
    let elementId = task.element_id;
    let slabId = task.slab_id;

    // CAS C : Si pas encore lié mais on précise un element_type, essayer de lier par le nom
    if (!elementId && !slabId && payload.element_type && task.user_id && payload.element) {
      if (payload.element_type === 'Dalle') {
        const { data: matchedSlab } = await supabase
          .from('slabs')
          .select('id')
          .eq('name', payload.element)
          .eq('user_id', task.user_id)
          .limit(1)
          .maybeSingle();
        if (matchedSlab?.id) {
          slabId = matchedSlab.id;
          await supabase.from('slabs').update({ task_id: id }).eq('id', slabId);
          await supabase.from('tasks').update({ slab_id: slabId }).eq('id', id);
        }
      } else {
        const { data: matchedVe } = await supabase
          .from('vertical_elements')
          .select('id')
          .eq('name', payload.element)
          .eq('user_id', task.user_id)
          .limit(1)
          .maybeSingle();
        if (matchedVe?.id) {
          elementId = matchedVe.id;
          await supabase.from('vertical_elements').update({ task_id: id }).eq('id', elementId);
          await supabase.from('tasks').update({ element_id: elementId }).eq('id', id);
        }
      }
    }

    if (slabId) {
      await supabase.from('slabs').update({
        block_id: payload.block_id, floor_id: payload.floor_id, name: payload.element,
        axes: payload.axes, surface: payload.surface, start_date: payload.start_date,
        end_date: payload.end_date, status: payload.status
      }).eq('id', slabId);
    } else if (elementId) {
      const veUpdate: any = {
        block_id: payload.block_id, floor_id: payload.floor_id, name: payload.element,
        axes: payload.axes, type: payload.element_type
      };

      const normStatus = payload.status?.trim().toLowerCase();
      if (normStatus === 'terminé' || normStatus === 'termine') {
        veUpdate.ferraillage_status = 'Terminé';
        veUpdate.coffrage_status = 'Terminé';
        veUpdate.coulage_status = 'Terminé';
      } else if (normStatus === 'en cours') {
        veUpdate.ferraillage_status = 'En cours';
      } else if (normStatus === 'non commencé' || normStatus === 'non commence') {
        veUpdate.ferraillage_status = 'Non commencé';
        veUpdate.coffrage_status = 'Non commencé';
        veUpdate.coulage_status = 'Non commencé';
      }

      await supabase.from('vertical_elements').update(veUpdate).eq('id', elementId);
    }
  }
};

export const deleteTask = async (id: number) => {
  const { data: task } = await supabase.from('tasks').select('element_id, slab_id').eq('id', id).single();
  if (task) {
    if (task.slab_id) {
      await supabase.from('slabs').delete().eq('id', task.slab_id);
    } else if (task.element_id) {
      await supabase.from('vertical_elements').delete().eq('id', task.element_id);
    }
  }
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) console.error('deleteTask error:', error);
};

export const bulkDeleteTasks = async (ids: number[]) => {
  const { data: tasks } = await supabase.from('tasks').select('element_id, slab_id').in('id', ids);
  if (tasks) {
    const slabIds = tasks.map(t => t.slab_id).filter(Boolean) as number[];
    const elementIds = tasks.map(t => t.element_id).filter(Boolean) as number[];

    if (slabIds.length > 0) await supabase.from('slabs').delete().in('id', slabIds);
    if (elementIds.length > 0) await supabase.from('vertical_elements').delete().in('id', elementIds);
  }

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

  if (error) {
    console.error('createVerticalElement error:', error);
    return;
  }
  const elementId = veData?.id;

  // Auto-create planning task
  const startDate = payload.start_date || new Date().toISOString().split('T')[0];
  const endDate = payload.end_date || new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0];
  const duration = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));

  const { data: taskData, error: taskError } = await supabase.from('tasks').insert({
    block_id: payload.block_id, floor_id: payload.floor_id,
    element: payload.name, description: payload.name,
    start_date: startDate, end_date: endDate, duration,
    status: 'Non commencé', element_id: elementId,
    element_type: payload.type, axes: payload.axes,
    user_id: uid
  }).select('id').single();

  if (taskError) {
    console.error('createVerticalElement auto-task error:', taskError);
  } else if (taskData) {
    // Link back to the element
    await supabase.from('vertical_elements').update({ task_id: taskData.id }).eq('id', elementId);
  }

  return elementId;
};

export const deleteVerticalElement = async (id: number) => {
  const { data: element } = await supabase.from('vertical_elements').select('task_id').eq('id', id).single();
  const { error: delError } = await supabase.from('vertical_elements').delete().eq('id', id);
  if (delError) console.error('deleteVerticalElement error:', delError);

  if (element?.task_id) {
    const { error: taskError } = await supabase.from('tasks').delete().eq('id', element.task_id);
    if (taskError) console.error('deleteVerticalElement task cleanup error:', taskError);
  }
};

export const updateVerticalElementStatus = async (id: number, field: string, newStatus: string) => {
  const { data, error } = await supabase
    .from('vertical_elements')
    .update({ [field]: newStatus })
    .eq('id', id)
    .select('task_id, ferraillage_status, coffrage_status, coulage_status, name, user_id')
    .single();

  if (error) {
    console.error('updateVerticalElementStatus error:', error);
    return;
  }

  let taskId = data?.task_id;

  // CAS C : Si pas de task_id, chercher par nom et lier au lieu du task_id
  if (!taskId && data?.name && data?.user_id) {
    const { data: matchedTask } = await supabase
      .from('tasks')
      .select('id')
      .eq('element', data.name)
      .eq('user_id', data.user_id)
      .limit(1)
      .maybeSingle();

    if (matchedTask?.id) {
      taskId = matchedTask.id;
      // Réparer le lien dans les deux sens
      await supabase.from('vertical_elements').update({ task_id: taskId }).eq('id', id);
      await supabase.from('tasks').update({ element_id: id }).eq('id', taskId);
    }
  }

  if (taskId) {
    let planningStatus = 'Non commencé';

    const fStatus = data.ferraillage_status;
    const cStatus = data.coffrage_status;
    const lStatus = data.coulage_status;

    if ((fStatus === 'Terminé' || fStatus === 'termine') &&
      (cStatus === 'Terminé' || cStatus === 'termine') &&
      (lStatus === 'Terminé' || lStatus === 'termine')) {
      planningStatus = 'Terminé';
    }
    else if (
      (fStatus && fStatus !== 'Non commencé' && fStatus !== 'non_commence') ||
      (cStatus && cStatus !== 'Non commencé' && cStatus !== 'non_commence') ||
      (lStatus && lStatus !== 'Non commencé' && lStatus !== 'non_commence')
    ) {
      planningStatus = 'En cours';
    }

    await supabase.from('tasks').update({ status: planningStatus }).eq('id', taskId);
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

  if (error) {
    console.error('createSlab error:', error);
    return;
  }
  const slabId = slabData?.id;

  // Auto-create planning task
  const startDate = payload.start_date || new Date().toISOString().split('T')[0];
  const endDate = payload.end_date || new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0];
  const duration = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));

  const { data: taskData, error: taskError } = await supabase.from('tasks').insert({
    block_id: payload.block_id, floor_id: payload.floor_id,
    element: payload.name, description: payload.name,
    start_date: startDate, end_date: endDate, duration,
    status: 'Non commencé', element_type: 'Dalle',
    slab_id: slabId, axes: payload.axes,
    surface: payload.surface ? parseFloat(payload.surface.toString()) : 0,
    user_id: uid
  }).select('id').single();

  if (taskError) {
    console.error('createSlab auto-task error:', taskError);
  } else if (taskData) {
    await supabase.from('slabs').update({ task_id: taskData.id }).eq('id', slabId);
  }

  return slabId;
};

export const updateSlabStatus = async (id: number, field: string, newStatus: string) => {
  const updatePayload: any = { [field]: newStatus };

  // Si passage à 'Terminé', on enregistre la date du jour
  if (newStatus === 'Terminé') {
    const dateField = field.replace('_status', '_date');
    // On vérifie que c'est bien un champ d'étape PT (coffrage, ferraillage_inf, etc.)
    const ptFields = ['coffrage_status', 'ferraillage_inf_status', 'pose_gaine_status', 'pose_cable_status', 'renforcement_status', 'coulage_status'];
    if (ptFields.includes(field)) {
      updatePayload[dateField] = new Date().toISOString().split('T')[0];
    }
  }

  const { data, error } = await supabase
    .from('slabs')
    .update(updatePayload)
    .eq('id', id)
    .select('task_id, status, coffrage_status, ferraillage_inf_status, pose_gaine_status, pose_cable_status, renforcement_status, coulage_status, coffrage_date, ferraillage_inf_date, pose_gaine_date, pose_cable_date, renforcement_date, coulage_date')
    .single();

  if (error) {
    console.error('updateSlabStatus error:', error);
    return;
  }

  if (data?.task_id) {
    let planningStatus = 'Non commencé';

    // Si la dalle globale est marquée comme terminée, ou si son dernier état coulage est terminé
    if (data.status === 'Terminé' || data.coulage_status === 'Terminé' || newStatus === 'Terminé') {
      planningStatus = 'Terminé';
    } else if (
      data.status === 'En cours' ||
      (data.coffrage_status && data.coffrage_status !== 'Non commencé') ||
      (data.ferraillage_inf_status && data.ferraillage_inf_status !== 'Non commencé') ||
      (data.pose_gaine_status && data.pose_gaine_status !== 'Non commencé') ||
      (data.pose_cable_status && data.pose_cable_status !== 'Non commencé') ||
      (data.renforcement_status && data.renforcement_status !== 'Non commencé') ||
      (data.coulage_status && data.coulage_status !== 'Non commencé')
    ) {
      planningStatus = 'En cours';
    }

    await supabase.from('tasks').update({ status: planningStatus }).eq('id', data.task_id);

    // Synchro du `status` natif de la dalle selon progression
    if (data.status !== planningStatus && field !== 'status') {
      await supabase.from('slabs').update({ status: planningStatus }).eq('id', id);
    }
  }
};

export const deleteSlab = async (id: number) => {
  const { data: slab } = await supabase.from('slabs').select('task_id').eq('id', id).single();
  const { error } = await supabase.from('slabs').delete().eq('id', id);
  if (error) console.error('deleteSlab error:', error);

  if (slab?.task_id) {
    await supabase.from('tasks').delete().eq('id', slab.task_id);
  }
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
