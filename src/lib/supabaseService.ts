import { supabase } from './supabase';

// ─── BLOCKS ───────────────────────────────────────────────
export const fetchBlocks = async () => {
  const { data, error } = await supabase.from('blocks').select('*');
  if (error) console.error('fetchBlocks error:', error);
  return data || [];
};

export const createBlock = async (payload: { name: string; zone: string; description: string }) => {
  const { data, error } = await supabase.from('blocks').insert(payload).select().single();
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
  const { data, error } = await supabase
    .from('floors')
    .select('*, blocks(name)')
    .order('order_number', { ascending: true });
  if (error) console.error('fetchFloors error:', error);
  return (data || []).map((f: any) => ({
    ...f,
    block_name: f.blocks?.name || 'Inconnu',
    blocks: undefined
  }));
};

export const createFloor = async (payload: { block_id: number; name: string; order_number: number }) => {
  const { data, error } = await supabase.from('floors').insert(payload).select().single();
  if (error) console.error('createFloor error:', error);
  return data;
};

export const deleteFloor = async (id: number) => {
  const { error } = await supabase.from('floors').delete().eq('id', id);
  if (error) console.error('deleteFloor error:', error);
};

// ─── TEAMS ────────────────────────────────────────────────
export const fetchTeams = async () => {
  const { data, error } = await supabase
    .from('teams')
    .select('*, blocks(name)');
  if (error) console.error('fetchTeams error:', error);
  return (data || []).map((t: any) => ({
    ...t,
    block_name: t.blocks?.name || null,
    blocks: undefined
  }));
};

export const createTeam = async (payload: { name: string; speciality: string; block_id: number | null; workers: number }) => {
  const { data, error } = await supabase.from('teams').insert(payload).select().single();
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
  const { data, error } = await supabase
    .from('tasks')
    .select('*, blocks(name), floors(name), teams(name)')
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
  let element_id = null;
  let slab_id = null;

  // Create structural element if type is specified
  if (payload.element_type === 'Dalle') {
    let finalBlockId = payload.block_id;
    let finalFloorId = payload.floor_id;

    if (!finalBlockId || !finalFloorId) {
      const { data: defaultBlock } = await supabase.from('blocks').select('id').order('id').limit(1).single();
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
        status: payload.status || 'Non commencé'
      }).select('id').single();
      slab_id = slabData?.id || null;
    }
  } else if (['Poteau', 'Voile', 'Voile périphérique'].includes(payload.element_type)) {
    const { data: veData } = await supabase.from('vertical_elements').insert({
      block_id: payload.block_id,
      floor_id: payload.floor_id,
      type: payload.element_type,
      name: payload.element,
      axes: payload.axes || null
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
    team_id: payload.team_id || null
  }).select().single();

  if (error) console.error('createTask error:', error);
  return { ...(data || {}), element_id, slab_id };
};

export const updateTask = async (id: number, payload: any) => {
  // Get current task to find linked elements
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

  // Sync with linked elements
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
  const { data, error } = await supabase
    .from('vertical_elements')
    .select('*, blocks(name), floors(name)');
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
  const { data: veData, error } = await supabase.from('vertical_elements').insert({
    block_id: payload.block_id || null,
    floor_id: payload.floor_id || null,
    type: payload.type || null,
    name: payload.name || null,
    axes: payload.axes || null
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
    element_type: payload.type, axes: payload.axes
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
  const { error } = await supabase.from('vertical_elements').update({ [field]: newStatus }).eq('id', id);
  if (error) {
    console.error('updateVerticalElementStatus error:', error);
    return; // Don't proceed if the update failed
  }

  // Sync status with task
  if (field === 'coulage_status' && newStatus === 'Terminé') {
    await supabase.from('tasks').update({ status: 'Terminé' }).eq('element_id', id);
  } else if (newStatus === 'En cours') {
    await supabase.from('tasks').update({ status: 'En cours' }).eq('element_id', id);
  }
};

// ─── SLABS ────────────────────────────────────────────────
export const fetchSlabs = async () => {
  const { data, error } = await supabase
    .from('slabs')
    .select('*, blocks(name), floors(name)');
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
  const { data: slabData, error } = await supabase.from('slabs').insert({
    block_id: payload.block_id || null,
    floor_id: payload.floor_id || null,
    name: payload.name || null,
    axes: payload.axes || null,
    surface: payload.surface ? parseFloat(payload.surface.toString()) : 0,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    status: 'Non commencé'
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
    surface: payload.surface ? parseFloat(payload.surface.toString()) : 0
  });

  return slabId;
};

export const updateSlabStatus = async (id: number, field: string, newStatus: string) => {
  await supabase.from('slabs').update({ [field]: newStatus }).eq('id', id);

  // Sync overall status
  if (field === 'coulage_status' && newStatus === 'Terminé') {
    await supabase.from('tasks').update({ status: 'Terminé' }).eq('slab_id', id);
    await supabase.from('slabs').update({ status: 'Terminé' }).eq('id', id);
  } else if (newStatus === 'En cours') {
    await supabase.from('tasks').update({ status: 'En cours' }).eq('slab_id', id);
    await supabase.from('slabs').update({ status: 'En cours' }).eq('id', id);
  }
};

// ─── PRODUCTIVITY ─────────────────────────────────────────
export const fetchProductivity = async () => {
  const { data, error } = await supabase
    .from('productivity')
    .select('*, blocks(name), teams(name), tasks(element)');
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
  const { data, error } = await supabase.from('productivity').insert(payload).select().single();
  if (error) console.error('createProductivity error:', error);
  return data;
};
